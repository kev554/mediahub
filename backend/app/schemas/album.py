from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AlbumCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=150,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    year: int = Field(
        ge=1900,
        le=2100,
    )

    visibility: str = Field(
        default="private",
        pattern="^(private|group)$",
    )

    group_id: int | None = None


class AlbumUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    year: int | None = Field(
        default=None,
        ge=1900,
        le=2100,
    )

    visibility: str | None = Field(
        default=None,
        pattern="^(private|group)$",
    )

    group_id: int | None = None


class AlbumResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    name: str
    description: str | None
    year: int
    cover_path: str | None
    visibility: str
    owner_id: int
    group_id: int | None
    created_at: datetime

    media_count: int = 0
