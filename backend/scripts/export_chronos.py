"""Chronos-Bolt to ONNX, so the server runs it with onnxruntime and needs no PyTorch. Run when the image
is built (Containerfile), with PyTorch there only:

    uv run --no-project --with torch==2.15.0 --with chronos-forecasting==2.3.2 --with onnx==1.23.2 \\
        --with onnxscript==0.7.2 --with onnxruntime python scripts/export_chronos.py OUT.onnx

One forward pass gives every step's nine quantiles (10% to 90%) for 64 steps. The input is fixed at the
last 512 points (the exporter can't patch a variable length); shorter series are padded on the left
with NaN, which the model treats as missing. Three things are swapped in for the export, each the same
arithmetic: nanmean and the patching (unfold) in operators ONNX has, and integer token ids that stay
integers. At the end the export is checked against the PyTorch pipeline on the same series."""

import sys

import numpy as np
import torch
from chronos import BaseChronosPipeline, chronos_bolt

MODEL = "amazon/chronos-bolt-small"
LENGTH = 512


def nanmean(x, dim=None, keepdim=False, **_):
    present = ~torch.isnan(x)
    total = torch.where(present, x, torch.zeros_like(x)).sum(dim=dim, keepdim=keepdim)
    return total / present.sum(dim=dim, keepdim=keepdim)


_full = torch.full


def full(size, fill_value, *args, **kwargs):
    if isinstance(fill_value, int) and not isinstance(fill_value, bool) and "dtype" not in kwargs:
        kwargs["dtype"] = torch.long
    return _full(size, fill_value, *args, **kwargs)


def patch(self, x):
    assert self.patch_stride == self.patch_size and x.shape[-1] % self.patch_size == 0
    return x.reshape(*x.shape[:-1], x.shape[-1] // self.patch_size, self.patch_size)


torch.nanmean, torch.Tensor.nanmean, torch.full = nanmean, nanmean, full
chronos_bolt.Patch.forward = patch


class Quantiles(torch.nn.Module):
    def __init__(self, model: torch.nn.Module) -> None:
        super().__init__()
        self.model = model

    def forward(self, context: torch.Tensor) -> torch.Tensor:
        return self.model(context=context).quantile_preds  # [series, 9, 64]


def padded(rows: np.ndarray) -> np.ndarray:
    out = np.full((len(rows), LENGTH), np.nan, np.float32)
    for i, row in enumerate(rows):
        out[i, LENGTH - len(row[-LENGTH:]) :] = row[-LENGTH:]
    return out


def main(out: str) -> None:
    pipeline = BaseChronosPipeline.from_pretrained(MODEL, device_map="cpu", torch_dtype=torch.float32)
    wrapper = Quantiles(pipeline.model).eval()
    t = np.linspace(0, 40, 256)
    series = np.stack([np.sin(t), 3 + 0.5 * np.cos(t / 3)]).astype(np.float32)
    torch.onnx.export(wrapper, (torch.tensor(padded(series)),), out, input_names=["context"],
                      output_names=["quantiles"], opset_version=17, dynamo=False,
                      dynamic_axes={"context": {0: "series"}, "quantiles": {0: "series"}})
    wrapper.eval()  # exporting restores the wrapper's mode, which can switch dropout back on

    import onnxruntime

    mine = onnxruntime.InferenceSession(out).run(None, {"context": padded(series)})[0][:, [0, 4, 8], :]
    with torch.inference_mode():
        q, _ = pipeline.predict_quantiles([torch.tensor(s) for s in series], prediction_length=64,
                                          quantile_levels=[0.1, 0.5, 0.9])
    difference = float(np.abs(q.permute(0, 2, 1).numpy() - mine).max())
    print(f"{MODEL} → {out}; largest difference from the PyTorch pipeline: {difference:.2e}")
    if difference > 1e-3:
        sys.exit("The export doesn't match the PyTorch pipeline.")


if __name__ == "__main__":
    main(sys.argv[1])
