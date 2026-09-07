from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


group_members = Table(
    "group_members",
    Base.metadata,

    Column(
        "group_id",
        ForeignKey("groups.id"),
        primary_key=True,
    ),

    Column(
        "user_id",
        ForeignKey("users.id"),
        primary_key=True,
    ),

    Column(
        "role",
        String(20),
        nullable=False,
        default="member",
    ),

    Column(
        "joined_at",
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    ),
)


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    members = relationship(
        "User",
        secondary=group_members,
    )
