import api from './api';
import { ENDPOINTS } from '../constants/endpoints';

// Maps wizard form category keys → DB area values
const AREA_MAP: Record<string, string> = {
  bedroom: 'bedroom',
  bathroom: 'washroom',
  kitchen: 'kitchen',
  living: 'living_room',
  entrance: 'other',
  balcony: 'other',
  other: 'other',
};

export interface UploadPhotoResult {
  photo_id: string;
  url: string;
  thumbnail_url: string;
  area: string;
  is_cover: boolean;
}

export async function uploadPropertyPhoto(
  propertyId: string,
  uri: string,
  categoryKey: string,
  isCover: boolean,
): Promise<UploadPhotoResult> {
  const area = AREA_MAP[categoryKey] ?? 'other';

  const fd = new FormData();
  fd.append('image', { uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
  fd.append('area', area);
  fd.append('is_cover', isCover ? 'true' : 'false');

  const res = await api.post<UploadPhotoResult>(
    ENDPOINTS.HOST.PROPERTY_PHOTOS(propertyId),
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
}

/**
 * Uploads all wizard photos for a property sequentially.
 * First photo across all categories becomes the cover.
 * Returns counts of successes and failures.
 */
export async function uploadAllPropertyPhotos(
  propertyId: string,
  photos: Record<string, string[]>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ uploaded: number; failed: number }> {
  const categoryOrder = ['bedroom', 'bathroom', 'kitchen', 'living', 'entrance', 'balcony', 'other'];

  // If any photo is already an S3 URL, the property already has uploaded photos.
  // In that case don't promote a newly added photo to cover — the existing cover stays.
  const hasExistingPhotos = Object.values(photos).flat().some(u => u.startsWith('http'));

  // Only queue local-device URIs — remote URLs are already uploaded, skip entirely.
  const queue: { uri: string; category: string; isCover: boolean }[] = [];
  let isFirstNew = true;
  for (const cat of categoryOrder) {
    for (const uri of photos[cat] ?? []) {
      if (uri.startsWith('http')) continue;
      queue.push({ uri, category: cat, isCover: !hasExistingPhotos && isFirstNew });
      isFirstNew = false;
    }
  }

  let uploaded = 0;
  let failed = 0;
  const total = queue.length;

  for (const { uri, category, isCover } of queue) {
    try {
      await uploadPropertyPhoto(propertyId, uri, category, isCover);
      uploaded++;
    } catch {
      failed++;
    }
    onProgress?.(uploaded + failed, total);
  }

  return { uploaded, failed };
}
