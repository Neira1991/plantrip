import os
import warnings

from pydantic_settings import BaseSettings

_INSECURE_SECRETS = {
    "change-me-in-production",
    "secret",
    "jwt-secret",
    "your-secret-key",
}


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/plantrip"
    JWT_SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    COOKIE_SECURE: bool = False
    OPENTRIPMAP_API_KEY: str = ""
    UNSPLASH_ACCESS_KEY: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()

# Reject known-insecure JWT secrets unless running in test mode
if settings.JWT_SECRET_KEY in _INSECURE_SECRETS:
    if os.environ.get("TESTING", "").lower() == "true":
        warnings.warn(
            "JWT_SECRET_KEY is using an insecure default. Acceptable for testing only.",
            stacklevel=1,
        )
    else:
        raise RuntimeError(
            "FATAL: JWT_SECRET_KEY is set to a known insecure default. "
            "Generate a strong secret: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
        )
