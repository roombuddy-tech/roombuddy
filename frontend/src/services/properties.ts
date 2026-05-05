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

  const queue: { uri: string; category: string; isCover: boolean }[] = [];
  let isFirstOverall = true;
  for (const cat of categoryOrder) {
    for (const uri of photos[cat] ?? []) {
      queue.push({ uri, category: cat, isCover: isFirstOverall });
      isFirstOverall = false;
    }
  }

  let uploaded = 0;
  let failed = 0;
  const total = queue.length;

  for (const { uri, category, isCover } of queue) {
    if (uri.startsWith('http')) {
      // Already an S3/remote URL — skip re-upload
      uploaded++;
      onProgress?.(uploaded + failed, total);
      continue;
    }
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
