from pathlib import Path
from collections.abc import Iterator
from uuid import uuid4
import os

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv


# ============================================================
# ENVIRONNEMENT
# ============================================================

load_dotenv(
    Path(__file__).resolve().parents[2] / ".env"
)


# ============================================================
# STOCKAGE LOCAL TEMPORAIRE
# ============================================================

BASE_STORAGE = Path(
    os.getenv(
        "MEDIAHUB_STORAGE_DIR",
        str(Path.home() / "projects" / "mediahub" / "storage"),
    )
)

TEMP_DIR = BASE_STORAGE / "temp"


# ============================================================
# CLOUDFLARE R2
# ============================================================

R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_PUBLIC_ENDPOINT_URL = os.getenv(
    "R2_PUBLIC_ENDPOINT_URL",
    R2_ENDPOINT_URL,
)
R2_REGION = os.getenv("R2_REGION", "auto")


if not R2_ENDPOINT_URL:
    raise RuntimeError(
        "R2_ENDPOINT_URL manquant dans backend/.env"
    )

if not R2_ACCESS_KEY_ID:
    raise RuntimeError(
        "R2_ACCESS_KEY_ID manquant dans backend/.env"
    )

if not R2_SECRET_ACCESS_KEY:
    raise RuntimeError(
        "R2_SECRET_ACCESS_KEY manquant dans backend/.env"
    )

if not R2_BUCKET_NAME:
    raise RuntimeError(
        "R2_BUCKET_NAME manquant dans backend/.env"
    )


r2_client = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name=R2_REGION,
)

public_r2_client = boto3.client(
    "s3",
    endpoint_url=R2_PUBLIC_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name=R2_REGION,
)


# ============================================================
# INITIALISATION DU STOCKAGE
# ============================================================

def initialize_storage() -> None:
    """
    Crée uniquement le stockage temporaire local.

    Les fichiers permanents sont stockés dans R2.
    """

    TEMP_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )


# ============================================================
# NOM DE FICHIER
# ============================================================

def generate_storage_filename(
    extension: str,
) -> str:

    unique_id = uuid4().hex

    extension = extension.lower().strip()

    if extension and not extension.startswith("."):
        extension = f".{extension}"

    return f"{unique_id}{extension}"


# ============================================================
# UPLOAD R2
# ============================================================

def upload_to_r2(
    local_path: Path,
    object_key: str,
    content_type: str | None = None,
) -> None:

    extra_args = {}

    if content_type:
        extra_args["ContentType"] = content_type

    with local_path.open("rb") as file:
        r2_client.upload_fileobj(
            file,
            R2_BUCKET_NAME,
            object_key,
            ExtraArgs=extra_args,
        )


# ============================================================
# DOWNLOAD R2
# ============================================================

def stream_from_r2(
    object_key: str,
) -> Iterator[bytes]:

    response = r2_client.get_object(
        Bucket=R2_BUCKET_NAME,
        Key=object_key,
    )

    body = response["Body"]

    def chunks() -> Iterator[bytes]:
        try:
            yield from body.iter_chunks(chunk_size=1024 * 1024)
        finally:
            body.close()

    return chunks()


def check_r2_connection() -> None:
    r2_client.head_bucket(Bucket=R2_BUCKET_NAME)


def create_media_url(
    object_key: str,
    content_type: str,
    filename: str,
    disposition: str = "inline",
) -> str:
    from urllib.parse import quote

    encoded_filename = quote(filename, safe="")
    return public_r2_client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": R2_BUCKET_NAME,
            "Key": object_key,
            "ResponseContentType": content_type,
            "ResponseContentDisposition": (
                f"{disposition}; filename*=UTF-8''{encoded_filename}"
            ),
        },
        ExpiresIn=300,
    )


# ============================================================
# SUPPRESSION R2
# ============================================================

def delete_from_r2(
    object_key: str,
) -> None:

    r2_client.delete_object(
        Bucket=R2_BUCKET_NAME,
        Key=object_key,
    )


# ============================================================
# EXISTENCE D'UN OBJET
# ============================================================

def r2_file_exists(
    object_key: str,
) -> bool:

    try:

        r2_client.head_object(
            Bucket=R2_BUCKET_NAME,
            Key=object_key,
        )

        return True

    except ClientError as exc:

        error_code = (
            exc.response
            .get("Error", {})
            .get("Code")
        )

        if error_code in {
            "404",
            "NoSuchKey",
            "NoSuchObject",
            "NotFound",
        }:
            return False

        raise
