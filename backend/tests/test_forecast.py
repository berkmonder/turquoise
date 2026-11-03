import numpy as np

from app.anomaly.engine import DT, Signal, detect_sequential
from app.anomaly.forecast import autoregressive


def test_autoregression_follows_a_smooth_signal():
    signal = Signal(seed=1)
    values = np.array([signal.value(i * DT) for i in range(320)])
    f = autoregressive(values[:256], 16)
    error = np.abs(f.median - values[256:272])
    assert error[:4].max() < 0.15  # the next second: close
    assert np.all(error < 3 * np.maximum(f.sigma, 0.07))  # further: inside its own band
    assert np.all(np.diff(f.sigma) >= 0)  # less sure further ahead


def test_spikes_are_found_with_few_false_alarms():
    false_alarms = 0
    for seed in range(10):
        signal = Signal(seed=seed)
        values = [signal.value(i * DT) for i in range(600)]
        values[300] += 3.0
        values[450] -= 1.5
        found = {a["index"] for a in detect_sequential(values, 3.5, 64, 16, 256)}
        assert {300, 450} <= found
        false_alarms += len(found - {300, 450})
    assert false_alarms <= 10 * 600 * 0.01  # under 1% of the points


class FakeSession:
    """Chronos-Bolt's nine quantiles, 0.1 to 0.9 around each series' last value; and what it was given."""

    def __init__(self) -> None:
        self.given: np.ndarray | None = None

    def run(self, _outputs, feed):
        self.given = feed["context"]
        last = self.given[:, -1][:, None, None]
        spread = np.linspace(-0.4, 0.4, 9)[None, :, None]
        return [np.broadcast_to(last + spread, (len(self.given), 9, 64)).astype(np.float32)]


def test_chronos_pads_short_series_and_turns_quantiles_into_a_band(tmp_path):
    from app.anomaly.forecast import Z_80, Chronos

    chronos = Chronos(tmp_path / "chronos.onnx")
    assert not chronos.available  # no export: the demo uses its autoregression
    session = FakeSession()
    chronos._session = session
    short, long = np.arange(100, dtype=float), np.arange(600, dtype=float)
    [a, b] = chronos.forecast([short, long], 16)
    given = session.given
    assert given is not None and given.shape == (2, 512)
    assert np.isnan(given[0, :412]).all() and given[0, -1] == 99  # padded on the left
    assert given[1, 0] == 88 and given[1, -1] == 599  # the last 512 points
    assert a.source == "chronos" and len(a.median) == 16 and a.median[0] == 99
    assert np.allclose(a.sigma, 0.8 / (2 * Z_80))  # the 10%-90% spread as a standard deviation
