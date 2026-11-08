from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class MediaShare(Base):
    __tablename__ = "media_shares"

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

    media_id: Mapped[int] = mapped_column(
        ForeignKey("media.id"),
        nullable=False,
        index=True,
    )

    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    token: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
        index=True,
    )

    note: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        index=True,
    )

    max_views: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    views_used: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    media = relationship(
        "Media",
        back_populates="share_links",
    )

    owner = relationship(
        "User",
        back_populates="share_links",
    )
