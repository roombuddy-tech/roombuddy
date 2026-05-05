import os
import uuid
import logging
from io import BytesIO
from PIL import Image
from pathlib import Path


logger = logging.getLogger(__name__)

MAX_IMAGE_SIZE_MB = 5
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024


class StorageError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def get_photo_url(url: str, expires_in: int = 3600) -> str:
    """
    Return a client-displayable URL for a stored photo.
    - S3 URLs → 1-hour pre-signed URL
    - Local /media/ paths → absolute URL using SITE_URL
    """
    if not url:
        return url

    provider = os.getenv("STORAGE_PROVIDER", "local").lower()

    if provider == "s3" and url.startswith("https://"):
        bucket = os.getenv("S3_BUCKET_NAME", "roombuddy-media")
        region = os.getenv("S3_REGION", "ap-south-1")
        prefix = f"https://{bucket}.s3.{region}.amazonaws.com/"
        if url.startswith(prefix):
            key = url[len(prefix):]
            return _generate_presigned_url(key, expires_in, bucket, region)
    elif url.startswith("/media/"):
        from django.conf import settings
        site_url = getattr(settings, "SITE_URL", "http://localhost:8000").rstrip("/")
        return f"{site_url}{url}"

    return url


def _generate_presigned_url(key: str, expires_in: int, bucket: str, region: str) -> str:
    try:
        import boto3
        from botocore.config import Config
    except ImportError:
        raise StorageError("boto3 not installed.")

    access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")

    # endpoint_url forces the regional endpoint; addressing_style='virtual' produces
    # virtual-hosted URLs (bucket.s3.region.amazonaws.com/key) which are universally
    # supported and avoid the 307 redirect that breaks path-style presigned signatures.
    client = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        endpoint_url=f"https://s3.{region}.amazonaws.com",
        config=Config(s3={"addressing_style": "virtual"}),
    )
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def upload_image(file_obj, folder: str, filename: str = None, max_width: int = 1200) -> dict:
    """
    Upload an image file. Returns dict with url and thumbnail_url.

    Args:
        file_obj: Django UploadedFile or file-like object
        folder: S3 key prefix, e.g. 'profiles', 'properties/photos'
        filename: Optional custom filename. Auto-generated if not provided
        max_width: Max width to resize to (preserves aspect ratio)

    Returns:
        {"url": "https://...", "thumbnail_url": "https://...", "key": "profiles/abc123.jpg"}
    """
    if hasattr(file_obj, 'size') and file_obj.size > MAX_IMAGE_SIZE_BYTES:
        raise StorageError(f"File too large. Maximum size is {MAX_IMAGE_SIZE_MB}MB.")

    try:
        image = Image.open(file_obj)
        image.verify()
        file_obj.seek(0)
        image = Image.open(file_obj)
    except Exception:
        raise StorageError("Invalid image file. Please upload a JPEG or PNG.")

    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    ext = "jpg"
    if not filename:
        filename = f"{uuid.uuid4().hex}.{ext}"
    elif not filename.endswith(('.jpg', '.jpeg', '.png')):
        filename = f"{filename}.{ext}"

    key = f"{folder}/{filename}"

    main_image = _resize_image(image, max_width)
    main_buffer = _image_to_buffer(main_image)

    thumbnail = _resize_image(image, 300)
    thumb_key = f"{folder}/thumbs/{filename}"
    thumb_buffer = _image_to_buffer(thumbnail)

    provider = os.getenv("STORAGE_PROVIDER", "local").lower()

    if provider == "local":
        url = _upload_local(main_buffer, key)
        thumbnail_url = _upload_local(thumb_buffer, thumb_key)
    elif provider == "s3":
        url = _upload_s3(main_buffer, key)
        thumbnail_url = _upload_s3(thumb_buffer, thumb_key)
    else:
        raise StorageError(f"Unknown storage provider: {provider}")

    return {
        "url": url,
        "thumbnail_url": thumbnail_url,
        "key": key,
    }


def delete_image(key: str) -> bool:
    """Delete an image by its key. Also deletes thumbnail."""
    provider = os.getenv("STORAGE_PROVIDER", "local").lower()

    if provider == "local":
        return _delete_local(key)
    elif provider == "s3":
        return _delete_s3(key)
    return False


def _resize_image(image: Image.Image, max_width: int) -> Image.Image:
    if image.width <= max_width:
        return image.copy()
    ratio = max_width / image.width
    new_height = int(image.height * ratio)
    return image.resize((max_width, new_height), Image.LANCZOS)


def _image_to_buffer(image: Image.Image, quality: int = 85) -> BytesIO:
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    buffer.seek(0)
    return buffer


# ─── Local storage (dev) ──────────────────────────────────────

def _upload_local(buffer: BytesIO, key: str) -> str:
    from django.conf import settings
    local_media_dir = os.getenv("LOCAL_MEDIA_DIR", "media")
    media_dir = Path(settings.BASE_DIR) / local_media_dir
    file_path = media_dir / key
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(buffer.read())

    logger.info(f"[LOCAL] Saved: {file_path}")
    return f"/media/{key}"


def _delete_local(key: str) -> bool:
    from django.conf import settings
    local_media_dir = os.getenv("LOCAL_MEDIA_DIR", "media")
    file_path = Path(settings.BASE_DIR) / local_media_dir / key
    thumb_path = Path(settings.BASE_DIR) / local_media_dir / key.replace(key.split("/")[-1], f"thumbs/{key.split('/')[-1]}")

    for p in [file_path, thumb_path]:
        if p.exists():
            p.unlink()

    return True


# ─── S3 storage (production) ─────────────────────────────────

def _upload_s3(buffer: BytesIO, key: str) -> str:
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        raise StorageError("boto3 not installed.")

    access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
    secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    bucket = os.getenv("S3_BUCKET_NAME", "roombuddy-media")
    region = os.getenv("S3_REGION", "ap-south-1")

    if not access_key or not secret_key:
        raise StorageError("AWS credentials not configured.")

    try:
        client = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

        client.upload_fileobj(
            buffer,
            bucket,
            key,
            ExtraArgs={
                "ContentType": "image/jpeg",
                "CacheControl": "max-age=31536000",
            },
        )

        url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        logger.info(f"[S3] Uploaded: {url}")
        return url

    except ClientError as e:
        logger.error(f"S3 upload error: {e}")
        raise StorageError("Failed to upload image.")


def _delete_s3(key: str) -> bool:
    try:
        import boto3
        from botocore.exceptions import ClientError

        access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
        secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
        bucket = os.getenv("S3_BUCKET_NAME", "roombuddy-media")
        region = os.getenv("S3_REGION", "ap-south-1")

        client = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )

        thumb_key = key.replace(key.split("/")[-1], f"thumbs/{key.split('/')[-1]}")
        for k in [key, thumb_key]:
            try:
                client.delete_object(Bucket=bucket, Key=k)
            except ClientError:
                pass

        logger.info(f"[S3] Deleted: {key}")
        return True

    except Exception as e:
        logger.error(f"S3 delete error: {e}")
        return False
