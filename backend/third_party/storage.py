import os
import uuid
import logging
from io import BytesIO
from PIL import Image
from pathlib import Path


logger = logging.getLogger(__name__)

STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "local")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "roombuddy-profile-picture-uploads")
S3_REGION = os.getenv("S3_REGION", "ap-south-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")

# Local storage directory (for dev)
LOCAL_MEDIA_DIR = os.getenv("LOCAL_MEDIA_DIR", "media")

# Max file sizes
MAX_IMAGE_SIZE_MB = 5
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024


class StorageError(Exception):
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


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
    # Validate file size
    if hasattr(file_obj, 'size') and file_obj.size > MAX_IMAGE_SIZE_BYTES:
        raise StorageError(f"File too large. Maximum size is {MAX_IMAGE_SIZE_MB}MB.")

    # Read and validate image
    try:
        image = Image.open(file_obj)
        image.verify()
        file_obj.seek(0)
        image = Image.open(file_obj)
    except Exception:
        raise StorageError("Invalid image file. Please upload a JPEG or PNG.")

    # Convert to RGB if needed (handles RGBA PNGs)
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    # Generate filename
    ext = "jpg"
    if not filename:
        filename = f"{uuid.uuid4().hex}.{ext}"
    elif not filename.endswith(('.jpg', '.jpeg', '.png')):
        filename = f"{filename}.{ext}"

    key = f"{folder}/{filename}"

    # Resize main image
    main_image = _resize_image(image, max_width)
    main_buffer = _image_to_buffer(main_image)

    # Create thumbnail
    thumbnail = _resize_image(image, 300)
    thumb_key = f"{folder}/thumbs/{filename}"
    thumb_buffer = _image_to_buffer(thumbnail)

    # Upload
    provider = STORAGE_PROVIDER.lower()

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
    provider = STORAGE_PROVIDER.lower()

    if provider == "local":
        return _delete_local(key)
    elif provider == "s3":
        return _delete_s3(key)
    return False


def _resize_image(image: Image.Image, max_width: int) -> Image.Image:
    """Resize image maintaining aspect ratio."""
    if image.width <= max_width:
        return image.copy()
    ratio = max_width / image.width
    new_height = int(image.height * ratio)
    return image.resize((max_width, new_height), Image.LANCZOS)


def _image_to_buffer(image: Image.Image, quality: int = 85) -> BytesIO:
    """Convert PIL Image to BytesIO buffer."""
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    buffer.seek(0)
    return buffer


# ─── Local storage (dev) ──────────────────────────────────────

def _upload_local(buffer: BytesIO, key: str) -> str:
    """Save file locally for development."""
    from django.conf import settings
    media_dir = Path(settings.BASE_DIR) / LOCAL_MEDIA_DIR
    file_path = media_dir / key
    file_path.parent.mkdir(parents=True, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(buffer.read())

    logger.info(f"[LOCAL] Saved: {file_path}")
    return f"/media/{key}"


def _delete_local(key: str) -> bool:
    """Delete file from local storage."""
    from django.conf import settings
    file_path = Path(settings.BASE_DIR) / LOCAL_MEDIA_DIR / key
    thumb_path = Path(settings.BASE_DIR) / LOCAL_MEDIA_DIR / key.replace(key.split("/")[-1], f"thumbs/{key.split('/')[-1]}")

    for p in [file_path, thumb_path]:
        if p.exists():
            p.unlink()

    return True


# ─── S3 storage (production) ─────────────────────────────────

def _upload_s3(buffer: BytesIO, key: str) -> str:
    """Upload file to S3. Returns public URL."""
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        raise StorageError("boto3 not installed.")

    if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
        raise StorageError("AWS credentials not configured.")

    try:
        client = boto3.client(
            "s3",
            region_name=S3_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

        client.upload_fileobj(
            buffer,
            S3_BUCKET_NAME,
            key,
            ExtraArgs={
                "ContentType": "image/jpeg",
                "CacheControl": "max-age=31536000",
            },
        )

        url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{key}"
        logger.info(f"[S3] Uploaded: {url}")
        return url

    except ClientError as e:
        logger.error(f"S3 upload error: {e}")
        raise StorageError("Failed to upload image.")


def _delete_s3(key: str) -> bool:
    """Delete file from S3."""
    try:
        import boto3
        from botocore.exceptions import ClientError

        client = boto3.client(
            "s3",
            region_name=S3_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

        # Delete main and thumbnail
        thumb_key = key.replace(key.split("/")[-1], f"thumbs/{key.split('/')[-1]}")
        for k in [key, thumb_key]:
            try:
                client.delete_object(Bucket=S3_BUCKET_NAME, Key=k)
            except ClientError:
                pass

        logger.info(f"[S3] Deleted: {key}")
        return True

    except Exception as e:
        logger.error(f"S3 delete error: {e}")
        return False