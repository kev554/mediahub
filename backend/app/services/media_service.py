import json
import subprocess
from datetime import datetime
from pathlib import Path

from PIL import Image, ExifTags


# ============================================================
# IMAGE
# ============================================================

def extract_image_metadata(
    file_path: Path,
) -> dict:

    metadata = {
        "width": None,
        "height": None,
        "taken_at": None,
    }

    try:
        with Image.open(file_path) as image:

            metadata["width"] = image.width
            metadata["height"] = image.height

            # ------------------------------------------------
            # EXIF
            # ------------------------------------------------

            exif = image.getexif()

            if exif:

                exif_data = {}

                for key, value in exif.items():

                    tag = ExifTags.TAGS.get(
                        key,
                        key,
                    )

                    exif_data[tag] = value

                date_value = (
                    exif_data.get(
                        "DateTimeOriginal"
                    )
                    or exif_data.get(
                        "DateTime"
                    )
                )

                if date_value:

                    try:

                        metadata["taken_at"] = (
                            datetime.strptime(
                                date_value,
                                "%Y:%m:%d %H:%M:%S",
                            )
                        )

                    except (
                        ValueError,
                        TypeError,
                    ):
                        pass

    except Exception:
        pass

    return metadata


# ============================================================
# VIDEO
# ============================================================

def extract_video_metadata(
    file_path: Path,
) -> dict:

    metadata = {
        "width": None,
        "height": None,
        "duration": None,
    }

    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(file_path),
    ]

    try:

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=True,
        )

        data = json.loads(
            result.stdout
        )

        streams = data.get(
            "streams",
            [],
        )

        if streams:

            stream = streams[0]

            metadata["width"] = (
                stream.get("width")
            )

            metadata["height"] = (
                stream.get("height")
            )

        format_data = data.get(
            "format",
            {},
        )

        duration = format_data.get(
            "duration"
        )

        if duration is not None:

            metadata["duration"] = float(
                duration
            )

    except (
        subprocess.SubprocessError,
        json.JSONDecodeError,
        ValueError,
        OSError,
    ):
        pass

    return metadata


# ============================================================
# THUMBNAIL IMAGE
# ============================================================

def generate_image_thumbnail(
    source: Path,
    destination: Path,
) -> None:

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with Image.open(source) as image:

        image.thumbnail(
            (800, 800),
            Image.Resampling.LANCZOS,
        )

        # Certaines images ont un mode
        # incompatible avec WebP.

        if image.mode not in (
            "RGB",
            "RGBA",
        ):
            image = image.convert(
                "RGB"
            )

        image.save(
            destination,
            "WEBP",
            quality=85,
        )


# ============================================================
# THUMBNAIL VIDEO
# ============================================================

def generate_video_thumbnail(
    source: Path,
    destination: Path,
) -> None:
    """
    Génère une miniature WebP à partir d'une vidéo.

    On essaie d'abord vers 1 seconde, puis au tout début
    de la vidéo si aucune image n'a pu être extraite.
    """

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    attempts = [
        "00:00:01",
        "00:00:00",
    ]

    last_error = None

    for timestamp in attempts:
        command = [
            "ffmpeg",
            "-y",
            "-ss",
            timestamp,
            "-i",
            str(source),
            "-frames:v",
            "1",
            "-vf",
            "scale=800:-1",
            "-c:v",
            "libwebp",
            "-quality",
            "85",
            str(destination),
        ]

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
            )

            if (
                result.returncode == 0
                and destination.is_file()
                and destination.stat().st_size > 0
            ):
                return

        except (
            subprocess.SubprocessError,
            OSError,
        ) as exc:
            last_error = exc

        destination.unlink(
            missing_ok=True
        )

    if last_error:
        raise last_error

    raise RuntimeError(
        f"Unable to generate video thumbnail: {source}"
    )

