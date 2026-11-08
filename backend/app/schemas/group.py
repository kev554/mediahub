from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


GroupRole = Literal["owner", "manager", "viewer"]


class GroupCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    description: str | None = Field(
        default=None,
        max_length=500,
    )


class GroupUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    description: str | None = Field(
        default=None,
        max_length=500,
    )


class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    username: str
    display_name: str
    role: GroupRole
    joined_at: datetime


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None
    owner_id: int
    created_at: datetime
    member_count: int


class GroupDetailResponse(GroupResponse):
    members: list[GroupMemberResponse]


class AddGroupMemberRequest(BaseModel):
    user_id: int
    role: Literal["manager", "viewer"] = "viewer"


class GroupMemberRoleUpdate(BaseModel):
    role: Literal["manager", "viewer"]
