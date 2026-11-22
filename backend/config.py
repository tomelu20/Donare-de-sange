from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Read configuration from environment variables or .env file

class Settings(BaseSettings):
    ENV: Literal["development", "production"] = "development"

    # --- DATABASE ---
    DATABASE_URL: str
    
    # --- AUTH / SECURITY ---
    SECRET_KEY: str
    ALGORITHM: Literal["HS256"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=480, gt=0, le=1440)
    
    # --- CORS / FRONTEND ---
    CORS_ORIGINS: str
    FRONTEND_URL: str = "http://localhost:5173"

    GEMINI_API_KEY: str
    EMAIL_USER: str | None = None
    EMAIL_PASSWORD: str | None = None
    GOOGLE_CLIENT_ID: str | None = None

    @model_validator(mode="after")
    def validate_deployment_settings(self):
        if bool(self.EMAIL_USER) != bool(self.EMAIL_PASSWORD):
            raise ValueError("EMAIL_USER and EMAIL_PASSWORD must be configured together.")

        if self.ENV == "production":
            if len(self.SECRET_KEY.encode("utf-8")) < 32:
                raise ValueError("SECRET_KEY must contain at least 32 bytes in production.")

            origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
            if not origins or "*" in origins:
                raise ValueError("Production CORS_ORIGINS must list explicit HTTPS origins.")
            parsed_origins = [urlsplit(origin) for origin in origins]
            if any(
                parsed.scheme != "https"
                or not parsed.netloc
                or parsed.path
                or parsed.query
                or parsed.fragment
                for parsed in parsed_origins
            ):
                raise ValueError("Every production CORS origin must be an HTTPS origin without a path.")

            frontend = urlsplit(self.FRONTEND_URL)
            if frontend.scheme != "https" or not frontend.netloc:
                raise ValueError("FRONTEND_URL must use HTTPS in production.")
            if f"{frontend.scheme}://{frontend.netloc}" not in origins:
                raise ValueError("FRONTEND_URL must also be listed in CORS_ORIGINS.")

            if not self.EMAIL_USER or not self.EMAIL_PASSWORD:
                raise ValueError("EMAIL_USER and EMAIL_PASSWORD are required in production.")

        return self

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().with_name(".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()