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
