from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.media import Media
from app.models.user import User
from app.services.media_service import (
    extract_image_metadata,
    extract_video_metadata,
    generate_image_thumbnail,
    generate_video_thumbnail,
)
from app.services.media_storage import (
    TEMP_DIR,
    delete_from_r2,
    generate_storage_filename,
    upload_to_r2,
)


def process_uploaded_media(
    source_path: Path,
    original_name: str,
    mime_type: str,
    total_size: int,
    visibility: str,
    group_id: int | None,
    current_user: User,
    db: Session,
) -> Media:
    if total_size <= 0 or total_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail="File size is invalid or exceeds the upload limit.",
        )

    if mime_type.startswith("image/"):
        media_type = "image"
        metadata = extract_image_metadata(source_path)
        width = metadata["width"]
        height = metadata["height"]
        duration = None
        taken_at = metadata["taken_at"]
    elif mime_type.startswith("video/"):
        media_type = "video"
        metadata = extract_video_metadata(source_path)
        width = metadata["width"]
        height = metadata["height"]
        duration = metadata["duration"]
        taken_at = None
    else:
        raise HTTPException(
            status_code=415,
            detail="Unsupported media type.",
        )

    stored_filename = generate_storage_filename(
        Path(original_name).suffix
    )
    thumbnail_filename = f"{Path(stored_filename).stem}.webp"
    thumbnail_path = TEMP_DIR / thumbnail_filename

    try:
        if media_type == "image":
            generate_image_thumbnail(source_path, thumbnail_path)
        else:
            generate_video_thumbnail(source_path, thumbnail_path)
    except Exception:
        thumbnail_path.unlink(missing_ok=True)
        thumbnail_path = None

    original_key = f"originals/{stored_filename}"
    try:
        upload_to_r2(
            local_path=source_path,
            object_key=original_key,
            content_type=mime_type,
        )
    except Exception as exc:
        if thumbnail_path:
            thumbnail_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to upload media to storage.",
        ) from exc

    thumbnail_key = None
    if thumbnail_path:
        thumbnail_key = f"thumbnails/{thumbnail_filename}"
        try:
            upload_to_r2(
                local_path=thumbnail_path,
                object_key=thumbnail_key,
                content_type="image/webp",
            )
        except Exception as exc:
            delete_from_r2(original_key)
            thumbnail_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=500,
                detail="Failed to upload thumbnail to storage.",
            ) from exc
        finally:
            thumbnail_path.unlink(missing_ok=True)

    media = Media(
        filename=stored_filename,
        original_name=original_name,
        media_type=media_type,
        mime_type=mime_type,
        file_path=original_key,
        thumbnail_path=thumbnail_key,
        file_size=total_size,
        width=width,
        height=height,
        duration=duration,
        taken_at=taken_at,
        owner_id=current_user.id,
        visibility=visibility,
        group_id=group_id,
    )

    try:
        db.add(media)
        db.commit()
        db.refresh(media)
    except Exception as exc:
        db.rollback()
        delete_from_r2(original_key)
        if thumbnail_key:
            delete_from_r2(thumbnail_key)
        raise HTTPException(
            status_code=500,
            detail="Failed to save uploaded media.",
        ) from exc

    media.thumbnail_url = f"/api/media/{media.id}/thumbnail"
    media.file_url = f"/api/media/{media.id}/file"
    return media
