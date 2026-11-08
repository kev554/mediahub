from datetime import datetime, timedelta, timezone
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from sqlalchemy import delete, select

from app.core.config import settings
from app.db.database import SessionLocal
from app.models.media import Media
from app.models.media_favorite import MediaFavorite
from app.services.media_storage import delete_from_r2


def configure_logging() -> None:
    log_dir = Path(__file__).resolve().parent / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    handler = RotatingFileHandler(
        log_dir / "trash-purge.log",
        maxBytes=1_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[handler, logging.StreamHandler()],
    )


def purge_expired_trash() -> int:
    cutoff = (
        datetime.now(timezone.utc).replace(tzinfo=None)
        - timedelta(days=settings.trash_retention_days)
    )
    deleted_count = 0

    with SessionLocal() as db:
        expired_items = db.scalars(
            select(Media).where(
                Media.deleted_at.is_not(None),
                Media.deleted_at <= cutoff,
            )
        ).all()
        logging.info(
            "Found %d expired trash item(s); retention is %d day(s).",
            len(expired_items),
            settings.trash_retention_days,
        )

        for media in expired_items:
            media_id = media.id
            if media.file_path:
                delete_from_r2(media.file_path)

            if media.thumbnail_path:
                delete_from_r2(media.thumbnail_path)

            db.execute(
                delete(MediaFavorite).where(
                    MediaFavorite.media_id == media.id,
                )
            )
            db.delete(media)
            db.commit()
            deleted_count += 1
            logging.info("Purged expired media item id=%d.", media_id)

    return deleted_count


if __name__ == "__main__":
    configure_logging()
    try:
        count = purge_expired_trash()
        logging.info("Trash purge completed; purged %d item(s).", count)
    except Exception:
        logging.exception("Trash purge failed.")
        raise
