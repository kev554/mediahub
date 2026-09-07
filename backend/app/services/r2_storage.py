import os
from io import BytesIO

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv


load_dotenv()


R2_ENDPOINT_URL = os.getenv("R2_ENDPOINT_URL")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")


if not R2_ENDPOINT_URL:
    raise RuntimeError("R2_ENDPOINT_URL manquant dans .env")

if not R2_ACCESS_KEY_ID:
    raise RuntimeError("R2_ACCESS_KEY_ID manquant dans .env")

if not R2_SECRET_ACCESS_KEY:
    raise RuntimeError("R2_SECRET_ACCESS_KEY manquant dans .env")

if not R2_BUCKET_NAME:
    raise RuntimeError("R2_BUCKET_NAME manquant dans .env")


r2_client = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT_URL,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
)


def test_connection() -> bool:
    """
    Vérifie que le backend peut accéder au bucket R2.
    """
    try:
        r2_client.head_bucket(Bucket=R2_BUCKET_NAME)
        return True
    except ClientError as exc:
        print(f"Erreur R2 : {exc}")
        return False


def upload_file(
    file_data: bytes,
    object_key: str,
    content_type: str | None = None,
) -> None:
    """
    Envoie un fichier vers R2.
    """
    extra_args = {}

    if content_type:
        extra_args["ContentType"] = content_type

    r2_client.upload_fileobj(
        BytesIO(file_data),
        R2_BUCKET_NAME,
        object_key,
        ExtraArgs=extra_args,
    )


def delete_file(object_key: str) -> None:
    """
    Supprime un fichier de R2.
    """
    r2_client.delete_object(
        Bucket=R2_BUCKET_NAME,
        Key=object_key,
    )


def file_exists(object_key: str) -> bool:
    """
    Vérifie si un objet existe dans R2.
    """
    try:
        r2_client.head_object(
            Bucket=R2_BUCKET_NAME,
            Key=object_key,
        )
        return True
    except ClientError:
        return False


def download_file(object_key: str) -> bytes:
    """
    Télécharge un fichier depuis R2 en mémoire.
    """
    response = r2_client.get_object(
        Bucket=R2_BUCKET_NAME,
        Key=object_key,
    )

    return response["Body"].read()
