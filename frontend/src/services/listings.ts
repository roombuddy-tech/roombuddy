import api from './api';
import { ENDPOINTS } from '../constants/endpoints';

export interface CreateListingResponse {
  listing_id: string;
  property_id: string;
  status: string;
  message: string;
}

export interface ListingFormInput {
  apartmentType: string;
  floorNumber: string;
  totalFloors: string;
  apartmentName: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  roomType: string;
  bedType: string;
  bathroom: string;
  roomSize: string;
  roomFeatures: string[];
  title: string;
  description: string;
  nearbyLandmark: string;
  landmarkDistance: string;
  landmarkDetails: string;
  flatmates: Array<{ id?: string; name: string; age: string; occupation: string; hobbies: string; gender: string; nativeTown: string }>;
  guestGenderPref: string;
  amenities: string[];
  kitchenAccess: boolean;
  homeCooked: boolean;
  mealTypes: string[];
  mealCost: string;
  mealDescription: string;
  nightlyRate: string;
  minStay: string;
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
  hostOccupation: string;
  hostHobbies: string;
  hostGender: string;
  hostNativeTown: string;
  photos?: Record<string, string[]>;
}

export async function createListing(form: ListingFormInput): Promise<CreateListingResponse> {
  const description = _buildDescription(form);

  // Prepend host as first flatmate entry
  const hostFlatmate = form.hostOccupation || form.hostHobbies || form.hostGender || form.hostNativeTown
    ? [{
        name: '__host__',
        age: null,
        gender: form.hostGender,
        occupation: form.hostOccupation,
        hobbies: form.hostHobbies,
        native_town: form.hostNativeTown,
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
      state: form.state,
      pincode: form.pincode ? parseInt(form.pincode, 10) : null,
      gender_preference: form.guestGenderPref,
    },
    room: {
      room_type: form.roomType,
      bed_type: form.bedType,
      bathroom_type: form.bathroom,
      room_size_sqft: form.roomSize ? parseInt(form.roomSize, 10) : null,
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
        native_town: fm.nativeTown,
      })),
    ],
    amenities: form.amenities,
    title: form.title,
    description,
    host_price_per_night: parseFloat(form.nightlyRate),
    min_nights: _mapMinStay(form.minStay),
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
  };

  const res = await api.post<CreateListingResponse>(ENDPOINTS.HOST.CREATE_LISTING, body);
  return res.data;
}

export async function getListing(listingId: string): Promise<any> {
  const res = await api.get(ENDPOINTS.HOST.LISTING_DETAIL(listingId));
  return res.data;
}

export async function updateListing(listingId: string, form: ListingFormInput): Promise<CreateListingResponse> {
  const description = _buildDescription(form);

  const hostFlatmate = form.hostOccupation || form.hostHobbies || form.hostGender
    ? [{
        name: '__host__',
        age: null,
        gender: form.hostGender,
        occupation: form.hostOccupation,
        hobbies: form.hostHobbies,
        native_town: form.hostNativeTown,
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
      state: form.state,
      pincode: form.pincode ? parseInt(form.pincode, 10) : null,
      gender_preference: form.guestGenderPref,
    },
    room: {
      room_type: form.roomType,
      bed_type: form.bedType,
      bathroom_type: form.bathroom,
      room_size_sqft: form.roomSize ? parseInt(form.roomSize, 10) : null,
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
        native_town: fm.nativeTown,
      })),
    ],
    amenities: form.amenities,
    title: form.title,
    description,
    host_price_per_night: parseFloat(form.nightlyRate),
    min_nights: _mapMinStay(form.minStay),
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
  };

  const res = await api.patch<CreateListingResponse>(ENDPOINTS.HOST.LISTING_DETAIL(listingId), body);
  return res.data;
}

function _buildDescription(form: {
  description: string;
  nearbyLandmark: string;
  landmarkDistance: string;
  landmarkDetails: string;
}): string {
  const parts: string[] = [];
  if (form.description.trim()) parts.push(form.description.trim());

  if (form.nearbyLandmark) {
    const dist = form.landmarkDistance.trim();
    let nearby = `Nearby: ${form.nearbyLandmark}`;
    if (dist) nearby += ` (${dist})`;
    parts.push(nearby);
  }

  if (form.landmarkDetails.trim()) {
    parts.push(form.landmarkDetails.trim());
  }

  return parts.join('\n\n');
}

export interface BlockedPeriod {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export async function getBlockedPeriods(listingId: string): Promise<BlockedPeriod[]> {
  const res = await api.get<BlockedPeriod[]>(ENDPOINTS.HOST.BLOCKED_PERIODS(listingId));
  return res.data;
}

export async function createBlockedPeriod(
  listingId: string,
  startDate: string,
  endDate: string,
  reason: string = '',
): Promise<BlockedPeriod> {
  const res = await api.post<BlockedPeriod>(ENDPOINTS.HOST.BLOCKED_PERIODS(listingId), {
    start_date: startDate,
    end_date: endDate,
    reason,
  });
  return res.data;
}

export async function deleteBlockedPeriod(
  listingId: string,
  periodId: string,
): Promise<void> {
  await api.delete(ENDPOINTS.HOST.DELETE_BLOCKED_PERIOD(listingId, periodId));
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
