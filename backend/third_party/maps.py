import logging
import os
from decimal import Decimal

import requests

logger = logging.getLogger(__name__)

GEOCODING_URL = os.environ.get("GEOCODING_URL", "")


def geocode_address(address: str) -> dict | None:
    """Call Google Geocoding API. Returns {latitude, longitude, formatted_address, google_place_id} or None."""
    api_key = os.environ.get("GOOGLE_MAPS_BACKEND_API_KEY")
    if not api_key:
        logger.warning("GOOGLE_MAPS_BACKEND_API_KEY not set, skipping geocoding")
        return None
    try:
        resp = requests.get(GEOCODING_URL, params={"address": address, "key": api_key}, timeout=5)
        data = resp.json()
        if data.get("status") != "OK" or not data.get("results"):
            return None
        result = data["results"][0]
        loc = result["geometry"]["location"]
        return {
            "latitude": Decimal(str(loc["lat"])),
            "longitude": Decimal(str(loc["lng"])),
            "formatted_address": result.get("formatted_address", ""),
            "google_place_id": result.get("place_id", ""),
        }
    except Exception:
        logger.exception("Geocoding failed for: %s", address)
        return None
