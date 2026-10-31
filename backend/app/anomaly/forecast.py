"""Forecasts with an uncertainty band, two ways:

- GPU: Chronos-Bolt, a pretrained time-series model, on Berk's PC (Alperen's forecaster service);
- fallback: an autoregressive model fitted on the spot (robust least squares, numpy), on the
  VPS's CPU.

Both return, for each future step, the expected value and its standard deviation."""

from dataclasses import dataclass

import httpx
import numpy as np

from ..gpu import GpuService

Z_80 = 1.2816  # q10 and q90 lie 1.28 standard deviations from the median


@dataclass
class Forecast:
    median: np.ndarray
    sigma: np.ndarray
    source: str  # "gpu" or "fallback"


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


async def chronos(client: httpx.AsyncClient, service: GpuService, contexts: list[np.ndarray],
                  horizon: int, timeout: float = 2.0) -> list[Forecast]:
    """Chronos-Bolt on the GPU, for several series at once (one batch)."""
    response = await client.post(
        f"{service.url}/forecast",
        json={"contexts": [c.tolist() for c in contexts], "horizon": horizon,
              "quantiles": [0.1, 0.5, 0.9]},
        headers=service.headers, timeout=timeout)
    response.raise_for_status()
    out = []
    for low, mid, high in response.json()["quantiles"]:
        low, mid, high = np.asarray(low), np.asarray(mid), np.asarray(high)
        out.append(Forecast(mid, np.maximum((high - low) / (2 * Z_80), 1e-6), "gpu"))
    return out
