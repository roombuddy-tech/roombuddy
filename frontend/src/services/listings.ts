import api from './api';
import { ENDPOINTS } from '../constants/endpoints';

export interface CreateListingResponse {
  listing_id: string;
  property_id: string;
  status: string;
  message: string;
}

export async function createListing(form: {
  apartmentType: string;
  floorNumber: string;
  totalFloors: string;
  apartmentName: string;
  locality: string;
  city: string;
  googlePlaceId: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
  state: string;
  pincode: string;
  roomType: string;
  bedType: string;
  bathroom: string;

  roomFeatures: string[];
  title: string;
  description: string;
  nearbyLandmarks: string[];
  distanceToLandmark: string;
  flatmates: Array<{ name: string; age: string; occupation: string; hobbies: string; gender: string; hometown: string }>;
  guestGenderPref: string;
  amenities: string[];
  kitchenAccess: boolean;
  homeCooked: boolean;
  mealTypes: string[];
  mealCost: string;
  mealDescription: string;
  nightlyRate: string;
  minStay: string;
  rentalType: 'monthly' | 'nightly';
  monthlyRent: string;
  maintenanceMonthly: string;
  securityDeposit: string;
  setupCostOnetime: string;
  setupCostRefundable: boolean;
  cookAvailable: boolean;
  cookCostMonthly: string;
  maidAvailable: boolean;
  maidCostMonthly: string;
  utilitiesIncluded: boolean;
  utilitiesEstMonthly: string;
  minMonths: string;
  availableFrom: string;
  noSmoking: boolean;
  noLoudMusic: boolean;
  noPets: boolean;
  noParties: boolean;
  shoesOff: boolean;
  kitchenClean: boolean;
  noAlcohol: boolean;
  lockDoor: boolean;
  customRules: string;
  cancellationPolicy: string;
  checkInTime: string;
  checkOutTime: string;
  hostAge: string;
  hostOccupation: string;
  hostHobbies: string;
  hostGender: string;
  hostHometown: string;
  blockedDates: Array<{ startDate: string; endDate: string }>;
}): Promise<CreateListingResponse> {
  const description = _buildDescription(form);

  // Prepend host as first flatmate entry
  const hostFlatmate = form.hostOccupation || form.hostHobbies || form.hostGender || form.hostAge || form.hostHometown
    ? [{
        name: '__host__',
        age: form.hostAge ? parseInt(form.hostAge, 10) : null,
        gender: form.hostGender,
        occupation: form.hostOccupation,
        hobbies: form.hostHobbies,
        hometown: form.hostHometown,
      }]
    : [];

  const body = {
    property: {
      apartment_type: form.apartmentType.toLowerCase().replace('+', ''),
      floor_number: parseInt(form.floorNumber, 10),
      total_floors: form.totalFloors ? parseInt(form.totalFloors, 10) : null,
      apartment_name: form.apartmentName,
      address_line1: form.locality,
      city_name: form.city,
      gender_preference: form.guestGenderPref,
      latitude: form.latitude,
      longitude: form.longitude,
      google_place_id: form.googlePlaceId,
      formatted_address: form.formattedAddress,
      state: form.state,
      pincode: form.pincode ? parseInt(form.pincode, 10) || null : null,
    },
    room: {
      room_type: form.roomType,
      bed_type: form.bedType,
      bathroom_type: form.bathroom,

      room_features: form.roomFeatures,
    },
    flatmates: [
      ...hostFlatmate,
      ...form.flatmates.map((fm) => ({
        name: fm.name,
        age: fm.age ? parseInt(fm.age, 10) : null,
        gender: fm.gender || '',
        occupation: fm.occupation,
        hobbies: fm.hobbies,
        hometown: fm.hometown || '',
      })),
    ],
    amenities: form.amenities,
    title: form.title,
    description,
    ..._pricingPayload(form),
    food_kitchen_access: form.kitchenAccess,
    food_meals_available: form.homeCooked,
    food_meal_cost: form.homeCooked && form.mealCost ? parseFloat(form.mealCost) : null,
    food_meal_description: form.homeCooked ? form.mealDescription : '',
    food_meal_types: form.homeCooked ? form.mealTypes : [],
    house_rules: {
      no_smoking: form.noSmoking,
      no_loud_music: form.noLoudMusic,
      no_pets: form.noPets,
      no_alcohol: form.noAlcohol,
      no_parties: form.noParties,
      shoes_off: form.shoesOff,
      kitchen_clean: form.kitchenClean,
      lock_door: form.lockDoor,
      custom_rules: form.customRules,
      cancellation_policy: form.cancellationPolicy,
      check_in_time: form.checkInTime,
      check_out_time: form.checkOutTime,
    },
    blocked_dates: (form.blockedDates || []).map((bd) => ({
      start_date: bd.startDate,
      end_date: bd.endDate,
    })),
  };

  const res = await api.post<CreateListingResponse>(ENDPOINTS.HOST.CREATE_LISTING, body);
  return res.data;
}

export async function getListing(listingId: string): Promise<any> {
  const res = await api.get(ENDPOINTS.HOST.LISTING_DETAIL(listingId));
  return res.data;
}

export async function updateBlockedDates(
  listingId: string,
  blockedDates: Array<{ start_date: string; end_date: string }>,
): Promise<any> {
  const res = await api.patch(ENDPOINTS.HOST.LISTING_BLOCKED_DATES(listingId), {
    blocked_dates: blockedDates,
  });
  return res.data;
}

export async function deleteListing(listingId: string): Promise<void> {
  await api.delete(ENDPOINTS.HOST.LISTING_DETAIL(listingId));
}

export async function toggleSnooze(listingId: string): Promise<{ listing_id: string; status: string }> {
  const res = await api.patch(ENDPOINTS.HOST.LISTING_SNOOZE(listingId));
  return res.data;
}

export async function updateListing(
  listingId: string,
  form: Parameters<typeof createListing>[0] & { photos?: Record<string, string[]> },
): Promise<CreateListingResponse> {
  const description = _buildDescription(form);

  const hostFlatmate = form.hostOccupation || form.hostHobbies || form.hostGender || form.hostAge || form.hostHometown
    ? [{
        name: '__host__',
        age: form.hostAge ? parseInt(form.hostAge, 10) : null,
        gender: form.hostGender,
        occupation: form.hostOccupation,
        hobbies: form.hostHobbies,
        hometown: form.hostHometown,
      }]
    : [];

  const body = {
    property: {
      apartment_type: form.apartmentType.toLowerCase().replace('+', ''),
      floor_number: parseInt(form.floorNumber, 10),
      total_floors: form.totalFloors ? parseInt(form.totalFloors, 10) : null,
      apartment_name: form.apartmentName,
      address_line1: form.locality,
      city_name: form.city,
      gender_preference: form.guestGenderPref,
      latitude: form.latitude,
      longitude: form.longitude,
      google_place_id: form.googlePlaceId,
      formatted_address: form.formattedAddress,
      state: form.state,
      pincode: form.pincode ? parseInt(form.pincode, 10) || null : null,
    },
    room: {
      room_type: form.roomType,
      bed_type: form.bedType,
      bathroom_type: form.bathroom,

      room_features: form.roomFeatures,
    },
    flatmates: [
      ...hostFlatmate,
      ...form.flatmates.map((fm) => ({
        name: fm.name,
        age: fm.age ? parseInt(fm.age, 10) : null,
        gender: fm.gender || '',
        occupation: fm.occupation,
        hobbies: fm.hobbies,
        hometown: fm.hometown || '',
      })),
    ],
    amenities: form.amenities,
    title: form.title,
    description,
    ..._pricingPayload(form),
    food_kitchen_access: form.kitchenAccess,
    food_meals_available: form.homeCooked,
    food_meal_cost: form.homeCooked && form.mealCost ? parseFloat(form.mealCost) : null,
    food_meal_description: form.homeCooked ? form.mealDescription : '',
    food_meal_types: form.homeCooked ? form.mealTypes : [],
    house_rules: {
      no_smoking: form.noSmoking,
      no_loud_music: form.noLoudMusic,
      no_pets: form.noPets,
      no_alcohol: form.noAlcohol,
      no_parties: form.noParties,
      shoes_off: form.shoesOff,
      kitchen_clean: form.kitchenClean,
      lock_door: form.lockDoor,
      custom_rules: form.customRules,
      cancellation_policy: form.cancellationPolicy,
      check_in_time: form.checkInTime,
      check_out_time: form.checkOutTime,
    },
    blocked_dates: (form.blockedDates || []).map((bd) => ({
      start_date: bd.startDate,
      end_date: bd.endDate,
    })),
    // Existing (already-uploaded) photos the host still wants. The backend
    // deletes any of the listing's photos not in this list.
    kept_photo_urls: Object.values(form.photos ?? {})
      .flat()
      .filter((u) => typeof u === 'string' && u.startsWith('http')),
  };

  const res = await api.patch<CreateListingResponse>(ENDPOINTS.HOST.LISTING_DETAIL(listingId), body);
  return res.data;
}

function _buildDescription(form: {
  description: string;
  nearbyLandmarks: string[];
  distanceToLandmark: string;
}): string {
  let desc = form.description.trim();
  if (form.nearbyLandmarks.length > 0) {
    const landmark = form.nearbyLandmarks[0];
    const dist = form.distanceToLandmark?.trim();
    desc += dist
      ? `\n\nNearby: ${landmark} (${dist} min walk)`
      : `\n\nNearby: ${landmark}`;
  }
  return desc;
}

// Build the pricing slice of the create/update payload, branching on rental type.
function _pricingPayload(form: any): Record<string, any> {
  const num = (s: string) => (s ? parseInt(s, 10) : 0);
  if (form.rentalType === 'monthly') {
    return {
      rental_type: 'monthly',
      monthly_rent: num(form.monthlyRent) || null,
      maintenance_monthly: num(form.maintenanceMonthly),
      security_deposit: num(form.securityDeposit),
      setup_cost_onetime: num(form.setupCostOnetime),
      setup_cost_refundable: !!form.setupCostRefundable,
      cook_available: !!form.cookAvailable,
      cook_cost_monthly: form.cookAvailable ? (num(form.cookCostMonthly) || null) : null,
      maid_available: !!form.maidAvailable,
      maid_cost_monthly: form.maidAvailable ? (num(form.maidCostMonthly) || null) : null,
      utilities_included: !!form.utilitiesIncluded,
      utilities_est_monthly: form.utilitiesIncluded ? null : (num(form.utilitiesEstMonthly) || null),
      min_months: num(form.minMonths) || null,
      available_from: form.availableFrom || null,
    };
  }
  return {
    rental_type: 'nightly',
    host_price_per_night: parseFloat(form.nightlyRate),
    min_nights: _mapMinStay(form.minStay),
  };
}

function _mapMinStay(val: string): number {
  switch (val) {
    case '2_nights': return 2;
    case '3_nights': return 3;
    case '1_week': return 7;
    case '2_weeks': return 14;
    case '1_month': return 30;
    default: return 1;
  }
}
