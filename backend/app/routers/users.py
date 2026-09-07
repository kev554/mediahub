from fastapi import (
    APIRouter,
    Depends,
)
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserSearchResponse,
    UserUpdate,
    PasswordChange,
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

    if data.username:
        current_user.username = data.username

    if data.email:
        current_user.email = data.email

    if data.display_name:
        current_user.display_name = data.display_name


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
