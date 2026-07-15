export interface GuestListingCard {
  listing_id: string;
  title: string;
  area_name: string;
  guest_price_per_night: number;
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
  host_price_per_night: number;
  guest_price_per_night: number;
  min_nights: number;
  max_nights: number;
  security_deposit: number;
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
