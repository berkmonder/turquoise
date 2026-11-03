"""Forecasts with an uncertainty band, two ways, both on the server's CPU:

- Chronos-Bolt, a pretrained time-series model (Amazon's chronos-bolt-small), as ONNX: exported from
  PyTorch when the image is built (scripts/export_chronos.py), run with onnxruntime;
- fallback: an autoregressive model fitted on the spot (robust least squares, numpy), when the
  model isn't there (a local run without the export).

Both return, for each future step, the expected value and its standard deviation."""

import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

Z_80 = 1.2816  # q10 and q90 lie 1.28 standard deviations from the median


@dataclass
class Forecast:
    median: np.ndarray
    sigma: np.ndarray
    source: str  # "chronos" or "fallback"


def _fit(y: np.ndarray, order: int, rounds: int = 4) -> tuple[np.ndarray, float, np.ndarray]:
    """AR(order) by least squares, reweighted (Huber) so that outliers in the history barely count.
    Returns the coefficients (the last is the intercept), the residuals' robust spread, and the
    history's last `order` values with outliers replaced by what the model expected there."""
    lags = np.column_stack([y[order - k - 1:len(y) - k - 1] for k in range(order)])
    design = np.column_stack([lags, np.ones(len(lags))])
    target = y[order:]
    weights = np.ones(len(target))
    coef = np.zeros(order + 1)
    spread = 1e-6
    for _ in range(rounds):
        root = np.sqrt(weights)
        coef, *_ = np.linalg.lstsq(design * root[:, None], target * root, rcond=None)
        residual = target - design @ coef
        spread = float(1.4826 * np.median(np.abs(residual - np.median(residual)))) or 1e-6
        weights = np.minimum(1.0, 1.5 * spread / np.maximum(np.abs(residual), 1e-12))
    fitted = design @ coef
    tail = y[-order:].copy()
    outliers = np.abs(target[-order:] - fitted[-order:]) > 4 * spread
    tail[outliers] = fitted[-order:][outliers]
    return coef, spread, tail


def _predict(coef: np.ndarray, tail: np.ndarray, horizon: int) -> np.ndarray:
    a, c = coef[:-1], coef[-1]
    history = list(tail)
    out = np.empty(horizon)
    for h in range(horizon):
        out[h] = float(np.dot(a, history[::-1][: len(a)]) + c)
        history = history[1:] + [out[h]]
    return out


def autoregressive(values: np.ndarray, horizon: int, order: int = 12) -> Forecast:
    """A robust AR model fitted on the spot. Its band is the wider of two: what the model's own
    equations say, and the errors it really made forecasting the last stretches of the history."""
    y = np.asarray(values, dtype=float)
    order = max(2, min(order, len(y) // 4))
    if len(y) < order + 8:
        level = float(y[-1]) if len(y) else 0.0
        spread = float(np.std(y)) if len(y) > 1 else 1.0
        return Forecast(np.full(horizon, level), np.full(horizon, max(spread, 1e-6)), "fallback")
    coef, spread, tail = _fit(y, order)
    median = _predict(coef, tail, horizon)

    # The spread of an h-step forecast by the equations: the residual's, through the impulse response.
    a = coef[:-1]
    psi = np.zeros(horizon)
    psi[0] = 1.0
    for j in range(1, horizon):
        psi[j] = sum(a[i] * psi[j - i - 1] for i in range(min(j, order)))
    sigma = spread * np.sqrt(np.cumsum(psi**2))

    # Backtests: forecast the history's last stretches from what came before them.
    errors = []
    for back in range(1, 4):
        cut = len(y) - back * horizon
        if cut < max(48, 4 * order):
            break
        c, _, t = _fit(y[:cut], order)
        errors.append(np.abs(y[cut:cut + horizon] - _predict(c, t, horizon)))
    if errors:
        observed = np.median(np.array(errors), axis=0) / 0.6745  # median absolute error → sigma
        sigma = np.maximum(sigma, np.maximum.accumulate(observed))
    return Forecast(median, sigma, "fallback")


LENGTH = 512  # the model's input: the last 512 points; shorter series are padded with NaN (missing)
QUANTILES = [0, 4, 8]  # of its nine (10% … 90%): 10%, 50%, 90%
STEPS = 64  # what one forward pass forecasts


class Chronos:
    """Chronos-Bolt on the CPU. The model loads on first use; every series in a call is one batch."""

    def __init__(self, path: Path, threads: int = 2) -> None:
        self.path, self.threads = path, threads
        self._session: Any = None
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return self.path.exists()

    def session(self) -> Any:
        with self._lock:
            if self._session is None:
                import onnxruntime

                options = onnxruntime.SessionOptions()
                options.intra_op_num_threads = self.threads
                options.inter_op_num_threads = 1
                self._session = onnxruntime.InferenceSession(str(self.path), options,
                                                             providers=["CPUExecutionProvider"])
        return self._session

    def forecast(self, contexts: list[np.ndarray], horizon: int) -> list[Forecast]:
        if not 1 <= horizon <= STEPS:
            raise ValueError(f"Chronos-Bolt forecasts 1 to {STEPS} steps at once")
        batch = np.full((len(contexts), LENGTH), np.nan, np.float32)
        for i, context in enumerate(contexts):
            tail = np.asarray(context, dtype=np.float32)[-LENGTH:]
            batch[i, LENGTH - len(tail):] = tail
        quantiles = self.session().run(None, {"context": batch})[0]  # [series, 9, 64]
        out = []
        for row in quantiles:
            low, mid, high = row[QUANTILES, :horizon].astype(float)
            out.append(Forecast(mid, np.maximum((high - low) / (2 * Z_80), 1e-6), "chronos"))
        return out
