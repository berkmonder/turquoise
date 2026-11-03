"""Settings, from the environment (on the VPS: hosts/vps/apps.nix, and the turquoise-env secret, both in
nix-dotfiles)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./turquoise.db"

    # The GPU side: Alperen (github.com/berkmonder/alperen) on Berk's PC, over Tailscale. Empty: always
    # the fallback. Its key may use only the base model, a few requests at a time, and isn't learned from.
    alperen_url: str = ""  # e.g. http://100.76.197.63:8000
    alperen_key: str = ""
    alperen_model: str = "qwen3.5-9b"  # the base model: the same answers every time, not the learned one

    # Chronos-Bolt, exported to ONNX when the image is built (scripts/export_chronos.py). Missing (a local
    # run without the export): the anomaly demo uses its autoregression.
    forecaster_model: Path = Path("/opt/chronos/chronos.onnx")
    forecaster_threads: int = 2  # of the server's CPU

    # Where a "contact Berk" request goes: his phone (ntfy). Empty: stored only.
    ntfy_url: str = ""

    profile_path: Path = Path(__file__).resolve().parent.parent / "profile" / "cv.md"
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Limits for the public: a visitor, everyone together, and what's kept.
    gpu_concurrency: int = 3  # the engine has 4 slots: one stays free for Berk
    queue_max: int = 12
    queue_wait_s: float = 25.0
    chat_per_visitor: int = 10  # messages per window
    chat_window_s: int = 300
    gpu_chats_per_day: int = 500
    message_max_chars: int = 800
    history_max_messages: int = 12
    retention_days: int = 90


settings = Settings()
