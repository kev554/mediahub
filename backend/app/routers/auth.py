import jwt

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    status,
)

from fastapi.security import OAuth2PasswordBearer

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

from app.db.database import get_db
from app.models.user import User

from app.schemas.user import (
    PasswordChange,
    TokenResponse,
    UserRegister,
    UserResponse,
    UserUpdate,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
)


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    data: UserRegister,
    db: Session = Depends(get_db),
):

    username = data.username.strip()
    email = str(data.email).strip().lower()

    existing_user = db.scalar(
        select(User).where(
            (User.username == username)
            | (User.email == email)
        )
    )

    if existing_user:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists.",
        )

    user = User(
        username=username,
        email=email,
        display_name=data.display_name.strip(),
        password_hash=hash_password(
            data.password
        ),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=TokenResponse,
)
def login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):

    user = db.scalar(
        select(User).where(
            User.username == username
        )
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    if not verify_password(
        password,
        user.password_hash,
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled.",
        )

    token = create_access_token(
        user.id
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
    )


# ============================================================
# CURRENT USER
# ============================================================

@router.get(
    "/me",
    response_model=UserResponse,
)
def get_current_user_profile(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):

    try:

        payload = decode_access_token(
            token
        )

        user_id = int(
            payload["sub"]
        )

    except (
        jwt.InvalidTokenError,
        KeyError,
        ValueError,
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    user = db.get(
        User,
        user_id,
    )

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    if not user.is_active:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled.",
        )

    return user


# ============================================================
# UPDATE PROFILE
# ============================================================

@router.patch(
    "/me",
    response_model=UserResponse,
)
def update_profile(
    data: UserUpdate,
    current_user: User = Depends(
        get_current_user_profile
    ),
    db: Session = Depends(get_db),
):

    # --------------------------------------------------------
    # Username
    # --------------------------------------------------------

    if data.username is not None:

        username = data.username.strip()

        if username != current_user.username:

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

    # --------------------------------------------------------
    # Email
    # --------------------------------------------------------

    if data.email is not None:

        email = str(
            data.email
        ).strip().lower()

        if email != current_user.email:

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

    # --------------------------------------------------------
    # Display name
    # --------------------------------------------------------

    if data.display_name is not None:

        current_user.display_name = (
            data.display_name.strip()
        )

    db.commit()
    db.refresh(current_user)

    return current_user


# ============================================================
# CHANGE PASSWORD
# ============================================================

@router.patch(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
)
def change_password(
    data: PasswordChange,
    current_user: User = Depends(
        get_current_user_profile
    ),
    db: Session = Depends(get_db),
):

    if not verify_password(
        data.current_password,
        current_user.password_hash,
    ):

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    if data.current_password == data.new_password:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "New password must be different "
                "from the current password."
            ),
        )

    current_user.password_hash = hash_password(
        data.new_password
    )

    db.commit()

    return None
