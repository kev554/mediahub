from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.album import Album
from app.models.group import Group, group_members
from app.models.media import Media
from app.models.user import User
from app.schemas.album import (
    AlbumCreate,
    AlbumResponse,
    AlbumUpdate,
)


router = APIRouter(
    prefix="/api/albums",
    tags=["Albums"],
)


# ============================================================
# HELPERS
# ============================================================

def verify_group_access(
    group_id: int,
    user_id: int,
    db: Session,
) -> Group:

    group = db.scalar(
        select(Group).where(
            Group.id == group_id,
        )
    )

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found.",
        )

    is_member = db.scalar(
        select(group_members.c.user_id).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == user_id,
        )
    )

    if is_member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group.",
        )

    return group


def get_accessible_album(
    album_id: int,
    current_user: User,
    db: Session,
) -> Album:

    album = db.scalar(
        select(Album).where(
            Album.id == album_id,
        )
    )

    if not album:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Album not found.",
        )

    # --------------------------------------------------------
    # Album privé
    # --------------------------------------------------------

    if album.visibility == "private":

        if album.owner_id != current_user.id:

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this album.",
            )

        return album

    # --------------------------------------------------------
    # Album groupe
    # --------------------------------------------------------

    if album.visibility == "group":

        if album.group_id is None:

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid group album configuration.",
            )

        verify_group_access(
            album.group_id,
            current_user.id,
            db,
        )

        return album

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Invalid album visibility.",
    )


def require_album_owner(
    album: Album,
    current_user: User,
) -> None:

    if album.owner_id != current_user.id:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the album owner can perform this action.",
        )


def get_media_count(
    album_id: int,
    db: Session,
) -> int:

    return db.scalar(
        select(func.count()).select_from(
            Media
        ).where(
            Media.album_id == album_id
        )
    ) or 0


def build_album_response(
    album: Album,
    db: Session,
) -> AlbumResponse:

    return AlbumResponse(
        id=album.id,
        name=album.name,
        description=album.description,
        year=album.year,
        cover_path=album.cover_path,
        visibility=album.visibility,
        owner_id=album.owner_id,
        group_id=album.group_id,
        created_at=album.created_at,
        media_count=get_media_count(
            album.id,
            db,
        ),
    )


# ============================================================
# CREATE ALBUM
# ============================================================

@router.post(
    "",
    response_model=AlbumResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_album(
    data: AlbumCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # Album privé
    # --------------------------------------------------------

    if data.visibility == "private":

        if data.group_id is not None:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A private album cannot have a group."
                ),
            )

        group_id = None

    # --------------------------------------------------------
    # Album groupe
    # --------------------------------------------------------

    else:

        if data.group_id is None:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "group_id is required for a group album."
                ),
            )

        verify_group_access(
            data.group_id,
            current_user.id,
            db,
        )

        group_id = data.group_id

    album = Album(
        name=data.name.strip(),
        description=(
            data.description.strip()
            if data.description
            else None
        ),
        year=data.year,
        visibility=data.visibility,
        group_id=group_id,
        owner_id=current_user.id,
    )

    db.add(album)
    db.commit()
    db.refresh(album)

    return build_album_response(
        album,
        db,
    )


# ============================================================
# LIST ACCESSIBLE ALBUMS
# ============================================================

@router.get(
    "",
    response_model=list[AlbumResponse],
)
def list_albums(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    # Groupes auxquels appartient l'utilisateur
    user_group_ids = select(
        group_members.c.group_id
    ).where(
        group_members.c.user_id == current_user.id
    )

    query = select(Album).where(
        (
            (Album.visibility == "private")
            & (Album.owner_id == current_user.id)
        )
        |
        (
            (Album.visibility == "group")
            & Album.group_id.in_(user_group_ids)
        )
    ).order_by(
        Album.year.desc(),
        Album.created_at.desc(),
    )

    albums = db.scalars(
        query
    ).all()

    return [
        build_album_response(
            album,
            db,
        )
        for album in albums
    ]


# ============================================================
# GET ALBUM
# ============================================================

@router.get(
    "/{album_id}",
    response_model=AlbumResponse,
)
def get_album(
    album_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    album = get_accessible_album(
        album_id,
        current_user,
        db,
    )

    return build_album_response(
        album,
        db,
    )


# ============================================================
# UPDATE ALBUM
# ============================================================

@router.patch(
    "/{album_id}",
    response_model=AlbumResponse,
)
def update_album(
    album_id: int,
    data: AlbumUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    album = get_accessible_album(
        album_id,
        current_user,
        db,
    )

    require_album_owner(
        album,
        current_user,
    )

    new_visibility = (
        data.visibility
        if data.visibility is not None
        else album.visibility
    )

    new_group_id = (
        data.group_id
        if data.group_id is not None
        else album.group_id
    )

    # --------------------------------------------------------
    # Nouvelle visibilité privée
    # --------------------------------------------------------

    if new_visibility == "private":

        if (
            data.group_id is not None
            and data.group_id != 0
        ):

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A private album cannot have a group."
                ),
            )

        new_group_id = None

    # --------------------------------------------------------
    # Nouvelle visibilité groupe
    # --------------------------------------------------------

    elif new_visibility == "group":

        if new_group_id is None:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "group_id is required for a group album."
                ),
            )

        verify_group_access(
            new_group_id,
            current_user.id,
            db,
        )

    # --------------------------------------------------------
    # Mise à jour
    # --------------------------------------------------------

    if data.name is not None:
        album.name = data.name.strip()

    if data.description is not None:
        album.description = data.description.strip()

    if data.year is not None:
        album.year = data.year

    album.visibility = new_visibility
    album.group_id = new_group_id

    db.commit()
    db.refresh(album)

    return build_album_response(
        album,
        db,
    )


# ============================================================
# DELETE ALBUM
# ============================================================

@router.delete(
    "/{album_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_album(
    album_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    album = get_accessible_album(
        album_id,
        current_user,
        db,
    )

    require_album_owner(
        album,
        current_user,
    )

    # Les médias ne sont PAS supprimés.
    # Ils deviennent simplement sans album.

    db.execute(
        Media.__table__.update()
        .where(
            Media.album_id == album.id
        )
        .values(
            album_id=None
        )
    )

    db.delete(album)
    db.commit()

    return None


# ============================================================
# LIST MEDIA IN ALBUM
# ============================================================

@router.get(
    "/{album_id}/media",
)
def list_album_media(
    album_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    album = get_accessible_album(
        album_id,
        current_user,
        db,
    )

    media_items = db.scalars(
        select(Media)
        .where(
            Media.album_id == album.id,
            Media.owner_id == album.owner_id,
        )
        .order_by(
            Media.taken_at.desc().nullslast(),
            Media.uploaded_at.desc(),
        )
    ).all()

    result = []

    for media in media_items:

        result.append(
            {
                "id": media.id,
                "original_name": media.original_name,
                "media_type": media.media_type,
                "mime_type": media.mime_type,
                "file_size": media.file_size,
                "width": media.width,
                "height": media.height,
                "duration": media.duration,
                "taken_at": media.taken_at,
                "uploaded_at": media.uploaded_at,
                "is_favorite": media.is_favorite,
                "thumbnail_url": (
                    f"/api/media/{media.id}/thumbnail"
                ),
                "file_url": (
                    f"/api/media/{media.id}/file"
                ),
            }
        )

    return result
 
# ============================================================
# ADD MEDIA TO ALBUM
# ============================================================

@router.post(
    "/{album_id}/media/{media_id}",
    response_model=AlbumResponse,
)
def add_media_to_album(
    album_id: int,
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    album = get_accessible_album(
        album_id,
        current_user,
        db,
    )

    # Seul le propriétaire de l'album peut le modifier.
    require_album_owner(
        album,
        current_user,
    )

    media = db.scalar(
        select(Media).where(
            Media.id == media_id,
        )
    )

    if not media:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media not found.",
        )

    # L'utilisateur doit également avoir le droit
    # d'utiliser ce média.
    if media.owner_id != current_user.id:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "You can only add your own media "
                "to an album."
            ),
        )

    media.album_id = album.id

    db.commit()
    db.refresh(album)

    return build_album_response(
        album,
        db,
    )


# ============================================================
# REMOVE MEDIA FROM ALBUM
# ============================================================

@router.delete(
    "/{album_id}/media/{media_id}",
    response_model=AlbumResponse,
)
def remove_media_from_album(
    album_id: int,
    media_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    album = get_accessible_album(
        album_id,
        current_user,
        db,
    )

    require_album_owner(
        album,
        current_user,
    )

    media = db.scalar(
        select(Media).where(
            Media.id == media_id,
            Media.album_id == album.id,
        )
    )

    if not media:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media is not in this album.",
        )

    media.album_id = None

    db.commit()
    db.refresh(album)

    return build_album_response(
        album,
        db,
    )
