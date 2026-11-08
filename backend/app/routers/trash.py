from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.media import Media
from app.models.media_favorite import MediaFavorite
from app.models.user import User
from app.schemas.media import TrashListResponse, TrashMediaResponse
from app.services.media_storage import delete_from_r2


router = APIRouter(
    prefix="/api/trash",
    tags=["Trash"],
)


def get_trashed_media(
    media_id: int,
    current_user: User,
    db: Session,
) -> Media:
    media = db.scalar(
        select(Media).where(
            Media.id == media_id,
            Media.deleted_by_id == current_user.id,
            Media.deleted_at.is_not(None),
        )
    )

    if media is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Trashed media not found.",
        )

    return media


def permanently_delete_media(
    media: Media,
    db: Session,
) -> None:
    if media.file_path:
        delete_from_r2(media.file_path)

    if media.thumbnail_path:
        delete_from_r2(media.thumbnail_path)

    db.execute(
        delete(MediaFavorite).where(
            MediaFavorite.media_id == media.id,
        )
    )
    db.delete(media)
    db.commit()


@router.get(
    "",
    response_model=TrashListResponse,
)
def list_trash(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_filter = (
        Media.deleted_by_id == current_user.id,
        Media.deleted_at.is_not(None),
    )
    total = db.scalar(
        select(func.count()).select_from(Media).where(*base_filter)
    ) or 0

    trashed_items = db.scalars(
        select(Media)
        .where(*base_filter)
        .order_by(Media.deleted_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    return TrashListResponse(
        items=[
            TrashMediaResponse(
                id=item.id,
                original_name=item.original_name,
                media_type=item.media_type,
                file_size=item.file_size,
                deleted_at=item.deleted_at,
                purge_after=item.deleted_at + timedelta(
                    days=settings.trash_retention_days,
                ),
            )
            for item in trashed_items
        ],
        total=total,
        page=page,
        limit=limit,
        has_next=page * limit < total,
        retention_days=settings.trash_retention_days,
    )


@router.post(
    "/{media_id}/restore",
    status_code=status.HTTP_204_NO_CONTENT,
)
def restore_media(
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    media = get_trashed_media(media_id, current_user, db)
    retention_deadline = media.deleted_at + timedelta(
        days=settings.trash_retention_days,
    )
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if retention_deadline <= now:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="The retention period has expired; this media can no longer be restored.",
        )

    media.deleted_at = None
    media.deleted_by_id = None
    db.commit()
    return None


@router.delete(
    "/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def permanently_delete_trashed_media(
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    media = get_trashed_media(media_id, current_user, db)
    permanently_delete_media(media, db)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
)
def empty_trash(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trashed_items = db.scalars(
        select(Media).where(
            Media.deleted_by_id == current_user.id,
            Media.deleted_at.is_not(None),
        )
    ).all()

    for media in trashed_items:
        permanently_delete_media(media, db)
