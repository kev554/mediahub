from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ShareLinkCreateRequest(BaseModel):
    expires_in_hours: int | None = Field(
        default=168,
        ge=1,
        le=8760,
    )
    max_views: int | None = Field(
        default=10,
        ge=1,
        le=10000,
    )
    note: str | None = Field(
        default=None,
        max_length=200,
    )


class ShareLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    media_id: int
    token: str
    note: str | None = None
    created_at: datetime
    expires_at: datetime | None
    max_views: int | None
    views_used: int
    is_active: bool
    share_url: str


class ShareAccessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    token: str
    media_id: int
    media_name: str
    media_type: str
    file_url: str
    expires_at: datetime | None
    max_views: int | None
    views_used: int
