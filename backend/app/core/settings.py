import os
from pathlib import Path
from typing import List


def _parse_origins(value: str | None) -> List[str]:
    if not value:
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    def __init__(self) -> None:
        self.cors_origins: List[str] = _parse_origins(os.getenv("CORS_ORIGINS"))
        self.cache_mode: str = os.getenv("NFLREADPY_CACHE", "filesystem")
        self.cache_dir: Path = Path(os.getenv("NFLREADPY_CACHE_DIR", ".nfl_cache")).resolve()
        self.cache_duration: int = int(os.getenv("NFLREADPY_CACHE_DURATION", "86400"))
        self.timeout: int = int(os.getenv("NFLREADPY_TIMEOUT", "30"))
        self.verbose: bool = os.getenv("NFLREADPY_VERBOSE", "false").lower() in {"1", "true", "yes"}
        self.user_agent: str = os.getenv("NFLREADPY_USER_AGENT", "USSTATS/0.1 (+fastapi)")


settings = Settings()


