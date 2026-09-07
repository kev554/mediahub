from pathlib import Path

from app.db.database import SessionLocal
from app.models.media import Media
from app.services.media_service import (
    generate_image_thumbnail,
    generate_video_thumbnail,
)
from app.services.media_storage import (
    ORIGINALS_DIR,
    THUMBNAILS_DIR,
)


def main() -> None:
    db = SessionLocal()

    try:
        media_items = (
            db.query(Media)
            .order_by(Media.id.asc())
            .all()
        )

        generated = 0
        skipped = 0
        failed = 0

        print(
            f"{len(media_items)} média(s) trouvé(s)."
        )

        for media in media_items:
            source = Path(media.file_path)

            if not source.is_absolute():
                source = ORIGINALS_DIR / source.name

            if not source.is_file():
                print(
                    f"[SKIP] #{media.id} "
                    f"fichier absent : {source}"
                )
                skipped += 1
                continue

            extension = ".webp"

            thumbnail_path = (
                THUMBNAILS_DIR
                / f"{Path(media.filename).stem}{extension}"
            )

            try:
                if media.media_type == "image":
                    generate_image_thumbnail(
                        source,
                        thumbnail_path,
                    )

                elif media.media_type == "video":
                    generate_video_thumbnail(
                        source,
                        thumbnail_path,
                    )

                else:
                    print(
                        f"[SKIP] #{media.id} "
                        f"type inconnu : "
                        f"{media.media_type}"
                    )
                    skipped += 1
                    continue

                media.thumbnail_path = str(
                    thumbnail_path
                )

                db.commit()

                generated += 1

                print(
                    f"[OK] #{media.id} "
                    f"{media.original_name}"
                )

            except Exception as exc:
                db.rollback()

                failed += 1

                print(
                    f"[ERROR] #{media.id} "
                    f"{media.original_name}: "
                    f"{exc}"
                )

        print()
        print("================================")
        print("RÉGÉNÉRATION TERMINÉE")
        print("================================")
        print(f"Générées : {generated}")
        print(f"Ignorées  : {skipped}")
        print(f"Erreurs   : {failed}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
