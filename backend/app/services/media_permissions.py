from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.media import Media
from app.models.user import User
from app.models.group import group_members


def is_group_member(
    group_id: int,
    user_id: int,
    db: Session,
) -> bool:
    """
    Vérifie si un utilisateur est membre d'un groupe.
    """

    membership = db.scalar(
        select(group_members.c.user_id).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == user_id,
        )
    )

    return membership is not None


def can_manage_group(
    group_id: int,
    user_id: int,
    db: Session,
) -> bool:
    role = db.scalar(
        select(group_members.c.role).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == user_id,
        )
    )

    return role in {"owner", "manager", "member"}


def can_access_media(
    media: Media,
    user: User,
    db: Session,
) -> bool:
    """
    Vérifie si un utilisateur peut accéder à un média.

    Un média privé appartient uniquement à son propriétaire.
    Un média de groupe n'est accessible qu'aux membres actuels,
    y compris lorsque le propriétaire du fichier a quitté le groupe.
    """

    # --------------------------------------------------------
    # MÉDIA PRIVÉ
    # --------------------------------------------------------

    if media.visibility == "private":
        return media.owner_id == user.id

    # --------------------------------------------------------
    # MÉDIA DE GROUPE
    # --------------------------------------------------------

    if (
        media.visibility == "group"
        and media.group_id is not None
    ):
        return is_group_member(
            group_id=media.group_id,
            user_id=user.id,
            db=db,
        )

    return False


def can_manage_media(
    media: Media,
    user: User,
    db: Session,
) -> bool:
    """
    Vérifie si un utilisateur possède les droits complets
    sur un média.

    Les rôles historiques ``member`` restent équivalents à
    Manager afin de préserver les droits existants.
    """

    if not can_access_media(media=media, user=user, db=db):
        return False

    if media.visibility == "group" and media.group_id is not None:
        return can_manage_group(
            group_id=media.group_id,
            user_id=user.id,
            db=db,
        )

    return media.owner_id == user.id


def get_accessible_media(
    media_id: int,
    user: User,
    db: Session,
) -> Media:
    """
    Récupère un média si l'utilisateur peut y accéder.
    """

    media = db.scalar(
        select(Media).where(
            Media.id == media_id,
        )
    )

    if media is None:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    if media.deleted_at is not None:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    if not can_access_media(
        media=media,
        user=user,
        db=db,
    ):
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    return media


def get_manageable_media(
    media_id: int,
    user: User,
    db: Session,
) -> Media:
    """
    Récupère un média si l'utilisateur possède
    les droits complets dessus.
    """

    media = db.scalar(
        select(Media).where(
            Media.id == media_id,
        )
    )

    if media is None:
        raise HTTPException(
            status_code=404,
            detail="Media not found.",
        )

    if not can_manage_media(
        media=media,
        user=user,
        db=db,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission "
                "to manage this media."
            ),
        )

    return media
