"""Settings, from the environment (on the VPS: hosts/vps/apps.nix and the turquoise-env secret, both in
nix-dotfiles)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The model: LiteLLM on Berk's PC (nix-dotfiles hosts/desktop/llm), over Tailscale. Empty: quick
    # answers only. Turquoise's key may use only the chat models, a few requests at a time.
    llm_url: str = ""  # e.g. http://100.76.197.63:8000
    llm_key: str = ""
    llm_model: str = "default"  # the PC's chat model, by the name that stays when the model changes

    # What the agent searches: Berk's CV, and the website's pages (from its sitemap, re-read hourly).
    profile_path: Path = Path(__file__).resolve().parent.parent / "profile" / "cv.md"
    site_url: str = "https://berkmonder.com"  # empty: no website search
    site_refresh_s: int = 3600
    embedding_model: str = "BAAI/bge-small-en-v1.5"  # empty: search by words only

    # Limits for the public: one visitor, everyone together, one answer.
    gpu_concurrency: int = 3  # the engine has 4 slots: one stays free for Berk
    queue_max: int = 12
    queue_wait_s: float = 25.0
    chat_per_visitor: int = 10  # messages per window
    chat_window_s: int = 300
    gpu_chats_per_day: int = 500
    message_max_chars: int = 800
    history_max_messages: int = 24
    agent_max_requests: int = 6  # model calls for one answer, tool rounds included


settings = Settings()
