import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.media import Media
from app.models.share_link import MediaShare
from app.models.user import User
from app.schemas.share_link import (
    ShareAccessResponse,
    ShareLinkCreateRequest,
    ShareLinkResponse,
)
from app.services.media_permissions import can_manage_group
from app.services.media_storage import stream_from_r2
from fastapi.responses import StreamingResponse

router = APIRouter(
    prefix="/api/shares",
    tags=["Shares"],
)


def _share_is_valid(share: MediaShare, now: datetime | None = None) -> bool:
    current_time = now or datetime.utcnow()

    if not share.is_active:
        return False

    if share.expires_at and share.expires_at <= current_time:
        return False

    if share.max_views is not None and share.views_used >= share.max_views:
        return False

    return True


def _to_share_response(share: MediaShare) -> ShareLinkResponse:
    return ShareLinkResponse(
        id=share.id,
        media_id=share.media_id,
        token=share.token,
        note=share.note,
        created_at=share.created_at,
        expires_at=share.expires_at,
        max_views=share.max_views,
        views_used=share.views_used,
        is_active=share.is_active,
        share_url=f"/api/shares/open/{share.token}",
    )


@router.post(
    "/media/{media_id}",
    response_model=ShareLinkResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_media_share(
    media_id: int,
    payload: ShareLinkCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    media = db.get(Media, media_id)

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    if media.deleted_at is not None:
        raise HTTPException(
            status_code=404,
            detail="This media is in the trash and cannot be shared.",
        )

    is_owner = media.owner_id == current_user.id
    is_group_manager = (
        media.group_id is not None
        and can_manage_group(media.group_id, current_user.id, db)
    )

    if not is_owner and not is_group_manager:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to share this media.",
        )

    expires_at = None
    if payload.expires_in_hours is not None:
        expires_at = datetime.utcnow() + timedelta(hours=payload.expires_in_hours)

    token = secrets.token_urlsafe(32)

    while db.query(MediaShare).filter(MediaShare.token == token).first():
        token = secrets.token_urlsafe(32)

    share = MediaShare(
        media_id=media.id,
        owner_id=current_user.id,
        token=token,
        note=payload.note,
        expires_at=expires_at,
        max_views=payload.max_views,
        is_active=True,
    )

    db.add(share)
    db.commit()
    db.refresh(share)

    return _to_share_response(share)


@router.get("", response_model=list[ShareLinkResponse])
def list_user_shares(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    shares = (
        db.query(MediaShare)
        .filter(MediaShare.owner_id == current_user.id)
        .order_by(MediaShare.created_at.desc())
        .all()
    )

    return [_to_share_response(share) for share in shares]


@router.delete("/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_share(
    share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    share = db.get(MediaShare, share_id)

    if not share:
        raise HTTPException(
            status_code=404,
            detail="Share link not found.",
        )

    if share.owner_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot revoke this share link.",
        )

    share.is_active = False
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/open/{token}", response_model=ShareAccessResponse)
def open_shared_media(
    token: str,
    db: Session = Depends(get_db),
):
    share = db.query(MediaShare).filter(MediaShare.token == token).first()

    if not share:
        raise HTTPException(
            status_code=404,
            detail="This share link does not exist.",
        )

    if not _share_is_valid(share):
        raise HTTPException(
            status_code=410,
            detail="This share link is no longer valid.",
        )

    media = db.get(Media, share.media_id)

    if not media or media.deleted_at is not None:
        raise HTTPException(
            status_code=404,
            detail="The shared media is unavailable.",
        )

    return ShareAccessResponse(
        token=share.token,
        media_id=media.id,
        media_name=media.original_name,
        media_type=media.media_type,
        file_url=f"/api/shares/open/{share.token}/file",
        expires_at=share.expires_at,
        max_views=share.max_views,
        views_used=share.views_used,
    )


@router.get("/open/{token}/file")
def open_shared_media_file(
    token: str,
    db: Session = Depends(get_db),
):
    share = db.query(MediaShare).filter(MediaShare.token == token).first()

    if not share:
        raise HTTPException(
            status_code=404,
            detail="This share link does not exist.",
        )

    if not _share_is_valid(share):
        raise HTTPException(
            status_code=410,
            detail="This share link is no longer valid.",
        )

    media = db.get(Media, share.media_id)

    if not media or media.deleted_at is not None:
        raise HTTPException(
            status_code=404,
            detail="The shared media is unavailable.",
        )

    if share.max_views is not None and share.views_used >= share.max_views:
        share.is_active = False
        db.commit()
        raise HTTPException(
            status_code=410,
            detail="This share link has reached its maximum number of views.",
        )

    file_data = stream_from_r2(media.file_path)

    share.views_used += 1
    if share.max_views is not None and share.views_used >= share.max_views:
        share.is_active = False

    db.commit()

    return StreamingResponse(
        file_data,
        media_type=media.mime_type,
        headers={
            "Content-Disposition": (
                f'inline; filename="{media.original_name}"'
            )
        },
    )
