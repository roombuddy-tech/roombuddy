import api from './api';
import { ENDPOINTS } from '../constants/endpoints';
import type { GuestListingCard, GuestListingDetail } from '../types/listing';

export type SortOption = 'recommended' | 'price_low' | 'price_high' | 'rating' | 'distance';

export async function searchListings(params?: {
  q?: string;
  area?: string;
  check_in?: string;
  check_out?: string;
  lat?: number;
  lng?: number;
  min_price?: number;
  max_price?: number;
  min_rating?: number;
  sort?: SortOption;
}): Promise<{ count: number; results: GuestListingCard[] }> {
  const res = await api.get(ENDPOINTS.GUEST.SEARCH, { params });
  return res.data;
}

export async function getGuestListingDetail(
  listingId: string,
): Promise<GuestListingDetail> {
  const res = await api.get(ENDPOINTS.GUEST.LISTING_DETAIL(listingId));
  return res.data;
}
