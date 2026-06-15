from apps.properties.models import Property, PropertyPhoto
from apps.users.models import User
from third_party.storage import upload_image, get_photo_url, StorageError
import logging

logger = logging.getLogger(__name__)


def upload_property_photo(user: User, property_id: str, image_file, area: str, is_cover: bool = False) -> dict | None:
    """Upload a photo for a property and save a PropertyPhoto record."""
    try:
        prop = Property.objects.get(id=property_id, host_user=user)
    except Property.DoesNotExist:
        return None

    result = upload_image(
        image_file,
        folder=f"properties/photos/{property_id}",
        max_width=1200,
    )

    if is_cover:
        PropertyPhoto.objects.filter(property=prop, is_cover=True).update(is_cover=False)

    photo = PropertyPhoto.objects.create(
        property=prop,
        area=area,
        url=result["url"],
        thumbnail_url=result["thumbnail_url"],
        is_cover=is_cover,
        moderation_status=PropertyPhoto.ModerationStatus.PENDING,
    )

    return {
        "photo_id": str(photo.id),
        "url": get_photo_url(photo.url),
        "thumbnail_url": get_photo_url(photo.thumbnail_url) if photo.thumbnail_url else None,
        "area": photo.area,
        "is_cover": photo.is_cover,
    }
