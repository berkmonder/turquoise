"""Tests run without the GPU, the embedding model or Postgres: settings come from here, before the app
is imported."""

import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ["EMBEDDING_MODEL"] = ""
os.environ["GATEWAY_URL"] = ""
os.environ["FORECASTER_URL"] = ""
os.environ["NTFY_URL"] = ""
