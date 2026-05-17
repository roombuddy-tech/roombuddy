import api from './api';
import { ENDPOINTS } from '../constants/endpoints';
import type { GuestListingCard, GuestListingDetail } from '../types/listing';

export async function searchListings(params?: {
  q?: string;
  area?: string;
  check_in?: string;
  check_out?: string;
  lat?: number;
  lng?: number;
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
