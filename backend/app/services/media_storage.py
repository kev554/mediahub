from pathlib import Path
from uuid import uuid4


BASE_STORAGE = Path.home() / "projects" / "mediahub" / "storage"

ORIGINALS_DIR = BASE_STORAGE / "originals"
THUMBNAILS_DIR = BASE_STORAGE / "thumbnails"
TEMP_DIR = BASE_STORAGE / "temp"


def initialize_storage() -> None:

    ORIGINALS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    THUMBNAILS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    TEMP_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )


def generate_storage_filename(
    extension: str,
) -> str:

    unique_id = uuid4().hex

    extension = extension.lower().strip()

    if extension and not extension.startswith("."):
        extension = f".{extension}"

    return f"{unique_id}{extension}"
