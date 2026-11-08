from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ============================================================
# REGISTER
# ============================================================

class UserRegister(BaseModel):
    username: str = Field(
        min_length=3,
        max_length=50,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    display_name: str = Field(
        min_length=1,
        max_length=100,
    )


# ============================================================
# LOGIN
# ============================================================

class UserLogin(BaseModel):
    username: str
    password: str


# ============================================================
# UPDATE PROFILE
# ============================================================

class UserUpdate(BaseModel):

    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=50,
    )

    email: EmailStr | None = None

    display_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )


# ============================================================
# CHANGE PASSWORD
# ============================================================

class PasswordChange(BaseModel):

    current_password: str = Field(
        min_length=1,
        max_length=128,
    )

    new_password: str = Field(
        min_length=8,
        max_length=128,
    )


# ============================================================
# USER RESPONSE
# ============================================================

class UserResponse(BaseModel):

    id: int
    username: str
    email: str
    display_name: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class UserPreferencesUpdate(BaseModel):
    theme: str | None = None
    language: str | None = None
    default_visibility: str | None = None
    media_sort: str | None = None


class UserPreferencesResponse(BaseModel):
    theme: str
    language: str
    default_visibility: str
    media_sort: str

    model_config = ConfigDict(
        from_attributes=True,
    )


# ============================================================
# TOKEN
# ============================================================

class TokenResponse(BaseModel):

    access_token: str
    
 # ============================================================
# USER SEARCH RESPONSE
# ============================================================

class UserSearchResponse(BaseModel):
    id: int
    username: str
    display_name: str

    model_config = ConfigDict(
        from_attributes=True,
    )

    token_type: str = "bearer"
    
# ============================================================
# USER SEARCH
# ============================================================

class UserSearchResponse(BaseModel):
    id: int
    username: str
    display_name: str

    model_config = ConfigDict(
        from_attributes=True,
    )
