"""Settings, from the environment (on the VPS: hosts/vps/apps.nix, and the turquoise-env secret, both in
nix-dotfiles)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./turquoise.db"

    # The GPU side: Alperen on Berk's PC, over Tailscale. Empty: always the fallback.
    gateway_url: str = ""  # e.g. http://100.76.197.63:4000
    gateway_key: str = ""  # alperen-turquoise-gateway-key: may use only the `about` model
    gateway_model: str = "about"
    forecaster_url: str = ""  # Alperen's time-series forecaster (Chronos-Bolt on the GPU)
    forecaster_key: str = ""

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
