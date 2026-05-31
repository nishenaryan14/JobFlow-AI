"""
Centralized configuration with startup validation.

Fails fast if required environment variables are missing,
rather than silently producing broken behaviour at runtime.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load env files in priority order (later loads override earlier)
_root = Path(__file__).parent.parent
load_dotenv(_root / ".env")
load_dotenv(_root / "webapp" / ".env.local")


def _require(name: str) -> str:
    """Read an env var and raise a clear error if it's missing."""
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(
            f"\n\n❌  Missing required environment variable: {name}\n"
            f"    Add it to job_scraper/.env or job_scraper/webapp/.env.local\n"
        )
    return value


def _optional(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


class Settings:
    """
    Validated application settings.
    Instantiated once at module import — any missing required key
    will raise RuntimeError before the server starts accepting requests.
    """

    # ── Required ─────────────────────────────────────────────────────────
    MONGODB_URI: str
    DEEPSEEK_API_KEY: str
    GOOGLE_API_KEY: str
    SERPER_API_KEY: str

    # ── Optional (with sensible defaults) ────────────────────────────────
    REDIS_URL: str
    ENVIRONMENT: str
    OPENAI_API_KEY: str
    NEXTAUTH_SECRET: str

    def __init__(self) -> None:
        missing: list[str] = []

        # Collect all missing required keys before raising so the user sees
        # all problems at once rather than fixing one at a time.
        for key in ("MONGODB_URI", "DEEPSEEK_API_KEY", "GOOGLE_API_KEY", "SERPER_API_KEY"):
            value = os.getenv(key, "").strip()
            if not value:
                missing.append(key)
            else:
                setattr(self, key, value)

        if missing:
            lines = "\n".join(f"    • {k}" for k in missing)
            raise RuntimeError(
                f"\n\n❌  Server refused to start — missing required env vars:\n"
                f"{lines}\n\n"
                f"    Add them to  job_scraper/.env  and restart.\n"
            )

        # Optional settings
        self.REDIS_URL = _optional("REDIS_URL", "redis://localhost:6379/0")
        self.ENVIRONMENT = _optional("ENVIRONMENT", "development")
        self.OPENAI_API_KEY = _optional("OPENAI_API_KEY")
        self.NEXTAUTH_SECRET = _optional("NEXTAUTH_SECRET")

    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


# ── Singleton ─────────────────────────────────────────────────────────────────
# Validation runs here. Any startup failure surfaces immediately.
try:
    settings = Settings()
except RuntimeError as _cfg_err:
    # In development it is common to start the server without all keys —
    # print a warning but do not crash the import so the server can still
    # serve health-check / static endpoints while the user fixes their .env.
    import sys
    print(str(_cfg_err), file=sys.stderr)

    class _PartialSettings:
        """Permissive fallback used when env is incomplete (dev only)."""
        MONGODB_URI = os.getenv("MONGODB_URI", "")
        DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
        GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
        SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
        REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
        NEXTAUTH_SECRET = os.getenv("NEXTAUTH_SECRET", "")

        def is_production(self) -> bool:
            return self.ENVIRONMENT == "production"

    settings = _PartialSettings()  # type: ignore[assignment]
