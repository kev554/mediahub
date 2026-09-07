from pathlib import Path

from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
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
)

from app.services.media_permissions import (
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
    ORIGINALS_DIR,
    THUMBNAILS_DIR,
    generate_storage_filename,
)


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

MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024


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

        membership = db.scalar(
            select(group_members.c.user_id).where(
                group_members.c.group_id == group_id,
                group_members.c.user_id == current_user.id,
            )
        )

        if membership is None:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this group.",
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

    destination = ORIGINALS_DIR / stored_filename

    # --------------------------------------------------------
    # Upload par morceaux
    # --------------------------------------------------------

    total_size = 0

    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:
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
        THUMBNAILS_DIR
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
    # Création objet Media
    # --------------------------------------------------------

    media = Media(
        filename=stored_filename,
        original_name=file.filename,
        media_type=media_type,
        mime_type=file.content_type,
        file_path=str(destination),
        thumbnail_path=(
            str(thumbnail_path)
            if thumbnail_path
            else None
        ),
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
        (Media.owner_id == current_user.id)
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
        accessible_media
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
        .where(accessible_media)
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
    # --------------------------------------------------------

    query = query.order_by(
        Media.taken_at.desc().nullslast(),
        Media.uploaded_at.desc(),
    )

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
            Media.id.in_(unique_ids)
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

    for media in media_items:

        # ----------------------------------------------------
        # Original
        # ----------------------------------------------------

        if media.file_path:
            file_path = Path(
                media.file_path
            )

            file_path.unlink(
                missing_ok=True
            )

        # ----------------------------------------------------
        # Miniature
        # ----------------------------------------------------

        if media.thumbnail_path:
            thumbnail_path = Path(
                media.thumbnail_path
            )

            thumbnail_path.unlink(
                missing_ok=True
            )

        # ----------------------------------------------------
        # Favoris associés
        # ----------------------------------------------------

        favorites = db.scalars(
            select(MediaFavorite).where(
                MediaFavorite.media_id
                == media.id
            )
        ).all()

        for favorite in favorites:
            db.delete(favorite)

        # ----------------------------------------------------
        # Média PostgreSQL
        # ----------------------------------------------------

        db.delete(media)

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

    medias = (
        db.query(Media)
        .filter(
            Media.visibility == "group",
            Media.group_id.in_(
                user_group_ids
            ),
        )
        .order_by(
            Media.taken_at.desc().nullslast(),
            Media.uploaded_at.desc(),
        )
        .all()
    )

    return medias


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
        (Media.owner_id == current_user.id)
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
        accessible_media
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
        .where(accessible_media)
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

    thumbnail = Path(
        media.thumbnail_path
    )

    if not thumbnail.is_file():
        raise HTTPException(
            status_code=404,
            detail="Thumbnail file not found.",
        )

    return FileResponse(
        path=thumbnail,
        media_type="image/webp",
    )


# ============================================================
# MEDIA FILE / DOWNLOAD
# ============================================================

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

    # --------------------------------------------------------
    # IMPORTANT :
    # Vérifier que le média existe et est accessible
    # avant d'utiliser media.file_path.
    # --------------------------------------------------------

    if not media:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    file_path = Path(
        media.file_path
    )

    if not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Media file not found.",
        )

    return FileResponse(
        path=file_path,
        media_type=media.mime_type,
        filename=media.original_name,
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

        is_member = db.scalar(
            select(
                group_members.c.user_id
            ).where(
                group_members.c.group_id
                == album.group_id,
                group_members.c.user_id
                == current_user.id,
            )
        )

        if is_member is None:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this group.",
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

        is_member = db.scalar(
            select(
                group_members.c.user_id
            ).where(
                group_members.c.group_id
                == album.group_id,
                group_members.c.user_id
                == current_user.id,
            )
        )

        if is_member is None:
            raise HTTPException(
                status_code=403,
                detail="You are not a member of this group.",
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
            Media.id == media_id
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

    # --------------------------------------------------------
    # Supprimer le fichier original
    # --------------------------------------------------------

    if media.file_path:
        file_path = Path(
            media.file_path
        )

        file_path.unlink(
            missing_ok=True
        )

    # --------------------------------------------------------
    # Supprimer la miniature
    # --------------------------------------------------------

    if media.thumbnail_path:
        thumbnail_path = Path(
            media.thumbnail_path
        )

        thumbnail_path.unlink(
            missing_ok=True
        )

    # --------------------------------------------------------
    # Supprimer les favoris associés
    # --------------------------------------------------------

    favorites = db.scalars(
        select(MediaFavorite).where(
            MediaFavorite.media_id
            == media.id
        )
    ).all()

    for favorite in favorites:
        db.delete(favorite)

    # --------------------------------------------------------
    # Supprimer de PostgreSQL
    # --------------------------------------------------------

    db.delete(media)

    db.commit()

    return None
