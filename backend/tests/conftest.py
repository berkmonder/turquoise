"""Tests run without the GPU, Chronos-Bolt's export, the embedding model or Postgres: settings come
from here, before the app is imported."""

import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["EMBEDDING_MODEL"] = ""
os.environ["ALPEREN_URL"] = ""
os.environ["FORECASTER_MODEL"] = "/nonexistent/chronos.onnx"
os.environ["NTFY_URL"] = ""
