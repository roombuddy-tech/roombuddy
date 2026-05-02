import { ENDPOINTS } from '../constants/endpoints';
import type {
    Booking,
    BookingQuote,
    CancelBookingResponse,
} from '../types/booking';
import api from './api';

/** Get a price breakdown for the given dates without creating a booking. */
export async function getQuote(
  listingId: string,
  checkIn: string,
  checkOut: string,
): Promise<BookingQuote> {
  const res = await api.post<BookingQuote>(ENDPOINTS.BOOKING.QUOTE, {
    listing_id: listingId,
    check_in_date: checkIn,
    check_out_date: checkOut,
  });
  return res.data;
}

/** Create a pending booking (does not charge yet). */
export async function createBooking(payload: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  numberOfGuests?: number;
  guestPurpose?: string;
  specialRequests?: string;
}): Promise<Booking> {
  const res = await api.post<Booking>(ENDPOINTS.BOOKING.CREATE, {
    listing_id: payload.listingId,
    check_in_date: payload.checkIn,
    check_out_date: payload.checkOut,
    number_of_guests: payload.numberOfGuests ?? 1,
    guest_purpose: payload.guestPurpose,
    special_requests: payload.specialRequests,
  });
  return res.data;
}

/** Cancel a booking. Refund (if any) is computed by the backend per policy. */
export async function cancelBooking(
  bookingId: string,
  reason: string = '',
): Promise<CancelBookingResponse> {
  const res = await api.post<CancelBookingResponse>(
    ENDPOINTS.BOOKING.CANCEL(bookingId),
    { reason },
  );
  return res.data;
}