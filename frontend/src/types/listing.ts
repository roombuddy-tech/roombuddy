export interface GuestListingCard {
  listing_id: string;
  title: string;
  area_name: string;
  guest_price_per_night: number | null;
  rental_type?: 'monthly' | 'nightly';
  display_price?: number | null;
  price_unit?: string;
  monthly_rent?: number | null;
  recurring_monthly?: number | null;
  cover_photo_url: string | null;
  average_rating: number | null;
  review_count: number;
  room_type: string;
  apartment_type: string;
  amenity_highlights: string[];
  booking_mode: string;
  gender_preference: string;
  min_nights: number;
  meals_available: boolean;
  meal_cost_per_day: number | null;
  description?: string;
  latitude: number | null;
  longitude: number | null;
  distance_km?: number | null;
}

export interface ListingPhoto {
  url: string;
  thumbnail_url: string | null;
  area: string;
  is_cover: boolean;
}

export interface ListingFlatmate {
  name: string;
  age: number | null;
  gender: string;
  occupation: string;
  hobbies: string;
  hometown: string;
}

export interface GuestListingDetail {
  listing_id: string;
  title: string;
  description: string;
  booking_mode: string;
  rental_type: 'monthly' | 'nightly';
  host_price_per_night: number | null;
  guest_price_per_night: number | null;
  monthly_rent: number | null;
  recurring_monthly: number | null;
  min_nights: number;
  max_nights: number;
  min_months: number | null;
  available_from: string | null;
  security_deposit: number;
  monthly_breakdown: {
    monthly_rent: number;
    maintenance_monthly: number;
    security_deposit: number;
    setup_cost_onetime: number;
    setup_cost_refundable: boolean;
    cook_available: boolean;
    cook_cost_monthly: number | null;
    maid_available: boolean;
    maid_cost_monthly: number | null;
    utilities_included: boolean;
    utilities_est_monthly: number | null;
    recurring_monthly: number;
    move_in_cost: number;
  } | null;
  property: {
    apartment_type: string;
    floor_number: number;
    apartment_name: string;
    city_name: string;
    gender_preference: string;
    latitude: number | null;
    longitude: number | null;
    formatted_address: string;
  };
  room: {
    room_type: string;
    bed_type: string;
    bathroom_type: string;

    room_features: string[];
  };
  photos: ListingPhoto[];
  amenities: Array<{ display_name: string; category: string }>;
  flatmates: ListingFlatmate[];
  host_info: { age: number | null; occupation: string; hobbies: string; gender: string; hometown: string };
  host_verifications: { aadhaar: boolean; email: boolean; phone: boolean };
  food: {
    kitchen_access: boolean;
    meals_available: boolean;
    meal_cost: number | null;
    meal_description: string;
    meal_types: string | null;
  };
  house_rules: {
    no_smoking: boolean;
    no_loud_music: boolean;
    no_pets: boolean;
    no_alcohol: boolean;
    no_parties: boolean;
    shoes_off: boolean;
    kitchen_clean: boolean;
    lock_door: boolean;
    custom_rules: string | null;
  };
  check_in_from: string;
  check_out_by: string;
  average_rating: number | null;
  review_count: number;
  total_bookings: number;
  host_name: string;
  host_profile: {
    full_name: string;
    photo_url: string | null;
    gender: string;
    member_since: string;
    age?: number | null;
    occupation?: string;
    hobbies?: string;
    hometown?: string;
  };
  contact_unlocked: boolean;
  host_phone: string | null;
  host_phone_masked: string | null;
  unlock_fee: number;
  area_name: string;
}

/**
 * Price string for a listing card, handling both rental types safely.
 * Monthly → "₹18,000" + unit "/mo"; nightly → "₹850" + unit "/night".
 * Null-safe: monthly listings have no nightly price and vice versa.
 */
export function cardPrice(item: {
  rental_type?: 'monthly' | 'nightly';
  display_price?: number | null;
  monthly_rent?: number | null;
  recurring_monthly?: number | null;
  guest_price_per_night?: number | null;
  host_price_per_night?: number | null;
}): { amount: string; unit: string } {
  const isMonthly = item.rental_type === 'monthly';
  // Monthly shows the FULL recurring cost (rent + maintenance + cook + maid +
  // utilities), which the backend precomputes — not the bare rent.
  const raw = isMonthly
    ? (item.recurring_monthly ?? item.display_price ?? item.monthly_rent)
    : (item.guest_price_per_night ?? item.host_price_per_night ?? item.display_price);
  return {
    amount: `₹${Math.round(raw ?? 0).toLocaleString('en-IN')}`,
    unit: isMonthly ? '/mo' : '/night',
  };
}

/**
 * Human-readable label + icon for a property's gender preference.
 * Used on listing cards, the guest detail page and the host preview so the
 * wording stays identical everywhere.
 */
export function genderPrefMeta(pref?: string | null): { label: string; short: string; icon: any } {
  switch (pref) {
    case 'female_only':
      return { label: 'Female guests only', short: 'Female only', icon: 'female-outline' };
    case 'male_only':
      return { label: 'Male guests only', short: 'Male only', icon: 'male-outline' };
    default:
      return { label: 'Open to all genders', short: 'Any gender', icon: 'people-outline' };
  }
}
