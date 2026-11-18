"""Tests run without the GPU, the website or the embedding model: settings come from here, before the
app is imported."""

import os

os.environ["LLM_URL"] = ""
os.environ["SITE_URL"] = ""
os.environ["EMBEDDING_MODEL"] = ""
