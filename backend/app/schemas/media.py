from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MediaResponse(BaseModel):

    model_config = ConfigDict(
        from_attributes=True
    )
     
    id: int
    filename: str
    original_name: str
    media_type: str
    mime_type: str
    
    file_size: int

    width: int | None
    height: int | None
    duration: float | None

    taken_at: datetime | None
    uploaded_at: datetime

    album_id: int | None
    visibility: str
    group_id: int | None
    is_favorite: bool
    thumbnail_url: str | None = None
    file_url: str | None = None


class MediaListResponse(BaseModel):

    items: list[MediaResponse]

    total: int
    page: int
    limit: int

    has_next: bool


class TrashMediaResponse(BaseModel):
    id: int
    original_name: str
    media_type: str
    file_size: int
    deleted_at: datetime
    purge_after: datetime


class TrashListResponse(BaseModel):
    items: list[TrashMediaResponse]
    total: int
    page: int
    limit: int
    has_next: bool
    retention_days: int


class MediaAlbumRequest(BaseModel):
    album_id: int


class ResumableUploadCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    file_size: int = Field(gt=0)
    mime_type: str = Field(min_length=1, max_length=100)
    visibility: str = "private"
    group_id: int | None = Field(default=None, ge=1)


class ResumableUploadStatus(BaseModel):
    upload_id: str
    offset: int
    file_size: int
    expires_at: datetime
    completed: bool = False
