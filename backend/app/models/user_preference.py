from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        primary_key=True,
        nullable=False,
    )

    theme: Mapped[str] = mapped_column(
        String(20),
        default="dark",
        nullable=False,
    )

    language: Mapped[str] = mapped_column(
        String(10),
        default="fr",
        nullable=False,
    )

    default_visibility: Mapped[str] = mapped_column(
        String(20),
        default="private",
        nullable=False,
    )

    media_sort: Mapped[str] = mapped_column(
        String(20),
        default="uploaded_at",
        nullable=False,
    )

    user = relationship(
        "User",
        back_populates="preferences",
    )
