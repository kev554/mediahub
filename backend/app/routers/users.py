from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.models.media import Media
from app.models.user_preference import UserPreference
from app.schemas.user import (
    UserSearchResponse,
    UserUpdate,
    PasswordChange,
    UserPreferencesResponse,
    UserPreferencesUpdate,
    UserResponse,
)

from app.core.security import (
    hash_password,
    verify_password,
)
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

router = APIRouter(
    prefix="/api/users",
    tags=["Users"],
)


@router.get("/me/storage-usage")
def get_storage_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    used_bytes, media_count = db.execute(
        select(
            func.coalesce(func.sum(Media.file_size), 0),
            func.count(Media.id),
        ).where(Media.owner_id == current_user.id)
    ).one()

    return {
        "used_bytes": used_bytes,
        "media_count": media_count,
        "quota_bytes": settings.storage_quota_bytes,
    }


def _normalize_preferences(preferences: UserPreference | None) -> UserPreferencesResponse:
    if preferences is None:
        return UserPreferencesResponse(
            theme="dark",
            language="fr",
            default_visibility="private",
            media_sort="uploaded_at",
        )

    return UserPreferencesResponse(
        theme=preferences.theme,
        language=preferences.language,
        default_visibility=preferences.default_visibility,
        media_sort=preferences.media_sort,
    )


# ============================================================
# SEARCH USERS
# ============================================================

@router.get(
    "",
    response_model=list[UserSearchResponse],
)
def search_users(
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    query = q.strip()

    statement = (
        select(User)
        .where(
            User.is_active.is_(True),
            User.id != current_user.id,
        )
        .order_by(User.username.asc())
        .limit(20)
    )

    if query:
        search = f"%{query}%"

        statement = statement.where(
            or_(
                User.username.ilike(search),
                User.display_name.ilike(search),
            )
        )

    return db.scalars(statement).all()


# ============================================================
# USER PREFERENCES
# ============================================================

@router.get(
    "/me/preferences",
    response_model=UserPreferencesResponse,
)
def get_user_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    preferences = current_user.preferences

    if preferences is None:
        preferences = UserPreference(
            user_id=current_user.id,
            theme="dark",
            language="fr",
            default_visibility="private",
            media_sort="uploaded_at",
        )
        db.add(preferences)
        db.commit()
        db.refresh(preferences)

    return _normalize_preferences(preferences)


@router.put(
    "/me/preferences",
    response_model=UserPreferencesResponse,
)
def update_user_preferences(
    data: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    preferences = current_user.preferences

    if preferences is None:
        preferences = UserPreference(user_id=current_user.id)
        db.add(preferences)

    allowed_theme = {"light", "dark", "system"}
    allowed_language = {"fr", "en"}
    allowed_visibility = {"private", "group"}
    allowed_sort = {"uploaded_at", "taken_at", "original_name"}

    if data.theme is not None:
        if data.theme not in allowed_theme:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Theme must be one of: light, dark, system.",
            )
        preferences.theme = data.theme

    if data.language is not None:
        if data.language not in allowed_language:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Language must be one of: fr, en.",
            )
        preferences.language = data.language

    if data.default_visibility is not None:
        if data.default_visibility not in allowed_visibility:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Default visibility must be one of: private, group.",
            )
        preferences.default_visibility = data.default_visibility

    if data.media_sort is not None:
        if data.media_sort not in allowed_sort:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Media sort must be one of: uploaded_at, taken_at, original_name.",
            )
        preferences.media_sort = data.media_sort

    db.commit()
    db.refresh(preferences)

    return _normalize_preferences(preferences)


# ============================================================
# UPDATE PROFILE
# ============================================================

@router.put(
    "/me",
    response_model=UserResponse,
)
def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    if data.username is not None:
        username = data.username.strip()
        existing_user = db.scalar(
            select(User).where(
                User.username == username,
                User.id != current_user.id,
            )
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists.",
            )
        current_user.username = username

    if data.email is not None:
        email = str(data.email).strip().lower()
        existing_user = db.scalar(
            select(User).where(
                User.email == email,
                User.id != current_user.id,
            )
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists.",
            )
        current_user.email = email

    if data.display_name is not None:
        current_user.display_name = data.display_name.strip()


    db.commit()
    db.refresh(current_user)

    return current_user



# ============================================================
# CHANGE PASSWORD
# ============================================================

@router.put(
    "/me/password",
)
def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    if not verify_password(
        data.current_password,
        current_user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect",
        )


    current_user.password_hash = (
        hash_password(
            data.new_password
        )
    )


    db.commit()


    return {
        "message":
        "Mot de passe modifié avec succès"
    }
