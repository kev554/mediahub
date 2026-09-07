from datetime import datetime

from pydantic import BaseModel, ConfigDict


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
class MediaAlbumRequest(BaseModel):
    album_id: int
