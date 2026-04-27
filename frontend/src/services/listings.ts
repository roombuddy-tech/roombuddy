import api from './api';
import { ENDPOINTS } from '../constants/endpoints';

export interface CreateListingResponse {
  listing_id: string;
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
  roomType: string;
  bedType: string;
  bathroom: string;
  roomSize: string;
  roomFeatures: string[];
  title: string;
  description: string;
  nearbyLandmarks: string[];
  distanceToLandmark: string;
  flatmates: Array<{ name: string; age: string; occupation: string; hobbies: string }>;
  guestGenderPref: string;
  amenities: string[];
  kitchenAccess: boolean;
  homeCooked: boolean;
  nightlyRate: string;
  weeklyDiscount: boolean;
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
}): Promise<CreateListingResponse> {
  const description = _buildDescription(form);

  const body = {
    property: {
      apartment_type: form.apartmentType.toLowerCase().replace('+', ''),
      floor_number: parseInt(form.floorNumber, 10),
      total_floors: form.totalFloors ? parseInt(form.totalFloors, 10) : null,
      apartment_name: form.apartmentName,
      address_line1: form.locality,
      city_name: form.city,
      gender_preference: form.guestGenderPref,
    },
    room: {
      room_type: form.roomType,
      bed_type: form.bedType,
      bathroom_type: form.bathroom,
      room_size_sqft: form.roomSize ? parseInt(form.roomSize, 10) : null,
      room_features: form.roomFeatures,
    },
    flatmates: form.flatmates.map((fm) => ({
      name: fm.name,
      age: fm.age ? parseInt(fm.age, 10) : null,
      occupation: fm.occupation,
      hobbies: fm.hobbies,
    })),
    amenities: form.amenities,
    title: form.title,
    description,
    host_price_per_night: parseFloat(form.nightlyRate),
    min_nights: _mapMinStay(form.minStay),
    food_kitchen_access: form.kitchenAccess,
    food_meals_available: form.homeCooked,
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

function _buildDescription(form: {
  description: string;
  nearbyLandmarks: string[];
  distanceToLandmark: string;
}): string {
  const parts: string[] = [];
  if (form.description.trim()) parts.push(form.description.trim());

  if (form.nearbyLandmarks.length > 0) {
    const dist = form.distanceToLandmark.trim();
    const landmarks = form.nearbyLandmarks.join(', ');
    parts.push(`Nearby: ${landmarks}${dist ? ` (${dist})` : ''}`);
  }

  return parts.join('\n\n');
}

function _mapMinStay(val: string): number {
  switch (val) {
    case '2_nights': return 2;
    case '3_nights': return 3;
    case '1_week': return 7;
    default: return 1;
  }
}
