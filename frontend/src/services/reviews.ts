import api from './api';

export interface ReviewBreakdown {
  cleanliness: number | null;
  accuracy: number | null;
  communication: number | null;
  location: number | null;
  value: number | null;
  food: number | null;
}

export interface ReviewItem {
  id: string;
  booking_id: string;
  reviewer_name: string;
  reviewer_initials: string;
  reviewer_photo_url: string | null;
  overall_rating: number;
  cleanliness_rating: number | null;
  accuracy_rating: number | null;
  communication_rating: number | null;
  location_rating: number | null;
  value_rating: number | null;
  food_rating: number | null;
  title: string | null;
  body: string | null;
  submitted_at: string;
  host_response: string | null;
  host_responded_at: string | null;
}

export interface ListingReviewsResponse {
  total: number;
  average_rating: number | null;
  breakdown: ReviewBreakdown;
  reviews: ReviewItem[];
}

export interface SubmitReviewPayload {
  overall_rating: number;
  cleanliness_rating?: number;
  accuracy_rating?: number;
  communication_rating?: number;
  location_rating?: number;
  value_rating?: number;
  food_rating?: number;
  title?: string;
  body?: string;
}

export async function getListingReviews(listingId: string): Promise<ListingReviewsResponse> {
  const res = await api.get(`/api/reviews/listings/${listingId}/`);
  return res.data;
}

export async function checkReviewEligibility(bookingId: string): Promise<{ eligible: boolean; reason: string | null }> {
  const res = await api.get(`/api/reviews/bookings/${bookingId}/eligibility/`);
  return res.data;
}

export async function submitReview(bookingId: string, payload: SubmitReviewPayload): Promise<ReviewItem> {
  const res = await api.post(`/api/reviews/bookings/${bookingId}/`, payload);
  return res.data;
}

export async function getMyReview(bookingId: string): Promise<ReviewItem | null> {
  const res = await api.get(`/api/reviews/bookings/${bookingId}/mine/`);
  return res.data.review;
}
