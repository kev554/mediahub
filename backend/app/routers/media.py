import json
import hashlib
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import Response, StreamingResponse

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.config import settings
from app.db.database import get_db

from app.models.album import Album
from app.models.group import group_members
from app.models.media import Media
from app.models.media_favorite import MediaFavorite
from app.models.user import User

from app.schemas.media import (
    MediaAlbumRequest,
    MediaListResponse,
    MediaResponse,
    ResumableUploadCreate,
    ResumableUploadStatus,
)

from app.services.media_permissions import (
    can_manage_group,
    can_manage_media,
    get_accessible_media,
)

from app.services.media_service import (
    extract_image_metadata,
    extract_video_metadata,
    generate_image_thumbnail,
    generate_video_thumbnail,
)

from app.services.media_storage import (
    TEMP_DIR,
    create_media_url,
    delete_from_r2,
    generate_storage_filename,
    stream_from_r2,
    upload_to_r2,
)
from app.services.media_upload import process_uploaded_media


router = APIRouter(
    prefix="/api/media",
    tags=["Media"],
)


# ============================================================
# CONFIGURATION
# ============================================================

ALLOWED_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-matroska",
}
RESUMABLE_CHUNK_SIZE = 8 * 1024 * 1024
RESUMABLE_UPLOAD_TTL = timedelta(hours=24)
RESUMABLE_UPLOAD_ID_PATTERN = re.compile(r"^[a-f0-9]{32}$")


def _resumable_upload_paths(upload_id: str) -> tuple[Path, Path]:
    if not RESUMABLE_UPLOAD_ID_PATTERN.fullmatch(upload_id):
        raise HTTPException(
            status_code=404,
            detail="Resumable upload not found.",
        )

    upload_dir = TEMP_DIR / "resumable"
    return upload_dir / f"{upload_id}.part", upload_dir / f"{upload_id}.json"


def _get_resumable_upload(
    upload_id: str,
    user_id: int,
) -> tuple[dict, Path, Path]:
    data_path, metadata_path = _resumable_upload_paths(upload_id)

    if not metadata_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Resumable upload not found.",
        )

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        expires_at = datetime.fromisoformat(metadata["expires_at"])
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Resumable upload metadata is invalid.",
        ) from exc

    if metadata.get("owner_id") != user_id:
        raise HTTPException(
            status_code=404,
            detail="Resumable upload not found.",
        )

    if expires_at <= datetime.now(timezone.utc):
        data_path.unlink(missing_ok=True)
        metadata_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=410,
            detail="Resumable upload has expired.",
        )

    return metadata, data_path, metadata_path


def _save_resumable_metadata(metadata_path: Path, metadata: dict) -> None:
    temporary_path = metadata_path.with_suffix(".tmp")
    temporary_path.write_text(
        json.dumps(metadata),
        encoding="utf-8",
    )
    temporary_path.replace(metadata_path)


@router.post(
    "/upload/resumable",
    response_model=ResumableUploadStatus,
    status_code=status.HTTP_201_CREATED,
)
def create_resumable_upload(
    payload: ResumableUploadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail="File is too large.",
        )

    if payload.mime_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type: {payload.mime_type}",
        )

    filename = payload.filename.replace("\\", "/").split("/")[-1].strip()
    if not filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required.",
        )

    if payload.visibility not in {"private", "group"}:
        raise HTTPException(
            status_code=400,
            detail="Visibility must be 'private' or 'group'.",
        )

    group_id = payload.group_id
    if payload.visibility == "private":
        group_id = None
    elif group_id is None:
        raise HTTPException(
            status_code=400,
            detail="group_id is required when visibility is 'group'.",
        )
    elif not can_manage_group(group_id, current_user.id, db):
        raise HTTPException(
            status_code=403,
            detail="Only group managers can upload group media.",
        )

    upload_dir = TEMP_DIR / "resumable"
    upload_dir.mkdir(parents=True, exist_ok=True)
    upload_id = uuid4().hex
    data_path, metadata_path = _resumable_upload_paths(upload_id)
    expires_at = datetime.now(timezone.utc) + RESUMABLE_UPLOAD_TTL
    metadata = {
        "owner_id": current_user.id,
        "filename": filename,
        "file_size": payload.file_size,
        "mime_type": payload.mime_type,
        "visibility": payload.visibility,
        "group_id": group_id,
        "expires_at": expires_at.isoformat(),
    }

    data_path.touch(exist_ok=False)
    try:
        _save_resumable_metadata(metadata_path, metadata)
    except OSError:
        data_path.unlink(missing_ok=True)
        raise

    return ResumableUploadStatus(
        upload_id=upload_id,
        offset=0,
        file_size=payload.file_size,
        expires_at=expires_at,
    )


@router.get(
    "/upload/resumable/{upload_id}",
    response_model=ResumableUploadStatus,
)
def get_resumable_upload_status(
    upload_id: str,
    current_user: User = Depends(get_current_user),
):
    metadata, data_path, _ = _get_resumable_upload(
        upload_id,
        current_user.id,
    )
    expires_at = datetime.fromisoformat(metadata["expires_at"])

    return ResumableUploadStatus(
        upload_id=upload_id,
        offset=data_path.stat().st_size if data_path.exists() else 0,
        file_size=metadata["file_size"],
        expires_at=expires_at,
        completed=metadata.get("completed_media_id") is not None,
    )


@router.put("/upload/resumable/{upload_id}/chunk")
async def upload_resumable_chunk(
    upload_id: str,
    request: Request,
    offset: int = Query(ge=0),
    current_user: User = Depends(get_current_user),
):
    metadata, data_path, _ = _get_resumable_upload(
        upload_id,
        current_user.id,
    )

    if metadata.get("completed_media_id") is not None:
        raise HTTPException(
            status_code=409,
            detail="Resumable upload is already complete.",
        )

    current_offset = data_path.stat().st_size if data_path.exists() else 0
    if offset != current_offset:
        raise HTTPException(
            status_code=409,
            detail=f"Upload offset mismatch. Expected {current_offset}.",
        )

    written = 0
    succeeded = False
    try:
        with data_path.open("r+b") as output:
            output.seek(offset)
            async for chunk in request.stream():
                if not chunk:
                    continue

                written += len(chunk)
                if written > RESUMABLE_CHUNK_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Chunk exceeds the 8 MiB upload limit.",
                    )

                if offset + written > metadata["file_size"]:
                    raise HTTPException(
                        status_code=413,
                        detail="Chunk exceeds the declared file size.",
                    )

                output.write(chunk)

            if written == 0:
                raise HTTPException(
                    status_code=400,
                    detail="Upload chunk must not be empty.",
                )

            output.flush()
            succeeded = True
    finally:
        if not succeeded:
            with data_path.open("r+b") as output:
                output.truncate(offset)

    return {
        "upload_id": upload_id,
        "offset": offset + written,
        "file_size": metadata["file_size"],
    }


@router.post(
    "/upload/resumable/{upload_id}/complete",
    response_model=MediaResponse,
    status_code=status.HTTP_201_CREATED,
)
def complete_resumable_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    metadata, data_path, metadata_path = _get_resumable_upload(
        upload_id,
        current_user.id,
    )

    completed_media_id = metadata.get("completed_media_id")
    if completed_media_id is not None:
        media = db.get(Media, completed_media_id)
        if media is None or media.owner_id != current_user.id:
            raise HTTPException(
                status_code=404,
                detail="Completed media is no longer available.",
            )
        media.thumbnail_url = f"/api/media/{media.id}/thumbnail"
        media.file_url = f"/api/media/{media.id}/file"
        return media

    actual_size = data_path.stat().st_size if data_path.exists() else 0
    if actual_size != metadata["file_size"]:
        raise HTTPException(
            status_code=409,
            detail=f"Upload is incomplete. Received {actual_size} of {metadata['file_size']} bytes.",
        )

    group_id = metadata["group_id"]
    if metadata["visibility"] == "group" and not can_manage_group(
        group_id,
        current_user.id,
        db,
    ):
        raise HTTPException(
            status_code=403,
            detail="Only group managers can upload group media.",
        )

    media = process_uploaded_media(
        source_path=data_path,
        original_name=metadata["filename"],
        mime_type=metadata["mime_type"],
        total_size=metadata["file_size"],
        visibility=metadata["visibility"],
        group_id=group_id,
        current_user=current_user,
        db=db,
    )

    metadata["completed_media_id"] = media.id
    _save_resumable_metadata(metadata_path, metadata)
    data_path.unlink(missing_ok=True)
    return media


@router.delete(
    "/upload/resumable/{upload_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def cancel_resumable_upload(
    upload_id: str,
    current_user: User = Depends(get_current_user),
):
    _, data_path, metadata_path = _get_resumable_upload(
        upload_id,
        current_user.id,
    )
    data_path.unlink(missing_ok=True)
    metadata_path.unlink(missing_ok=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# ============================================================
# UPLOAD MEDIA
# ============================================================

@router.post(
    "/upload",
    response_model=MediaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_media(
    file: UploadFile = File(...),
    visibility: str = Form("private"),
    group_id: int | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # Vérification du partage
    # --------------------------------------------------------

    if visibility not in {"private", "group"}:
        raise HTTPException(
            status_code=400,
            detail="Visibility must be 'private' or 'group'.",
        )

    if visibility == "private":
        group_id = None

    if visibility == "group":
        if group_id is None:
            raise HTTPException(
                status_code=400,
                detail="group_id is required when visibility is 'group'.",
            )

        if not can_manage_group(group_id, current_user.id, db):
            raise HTTPException(
                status_code=403,
                detail="Only group managers can upload group media.",
            )

    # --------------------------------------------------------
    # Vérification du nom
    # --------------------------------------------------------

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Filename is required.",
        )

    # --------------------------------------------------------
    # Vérification du type MIME
    # --------------------------------------------------------

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported media type: "
                f"{file.content_type}"
            ),
        )

    # --------------------------------------------------------
    # Génération d'un nom sécurisé
    # --------------------------------------------------------

    extension = Path(file.filename).suffix

    stored_filename = generate_storage_filename(
        extension
    )

    # --------------------------------------------------------
    # Fichier temporaire local
    # --------------------------------------------------------

    destination = TEMP_DIR / stored_filename

    # --------------------------------------------------------
    # Upload par morceaux vers fichier temporaire
    # --------------------------------------------------------

    total_size = 0

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > settings.max_file_size_bytes:
                    destination.unlink(
                        missing_ok=True
                    )

                    raise HTTPException(
                        status_code=413,
                        detail="File is too large.",
                    )

                output.write(chunk)

    except HTTPException:
        raise

    except Exception as exc:
        destination.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to save media.",
        ) from exc

    # --------------------------------------------------------
    # Détermination du type
    # --------------------------------------------------------

    if file.content_type.startswith("image/"):
        media_type = "image"

    elif file.content_type.startswith("video/"):
        media_type = "video"

    else:
        destination.unlink(
            missing_ok=True
        )

        raise HTTPException(
            status_code=415,
            detail="Unsupported media type.",
        )

    # --------------------------------------------------------
    # Métadonnées
    # --------------------------------------------------------

    width = None
    height = None
    duration = None
    taken_at = None

    if media_type == "image":
        metadata = extract_image_metadata(
            destination
        )

        width = metadata["width"]
        height = metadata["height"]
        taken_at = metadata["taken_at"]

    elif media_type == "video":
        metadata = extract_video_metadata(
            destination
        )

        width = metadata["width"]
        height = metadata["height"]
        duration = metadata["duration"]

    # --------------------------------------------------------
    # Génération miniature
    # --------------------------------------------------------

    thumbnail_filename = (
        Path(stored_filename).stem
        + ".webp"
    )

    thumbnail_path = (
        TEMP_DIR
        / thumbnail_filename
    )

    try:
        if media_type == "image":
            generate_image_thumbnail(
                destination,
                thumbnail_path,
            )

        elif media_type == "video":
            generate_video_thumbnail(
                destination,
                thumbnail_path,
            )

    except Exception:
        thumbnail_path.unlink(
            missing_ok=True
        )

        thumbnail_path = None

    # --------------------------------------------------------
    # Upload original vers R2
    # --------------------------------------------------------

    original_key = (
        f"originals/{stored_filename}"
    )

    try:
        upload_to_r2(
            local_path=destination,
            object_key=original_key,
            content_type=file.content_type,
        )

    except Exception as exc:
        destination.unlink(
            missing_ok=True
        )

        if thumbnail_path:
            thumbnail_path.unlink(
                missing_ok=True
            )

        raise HTTPException(
            status_code=500,
            detail="Failed to upload media to storage.",
        ) from exc

    # --------------------------------------------------------
    # Upload miniature vers R2
    # --------------------------------------------------------

    thumbnail_key = None

    if thumbnail_path:
        thumbnail_key = (
            f"thumbnails/{thumbnail_filename}"
        )

        try:
            upload_to_r2(
                local_path=thumbnail_path,
                object_key=thumbnail_key,
                content_type="image/webp",
            )

        except Exception as exc:
            delete_from_r2(
                original_key
            )

            destination.unlink(
                missing_ok=True
            )

            thumbnail_path.unlink(
                missing_ok=True
            )

            raise HTTPException(
                status_code=500,
                detail="Failed to upload thumbnail to storage.",
            ) from exc

    # --------------------------------------------------------
    # Nettoyage des fichiers temporaires
    # --------------------------------------------------------

    destination.unlink(
        missing_ok=True
    )

    if thumbnail_path:
        thumbnail_path.unlink(
            missing_ok=True
        )

    # --------------------------------------------------------
    # Création objet Media
    # --------------------------------------------------------

    media = Media(
        filename=stored_filename,
        original_name=file.filename,
        media_type=media_type,
        mime_type=file.content_type,

        # IMPORTANT :
        # On stocke maintenant les clés R2
        # et non plus les chemins Linux.
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

    # --------------------------------------------------------
    # PostgreSQL
    # --------------------------------------------------------

    db.add(media)
    db.commit()
    db.refresh(media)

    # --------------------------------------------------------
    # URLs publiques via l'API MediaHub
    # --------------------------------------------------------

    media.thumbnail_url = f"/api/media/{media.id}/thumbnail"
    media.file_url = f"/api/media/{media.id}/file"

    return media

# ============================================================
# LIST MEDIA
# ============================================================

@router.get(
    "",
    response_model=MediaListResponse,
)
def list_media(
    page: int = Query(
        1,
        ge=1,
    ),
    limit: int | None = Query(
        None,
        ge=1,
    ),
    media_type: str | None = Query(
        None,
        pattern="^(image|video)$",
    ),
    search: str | None = Query(
        None,
        min_length=1,
        max_length=100,
    ),
    favorite: bool | None = Query(
        None,
    ),
    year: int | None = Query(
        None,
        ge=1900,
        le=2100,
    ),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    visibility: str | None = Query(
        None,
        pattern="^(private|group)$",
    ),
    album_id: int | None = Query(
        None,
        ge=1,
    ),
    group_id: int | None = Query(
        None,
        ge=1,
    ),
    sort: str | None = Query(
        None,
        pattern="^(uploaded_at|taken_at|original_name)$",
    ),
    direction: str | None = Query(
        None,
        pattern="^(asc|desc)$",
    ),
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="Start date must not be after end date.",
        )

    # --------------------------------------------------------
    # GROUPES DE L'UTILISATEUR
    # --------------------------------------------------------

    user_group_ids = select(
        group_members.c.group_id
    ).where(
        group_members.c.user_id == current_user.id
    )

    # --------------------------------------------------------
    # MÉDIAS ACCESSIBLES
    # --------------------------------------------------------

    accessible_media = (
        (
            (Media.visibility == "private")
            & (Media.owner_id == current_user.id)
        )
        |
        (
            (Media.visibility == "group")
            &
            (
                Media.group_id.in_(
                    user_group_ids
                )
            )
        )
    )

    query = select(Media).where(
        accessible_media,
        Media.deleted_at.is_(None),
    )

    # --------------------------------------------------------
    # TYPE
    # --------------------------------------------------------

    if media_type:
        query = query.where(
            Media.media_type == media_type
        )

    # --------------------------------------------------------
    # RECHERCHE
    # --------------------------------------------------------

    search_pattern = None

    if search:
        search_pattern = (
            f"%{search.strip()}%"
        )

        query = query.where(
            or_(
                Media.original_name.ilike(
                    search_pattern
                ),
                Media.filename.ilike(
                    search_pattern
                ),
                Media.mime_type.ilike(
                    search_pattern
                ),
            )
        )

    # --------------------------------------------------------
    # VISIBILITÉ / ALBUM / GROUPE
    # --------------------------------------------------------

    if visibility:
        query = query.where(
            Media.visibility == visibility
        )

    if album_id is not None:
        query = query.where(
            Media.album_id == album_id
        )

    if group_id is not None:
        query = query.where(
            Media.group_id == group_id
        )

    # --------------------------------------------------------
    # FAVORIS
    # --------------------------------------------------------

    favorite_media_ids = None

    if favorite is True:
        favorite_media_ids = select(
            MediaFavorite.media_id
        ).where(
            MediaFavorite.user_id
            == current_user.id
        )

        query = query.where(
            Media.id.in_(
                favorite_media_ids
            )
        )

    # --------------------------------------------------------
    # ANNÉE
    # --------------------------------------------------------

    if year:
        query = query.where(
            func.extract(
                "year",
                func.coalesce(Media.taken_at, Media.uploaded_at),
            ) == year
        )

    media_date = func.coalesce(Media.taken_at, Media.uploaded_at)
    if start_date:
        query = query.where(media_date >= start_date)
    if end_date:
        query = query.where(media_date < end_date + timedelta(days=1))

    # --------------------------------------------------------
    # TOTAL
    # --------------------------------------------------------

    count_query = (
        select(func.count())
        .select_from(Media)
        .where(
            accessible_media,
            Media.deleted_at.is_(None),
        )
    )

    if media_type:
        count_query = count_query.where(
            Media.media_type == media_type
        )

    if search_pattern:
        count_query = count_query.where(
            or_(
                Media.original_name.ilike(
                    search_pattern
                ),
                Media.filename.ilike(
                    search_pattern
                ),
                Media.mime_type.ilike(
                    search_pattern
                ),
            )
        )

    if visibility:
        count_query = count_query.where(
            Media.visibility == visibility
        )

    if album_id is not None:
        count_query = count_query.where(
            Media.album_id == album_id
        )

    if group_id is not None:
        count_query = count_query.where(
            Media.group_id == group_id
        )

    if favorite_media_ids is not None:
        count_query = count_query.where(
            Media.id.in_(
                favorite_media_ids
            )
        )

    if year:
        count_query = count_query.where(
            func.extract(
                "year",
                func.coalesce(Media.taken_at, Media.uploaded_at),
            ) == year
        )

    if start_date:
        count_query = count_query.where(media_date >= start_date)
    if end_date:
        count_query = count_query.where(media_date < end_date + timedelta(days=1))

    total = db.scalar(
        count_query
    ) or 0

    # --------------------------------------------------------
    # TRI
    # --------------------------------------------------------

    order_column = Media.uploaded_at.desc()

    if sort == "taken_at":
        order_column = Media.taken_at.desc().nullslast()
    elif sort == "original_name":
        order_column = Media.original_name.asc()
    elif sort == "uploaded_at":
        order_column = Media.uploaded_at.desc()

    if direction == "asc":
        if sort == "taken_at":
            order_column = Media.taken_at.asc().nullslast()
        elif sort == "original_name":
            order_column = Media.original_name.asc()
        elif sort == "uploaded_at":
            order_column = Media.uploaded_at.asc()

    query = query.order_by(order_column)

    # --------------------------------------------------------
    # PAGINATION
    # --------------------------------------------------------

    if limit is not None:
        offset = (
            (page - 1)
            * limit
        )

        query = (
            query
            .offset(offset)
            .limit(limit)
        )

    else:
        offset = 0

    # --------------------------------------------------------
    # RÉSULTATS
    # --------------------------------------------------------

    media_items = db.scalars(
        query
    ).all()

    # --------------------------------------------------------
    # CONSTRUCTION
    # --------------------------------------------------------

    items = []

    for media in media_items:
        item = MediaResponse.model_validate(
            media
        )

        favorite_exists = db.scalar(
            select(MediaFavorite).where(
                MediaFavorite.user_id
                == current_user.id,
                MediaFavorite.media_id
                == media.id,
            )
        )

        item.is_favorite = (
            favorite_exists is not None
        )

        item.thumbnail_url = (
            f"/api/media/{media.id}/thumbnail"
        )

        item.file_url = (
            f"/api/media/{media.id}/file"
        )

        items.append(item)

    return MediaListResponse(
        items=items,
        total=total,
        page=page,
        limit=(
            limit
            if limit is not None
            else len(items)
        ),
        has_next=(
            limit is not None
            and offset + len(items) < total
        ),
    )


@router.get("/duplicates")
def find_duplicate_media(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    media_items = db.scalars(
        select(Media)
        .where(
            Media.owner_id == current_user.id,
            Media.deleted_at.is_(None),
        )
        .order_by(Media.id.asc())
    ).all()

    by_size: dict[int, list[Media]] = {}
    for media in media_items:
        by_size.setdefault(media.file_size, []).append(media)

    by_digest: dict[str, list[Media]] = {}
    favorite_ids = set(
        db.scalars(
            select(MediaFavorite.media_id).where(
                MediaFavorite.user_id == current_user.id,
            )
        ).all()
    )
    for same_size_items in by_size.values():
        if len(same_size_items) < 2:
            continue

        for media in same_size_items:
            digest = hashlib.sha256()
            for chunk in stream_from_r2(media.file_path):
                digest.update(chunk)
            by_digest.setdefault(digest.hexdigest(), []).append(media)

    return [
        {
            "checksum": checksum,
            "file_size": duplicates[0].file_size,
            "items": [
                {
                    "id": item.id,
                    "filename": item.filename,
                    "original_name": item.original_name,
                    "media_type": item.media_type,
                    "mime_type": item.mime_type,
                    "file_size": item.file_size,
                    "width": item.width,
                    "height": item.height,
                    "duration": item.duration,
                    "taken_at": item.taken_at,
                    "uploaded_at": item.uploaded_at,
                    "album_id": item.album_id,
                    "visibility": item.visibility,
                    "group_id": item.group_id,
                    "is_favorite": item.id in favorite_ids,
                    "thumbnail_url": f"/api/media/{item.id}/thumbnail",
                    "file_url": f"/api/media/{item.id}/file",
                }
                for item in duplicates
            ],
        }
        for checksum, duplicates in by_digest.items()
        if len(duplicates) > 1
    ]


# ============================================================
# BULK DELETE MEDIA
#
# IMPORTANT :
# Cette route est placée AVANT /{media_id}
# pour éviter que "bulk-delete" soit interprété
# comme un identifiant numérique.
# ============================================================

@router.delete(
    "/bulk-delete",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_multiple_media(
    ids: list[int] = Body(...),
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # Vérification de la liste
    # --------------------------------------------------------

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="No media selected.",
        )

    # --------------------------------------------------------
    # Supprimer les doublons
    # --------------------------------------------------------

    unique_ids = list(
        dict.fromkeys(ids)
    )

    # --------------------------------------------------------
    # Récupérer les médias
    # --------------------------------------------------------

    media_items = db.scalars(
        select(Media).where(
            Media.id.in_(unique_ids),
            Media.deleted_at.is_(None),
        )
    ).all()

    found_ids = {
        media.id
        for media in media_items
    }

    # --------------------------------------------------------
    # Vérifier que tous les médias existent
    # --------------------------------------------------------

    if len(found_ids) != len(unique_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more media were not found.",
        )

    # --------------------------------------------------------
    # Vérifier les permissions AVANT toute suppression
    # --------------------------------------------------------

    for media in media_items:
        if not can_manage_media(
            media=media,
            user=current_user,
            db=db,
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have permission "
                    "to delete one or more selected media."
                ),
            )

    # --------------------------------------------------------
    # Suppression des fichiers
    # --------------------------------------------------------

    deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    for media in media_items:
        media.deleted_at = deleted_at
        media.deleted_by_id = current_user.id

    # --------------------------------------------------------
    # UN SEUL COMMIT
    # --------------------------------------------------------

    db.commit()

    return None


# ============================================================
# SHARED MEDIA
# ============================================================

@router.get(
    "/shared",
)
def get_shared_media(
    search: str | None = Query(None, min_length=1, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
):
    user_group_ids = select(
        group_members.c.group_id
    ).where(
        group_members.c.user_id == current_user.id
    )

    query = (
        db.query(Media)
        .filter(
            Media.visibility == "group",
            Media.group_id.in_(
                user_group_ids
            ),
            Media.deleted_at.is_(None),
        )
        .order_by(
            Media.taken_at.desc().nullslast(),
            Media.uploaded_at.desc(),
        )
    )

    if search:
        query = query.filter(Media.original_name.ilike(f"%{search.strip()}%"))

    return query.all()


# ============================================================
# TIMELINE
# ============================================================

@router.get(
    "/timeline",
    response_model=MediaListResponse,
)
def get_timeline(
    page: int = Query(
        1,
        ge=1,
    ),
    limit: int = Query(
        30,
        ge=1,
        le=100,
    ),
    year: int | None = Query(
        None,
        ge=1900,
        le=2100,
    ),
    media_type: str | None = Query(
        None,
        pattern="^(image|video)$",
    ),
    search: str | None = Query(
        None,
        min_length=1,
        max_length=100,
    ),
    favorite: bool | None = Query(
        None,
    ),
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # GROUPES DE L'UTILISATEUR
    # --------------------------------------------------------

    user_group_ids = select(
        group_members.c.group_id
    ).where(
        group_members.c.user_id == current_user.id
    )

    # --------------------------------------------------------
    # MÉDIAS ACCESSIBLES
    # --------------------------------------------------------

    accessible_media = (
        (
            (Media.visibility == "private")
            & (Media.owner_id == current_user.id)
        )
        |
        (
            (Media.visibility == "group")
            &
            (
                Media.group_id.in_(
                    user_group_ids
                )
            )
        )
    )

    query = select(Media).where(
        accessible_media,
        Media.deleted_at.is_(None),
    )

    # --------------------------------------------------------
    # TYPE
    # --------------------------------------------------------

    if media_type:
        query = query.where(
            Media.media_type == media_type
        )

    # --------------------------------------------------------
    # RECHERCHE
    # --------------------------------------------------------

    search_pattern = None

    if search:
        search_pattern = (
            f"%{search.strip()}%"
        )

        query = query.where(
            Media.original_name.ilike(
                search_pattern
            )
        )

    # --------------------------------------------------------
    # FAVORIS
    #
    # IMPORTANT :
    # Les favoris sont stockés dans MediaFavorite.
    # On ne doit PAS utiliser Media.is_favorite.
    # --------------------------------------------------------

    favorite_media_ids = None

    if favorite is True:
        favorite_media_ids = select(
            MediaFavorite.media_id
        ).where(
            MediaFavorite.user_id
            == current_user.id
        )

        query = query.where(
            Media.id.in_(
                favorite_media_ids
            )
        )

    # --------------------------------------------------------
    # ANNÉE
    # --------------------------------------------------------

    if year:
        query = query.where(
            func.extract(
                "year",
                Media.taken_at,
            ) == year
        )

    # --------------------------------------------------------
    # TOTAL
    # --------------------------------------------------------

    count_query = (
        select(func.count())
        .select_from(Media)
        .where(
            accessible_media,
            Media.deleted_at.is_(None),
        )
    )

    if media_type:
        count_query = count_query.where(
            Media.media_type == media_type
        )

    if search_pattern:
        count_query = count_query.where(
            Media.original_name.ilike(
                search_pattern
            )
        )

    if favorite_media_ids is not None:
        count_query = count_query.where(
            Media.id.in_(
                favorite_media_ids
            )
        )

    if year:
        count_query = count_query.where(
            func.extract(
                "year",
                Media.taken_at,
            ) == year
        )

    total = db.scalar(
        count_query
    ) or 0

    # --------------------------------------------------------
    # TRI
    #
    # taken_at = date réelle de prise de vue
    # uploaded_at = secours
    # --------------------------------------------------------

    query = query.order_by(
        Media.taken_at.desc().nullslast(),
        Media.uploaded_at.desc(),
    )

    # --------------------------------------------------------
    # PAGINATION
    # --------------------------------------------------------

    offset = (
        (page - 1)
        * limit
    )

    query = (
        query
        .offset(offset)
        .limit(limit)
    )

    # --------------------------------------------------------
    # RÉSULTATS
    # --------------------------------------------------------

    media_items = db.scalars(
        query
    ).all()

    # --------------------------------------------------------
    # CONSTRUCTION
    # --------------------------------------------------------

    items = []

    for media in media_items:
        item = MediaResponse.model_validate(
            media
        )

        # ----------------------------------------------------
        # Favori personnel
        # ----------------------------------------------------

        favorite_exists = db.scalar(
            select(MediaFavorite).where(
                MediaFavorite.user_id
                == current_user.id,
                MediaFavorite.media_id
                == media.id,
            )
        )

        item.is_favorite = (
            favorite_exists is not None
        )

        # ----------------------------------------------------
        # URLs
        # ----------------------------------------------------

        item.thumbnail_url = (
            f"/api/media/{media.id}/thumbnail"
        )

        item.file_url = (
            f"/api/media/{media.id}/file"
        )

        items.append(item)

    return MediaListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        has_next=(
            offset + len(items)
        ) < total,
    )


# ============================================================
# MEDIA THUMBNAIL
# ============================================================

@router.get(
    "/{media_id}/thumbnail",
)
def get_thumbnail(
    media_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    media = get_accessible_media(
        media_id=media_id,
        user=current_user,
        db=db,
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    if not media.thumbnail_path:
        raise HTTPException(
            status_code=404,
            detail="Thumbnail not available.",
        )

    try:
        thumbnail_data = stream_from_r2(
            media.thumbnail_path
        )

    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="Thumbnail file not found.",
        ) from exc

    return StreamingResponse(
        thumbnail_data,
        media_type="image/webp",
    )


# ============================================================
# MEDIA FILE / DOWNLOAD
# ============================================================

@router.get("/{media_id}/stream-url")
def get_media_stream_url(
    media_id: int,
    download: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    media = get_accessible_media(
        media_id=media_id,
        user=current_user,
        db=db,
    )

    return {
        "url": create_media_url(
            media.file_path,
            media.mime_type,
            media.original_name,
            "attachment" if download else "inline",
        ),
    }


@router.get(
    "/{media_id}/file",
)
def get_media_file(
    media_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    media = get_accessible_media(
        media_id=media_id,
        user=current_user,
        db=db,
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    try:
        file_data = stream_from_r2(
            media.file_path
        )

    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail="Media file not found.",
        ) from exc

    return StreamingResponse(
        file_data,
        media_type=media.mime_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{media.original_name}"'
            )
        },
    )


# ============================================================
# ADD TO FAVORITES
# ============================================================

@router.post(
    "/{media_id}/favorite",
    response_model=MediaResponse,
)
def add_to_favorites(
    media_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # Vérifier l'accès au média
    # --------------------------------------------------------

    media = get_accessible_media(
        media_id=media_id,
        user=current_user,
        db=db,
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    # --------------------------------------------------------
    # Vérifier si le favori existe déjà
    # --------------------------------------------------------

    existing = db.scalar(
        select(MediaFavorite).where(
            MediaFavorite.user_id
            == current_user.id,
            MediaFavorite.media_id
            == media_id,
        )
    )

    if not existing:
        favorite = MediaFavorite(
            user_id=current_user.id,
            media_id=media_id,
        )

        db.add(favorite)
        db.commit()

    item = MediaResponse.model_validate(
        media
    )

    item.is_favorite = True

    item.thumbnail_url = (
        f"/api/media/{media.id}/thumbnail"
    )

    item.file_url = (
        f"/api/media/{media.id}/file"
    )

    return item


# ============================================================
# REMOVE FROM FAVORITES
# ============================================================

@router.delete(
    "/{media_id}/favorite",
    response_model=MediaResponse,
)
def remove_from_favorites(
    media_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # Vérifier l'accès au média
    # --------------------------------------------------------

    media = get_accessible_media(
        media_id=media_id,
        user=current_user,
        db=db,
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    # --------------------------------------------------------
    # Supprimer le favori personnel
    # --------------------------------------------------------

    favorite = db.scalar(
        select(MediaFavorite).where(
            MediaFavorite.user_id
            == current_user.id,
            MediaFavorite.media_id
            == media_id,
        )
    )

    if favorite:
        db.delete(favorite)
        db.commit()

    item = MediaResponse.model_validate(
        media
    )

    item.is_favorite = False

    item.thumbnail_url = (
        f"/api/media/{media.id}/thumbnail"
    )

    item.file_url = (
        f"/api/media/{media.id}/file"
    )

    return item


# ============================================================
# ADD MEDIA TO ALBUM
# ============================================================

@router.post(
    "/{media_id}/album",
    response_model=MediaResponse,
)
def add_media_to_album(
    media_id: int,
    data: MediaAlbumRequest,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # Vérifier le média
    # --------------------------------------------------------

    media = get_accessible_media(
        media_id=media_id,
        user=current_user,
        db=db,
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    # --------------------------------------------------------
    # Vérifier l'album
    # --------------------------------------------------------

    album = db.scalar(
        select(Album).where(
            Album.id == data.album_id,
        )
    )

    if not album:
        raise HTTPException(
            status_code=404,
            detail="Album not found.",
        )

    # ========================================================
    # ALBUM PRIVÉ
    # ========================================================

    if album.visibility == "private":

        if album.owner_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the album owner can add media "
                    "to this private album."
                ),
            )

        if media.owner_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail=(
                    "A group media cannot be added "
                    "to a private album."
                ),
            )

    # ========================================================
    # ALBUM DE GROUPE
    # ========================================================

    elif album.visibility == "group":

        if album.group_id is None:
            raise HTTPException(
                status_code=500,
                detail="Invalid group album configuration.",
            )

        if not can_manage_group(
            album.group_id,
            current_user.id,
            db,
        ):
            raise HTTPException(
                status_code=403,
                detail="Only group managers can organize this album.",
            )

        if media.visibility != "group":
            raise HTTPException(
                status_code=400,
                detail=(
                    "A group album can only contain "
                    "group media."
                ),
            )

        if media.group_id != album.group_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The media and album must belong "
                    "to the same group."
                ),
            )

    # ========================================================
    # VISIBILITÉ INVALIDE
    # ========================================================

    else:
        raise HTTPException(
            status_code=500,
            detail="Invalid album visibility.",
        )

    # --------------------------------------------------------
    # Association
    # --------------------------------------------------------

    media.album_id = album.id

    db.commit()
    db.refresh(media)

    # --------------------------------------------------------
    # Réponse
    # --------------------------------------------------------

    item = MediaResponse.model_validate(
        media
    )

    item.thumbnail_url = (
        f"/api/media/{media.id}/thumbnail"
    )

    item.file_url = (
        f"/api/media/{media.id}/file"
    )

    return item


# ============================================================
# REMOVE MEDIA FROM ALBUM
# ============================================================

@router.delete(
    "/{media_id}/album",
    response_model=MediaResponse,
)
def remove_media_from_album(
    media_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # Vérifier le média
    # --------------------------------------------------------

    media = get_accessible_media(
        media_id=media_id,
        user=current_user,
        db=db,
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    # --------------------------------------------------------
    # Vérifier l'album
    # --------------------------------------------------------

    if media.album_id is None:
        raise HTTPException(
            status_code=400,
            detail="Media is not assigned to an album.",
        )

    album = db.scalar(
        select(Album).where(
            Album.id == media.album_id,
        )
    )

    if album is None:
        raise HTTPException(
            status_code=404,
            detail="Album not found.",
        )

    # ========================================================
    # ALBUM PRIVÉ
    # ========================================================

    if album.visibility == "private":

        if album.owner_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the album owner can remove "
                    "media from this private album."
                ),
            )

    # ========================================================
    # ALBUM DE GROUPE
    # ========================================================

    elif album.visibility == "group":

        if album.group_id is None:
            raise HTTPException(
                status_code=500,
                detail="Invalid group album configuration.",
            )

        if not can_manage_group(
            album.group_id,
            current_user.id,
            db,
        ):
            raise HTTPException(
                status_code=403,
                detail="Only group managers can organize this album.",
            )

        if media.visibility != "group":
            raise HTTPException(
                status_code=400,
                detail=(
                    "A group album can only contain "
                    "group media."
                ),
            )

        if media.group_id != album.group_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "The media and album must belong "
                    "to the same group."
                ),
            )

    else:
        raise HTTPException(
            status_code=500,
            detail="Invalid album visibility.",
        )

    # --------------------------------------------------------
    # Retirer du groupe
    # --------------------------------------------------------

    media.album_id = None

    db.commit()
    db.refresh(media)

    # --------------------------------------------------------
    # Réponse
    # --------------------------------------------------------

    item = MediaResponse.model_validate(
        media
    )

    item.thumbnail_url = (
        f"/api/media/{media.id}/thumbnail"
    )

    item.file_url = (
        f"/api/media/{media.id}/file"
    )

    return item


# ============================================================
# DELETE SINGLE MEDIA
# ============================================================

@router.delete(
    "/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_media(
    media_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    # --------------------------------------------------------
    # Récupérer le média
    # --------------------------------------------------------

    media = db.scalar(
        select(Media).where(
            Media.id == media_id,
            Media.deleted_at.is_(None),
        )
    )

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    # --------------------------------------------------------
    # Vérifier les permissions
    # --------------------------------------------------------

    if not can_manage_media(
        media=media,
        user=current_user,
        db=db,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission "
                "to delete this media."
            ),
        )

    media.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    media.deleted_by_id = current_user.id

    db.commit()

    return None
