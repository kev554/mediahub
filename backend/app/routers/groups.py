from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.group import Group, group_members
from app.models.user import User
from app.schemas.group import (
    AddGroupMemberRequest,
    GroupDetailResponse,
    GroupMemberResponse,
    GroupResponse,
    GroupCreate,
    GroupUpdate,
)


router = APIRouter(
    prefix="/api/groups",
    tags=["Groups"],
)


# ============================================================
# HELPERS
# ============================================================

def get_group_for_user(
    group_id: int,
    current_user: User,
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
            group_members.c.user_id == current_user.id,
        )
    )

    if is_member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this group.",
        )

    return group


def require_group_owner(
    group: Group,
    current_user: User,
) -> None:

    if group.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can perform this action.",
        )


def build_group_response(
    group: Group,
    db: Session,
) -> GroupResponse:

    member_count = db.scalar(
        select(func.count()).select_from(
            group_members
        ).where(
            group_members.c.group_id == group.id
        )
    ) or 0

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        owner_id=group.owner_id,
        created_at=group.created_at,
        member_count=member_count,
    )


# ============================================================
# CREATE GROUP
# ============================================================

@router.post(
    "",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_group(
    data: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    group = Group(
        name=data.name.strip(),
        description=(
            data.description.strip()
            if data.description
            else None
        ),
        owner_id=current_user.id,
    )

    db.add(group)
    db.flush()

    db.execute(
        group_members.insert().values(
            group_id=group.id,
            user_id=current_user.id,
            role="owner",
        )
    )

    db.commit()
    db.refresh(group)

    return build_group_response(
        group,
        db,
    )


# ============================================================
# LIST MY GROUPS
# ============================================================

@router.get(
    "",
    response_model=list[GroupResponse],
)
def list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    group_ids = select(
        group_members.c.group_id
    ).where(
        group_members.c.user_id == current_user.id
    )

    groups = db.scalars(
        select(Group)
        .where(Group.id.in_(group_ids))
        .order_by(Group.created_at.desc())
    ).all()

    return [
        build_group_response(group, db)
        for group in groups
    ]


# ============================================================
# GET GROUP
# ============================================================

@router.get(
    "/{group_id}",
    response_model=GroupDetailResponse,
)
def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    group = get_group_for_user(
        group_id,
        current_user,
        db,
    )

    rows = db.execute(
        select(
            User.id,
            User.username,
            User.display_name,
            group_members.c.role,
            group_members.c.joined_at,
        )
        .join(
            group_members,
            group_members.c.user_id == User.id,
        )
        .where(
            group_members.c.group_id == group_id
        )
        .order_by(
            group_members.c.joined_at.asc()
        )
    ).all()

    members = [
        GroupMemberResponse(
            id=row.id,
            username=row.username,
            display_name=row.display_name,
            role=row.role,
            joined_at=row.joined_at,
        )
        for row in rows
    ]

    base = build_group_response(
        group,
        db,
    )

    return GroupDetailResponse(
        **base.model_dump(),
        members=members,
    )


# ============================================================
# UPDATE GROUP
# ============================================================

@router.patch(
    "/{group_id}",
    response_model=GroupResponse,
)
def update_group(
    group_id: int,
    data: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    group = get_group_for_user(
        group_id,
        current_user,
        db,
    )

    require_group_owner(
        group,
        current_user,
    )

    if data.name is not None:
        group.name = data.name.strip()

    if data.description is not None:
        group.description = data.description.strip()

    db.commit()
    db.refresh(group)

    return build_group_response(
        group,
        db,
    )


# ============================================================
# DELETE GROUP
# ============================================================

@router.delete(
    "/{group_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

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

    require_group_owner(
        group,
        current_user,
    )

    db.execute(
        delete(group_members).where(
            group_members.c.group_id == group_id
        )
    )

    db.delete(group)
    db.commit()

    return None


# ============================================================
# LIST GROUP MEMBERS
# ============================================================

@router.get(
    "/{group_id}/members",
    response_model=list[GroupMemberResponse],
)
def list_group_members(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    get_group_for_user(
        group_id,
        current_user,
        db,
    )

    rows = db.execute(
        select(
            User.id,
            User.username,
            User.display_name,
            group_members.c.role,
            group_members.c.joined_at,
        )
        .join(
            group_members,
            group_members.c.user_id == User.id,
        )
        .where(
            group_members.c.group_id == group_id
        )
        .order_by(
            group_members.c.joined_at.asc()
        )
    ).all()

    return [
        GroupMemberResponse(
            id=row.id,
            username=row.username,
            display_name=row.display_name,
            role=row.role,
            joined_at=row.joined_at,
        )
        for row in rows
    ]


# ============================================================
# ADD MEMBER
# ============================================================

@router.post(
    "/{group_id}/members",
    response_model=GroupMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_group_member(
    group_id: int,
    data: AddGroupMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

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

    require_group_owner(
        group,
        current_user,
    )

    user = db.scalar(
        select(User).where(
            User.id == data.user_id,
        )
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    existing_member = db.scalar(
        select(group_members.c.user_id).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == data.user_id,
        )
    )

    if existing_member is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this group.",
        )

    db.execute(
        group_members.insert().values(
            group_id=group_id,
            user_id=data.user_id,
            role="member",
        )
    )

    db.commit()

    row = db.execute(
        select(
            User.id,
            User.username,
            User.display_name,
            group_members.c.role,
            group_members.c.joined_at,
        )
        .join(
            group_members,
            group_members.c.user_id == User.id,
        )
        .where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == data.user_id,
        )
    ).one()

    return GroupMemberResponse(
        id=row.id,
        username=row.username,
        display_name=row.display_name,
        role=row.role,
        joined_at=row.joined_at,
    )


# ============================================================
# REMOVE MEMBER
# ============================================================

@router.delete(
    "/{group_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_group_member(
    group_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

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

    require_group_owner(
        group,
        current_user,
    )

    if user_id == group.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The group owner cannot be removed.",
        )

    existing_member = db.scalar(
        select(group_members.c.user_id).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == user_id,
        )
    )

    if existing_member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this group.",
        )

    db.execute(
        delete(group_members).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == user_id,
        )
    )

    db.commit()

    return None

# ============================================================
# LEAVE GROUP
# ============================================================

@router.delete(
    "/{group_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
)
def leave_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

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

    # Le propriétaire ne peut pas simplement quitter
    # son propre groupe.
    if group.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The group owner cannot leave the group. "
                "Delete the group instead."
            ),
        )

    existing_member = db.scalar(
        select(group_members.c.user_id).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == current_user.id,
        )
    )

    if existing_member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this group.",
        )

    db.execute(
        delete(group_members).where(
            group_members.c.group_id == group_id,
            group_members.c.user_id == current_user.id,
        )
    )

    db.commit()

    return None
