from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "https://mediahub-cqm.pages.dev",
        ],
    )

    max_file_size_bytes: int = Field(
        default=5 * 1024 * 1024 * 1024,
        gt=0,
    )

    trash_retention_days: int = Field(
        default=30,
        gt=0,
    )

    storage_quota_bytes: int | None = Field(
        default=None,
        gt=0,
    )

    r2_endpoint_url: str
    r2_access_key_id: str
    r2_secret_access_key: str
    r2_bucket_name: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
