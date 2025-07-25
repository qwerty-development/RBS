import { LEBANON_BOUNDS, FEATURES } from "@/constants/searchConstants";
import { supabase } from "@/config/supabase";
import { AvailabilityService } from "@/lib/AvailabilityService";
import type {
  Restaurant,
  UserLocation,
  GeneralFilters,
  BookingFilters,
} from "@/types/search";

// Generate static coordinates for restaurants with realistic Lebanon distribution
export const generateStaticCoordinates = (
  restaurantId: string,
): { lat: number; lng: number } => {
  // Create a stable hash from restaurant ID
  const hash = restaurantId.split("").reduce((acc, char, index) => {
    return ((acc << 5) - acc + char.charCodeAt(0) + index) & 0xffffffff;
  }, 0);

  // Use hash to determine city (weighted distribution)
  const citySelector = Math.abs(hash) % 100;
  let selectedCity = LEBANON_BOUNDS.cities[0]; // Default to Beirut
  let weightSum = 0;

  for (const city of LEBANON_BOUNDS.cities) {
    weightSum += city.weight * 100;
    if (citySelector < weightSum) {
      selectedCity = city;
      break;
    }
  }

  // Generate coordinates around selected city (±0.02 degrees ≈ ±2km)
  const latOffset = ((Math.abs(hash * 1.1) % 1000) / 1000 - 0.5) * 0.04;
  const lngOffset = ((Math.abs(hash * 1.3) % 1000) / 1000 - 0.5) * 0.04;

  const lat = Math.max(
    LEBANON_BOUNDS.south,
    Math.min(LEBANON_BOUNDS.north, selectedCity.lat + latOffset),
  );
  const lng = Math.max(
    LEBANON_BOUNDS.west,
    Math.min(LEBANON_BOUNDS.east, selectedCity.lng + lngOffset),
  );

  return { lat, lng };
};

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Normalize time format for database queries
export const normalizeTimeForDatabase = (time: string): string => {
  if (time.length === 5) {
    return `${time}:00`;
  }
  return time;
};

// Check restaurant availability using the optimized AvailabilityService
export const checkRestaurantAvailability = async (
  restaurantId: string,
  date: Date,
  time: string,
  partySize: number,
): Promise<boolean> => {
  try {
    // Get the AvailabilityService instance
    const availabilityService = AvailabilityService.getInstance();

    // Get available time slots for the restaurant
    const availableSlots = await availabilityService.getAvailableTimeSlots(
      restaurantId,
      date,
      partySize,
      undefined, // No user ID for guest searches
      false, // Don't preload next day for search results
    );

    // If no specific time is requested, just check if any slots are available
    if (!time || time === "any") {
      return availableSlots.length > 0;
    }

    // If a specific time is requested, check if that time slot is available
    const normalizedTime = normalizeTimeForDatabase(time);
    return availableSlots.some(
      (slot) => normalizeTimeForDatabase(slot.time) === normalizedTime,
    );
  } catch (error) {
    console.error("Error checking restaurant availability:", error);

    // Fallback to basic availability check if AvailabilityService fails
    try {
      const dateStr = date.toISOString().split("T")[0];
      const normalizedTime = normalizeTimeForDatabase(time);

      const { data, error } = await supabase
        .from("restaurant_availability")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("date", dateStr)
        .eq("time_slot", normalizedTime)
        .gte("available_capacity", partySize);

      if (error) {
        console.log(
          "Database availability check failed, using conservative fallback",
        );
        // Conservative fallback - assume most restaurants have some availability
        return true;
      }

      return data && data.length > 0 && data[0].available_capacity >= partySize;
    } catch (fallbackError) {
      console.error("Fallback availability check failed:", fallbackError);
      // Very conservative fallback
      return true;
    }
  }
};

// Sort restaurants based on the selected criteria
export const sortRestaurants = (
  restaurants: Restaurant[],
  sortBy: GeneralFilters["sortBy"],
  userLocation: UserLocation | null,
  favoriteCuisines: string[] | undefined,
  favorites: Set<string>,
  availableOnly: boolean,
): Restaurant[] => {
  return [...restaurants].sort((a, b) => {
    switch (sortBy) {
      case "rating":
        return (b.average_rating || 0) - (a.average_rating || 0);
      case "name":
        return a.name.localeCompare(b.name);
      case "distance":
        return (a.distance || Infinity) - (b.distance || Infinity);
      case "recommended":
      default:
        const scoreA =
          (a.average_rating || 0) * 0.4 +
          (a.total_reviews || 0) * 0.001 +
          (favoriteCuisines?.includes(a.cuisine_type) ? 0.3 : 0) +
          (favorites.has(a.id) ? 0.2 : 0) +
          (a.distance ? Math.max(0, 1 - a.distance / 10) * 0.1 : 0);
        const scoreB =
          (b.average_rating || 0) * 0.4 +
          (b.total_reviews || 0) * 0.001 +
          (favoriteCuisines?.includes(b.cuisine_type) ? 0.3 : 0) +
          (favorites.has(b.id) ? 0.2 : 0) +
          (b.distance ? Math.max(0, 1 - b.distance / 10) * 0.1 : 0);
        return scoreB - scoreA;
    }
  });
};

// Apply feature filters to restaurants
export const applyFeatureFilters = (
  restaurants: Restaurant[],
  features: string[],
): Restaurant[] => {
  if (features.length === 0) return restaurants;

  return restaurants.filter((restaurant) =>
    features.every((feature) => {
      const featureField = FEATURES.find((f) => f.id === feature)?.field;
      return featureField && restaurant[featureField as keyof Restaurant];
    }),
  );
};

// Calculate active filter count
export const calculateActiveFilterCount = (
  generalFilters: GeneralFilters,
  bookingFilters: BookingFilters,
): number => {
  let count = 0;
  if (generalFilters.sortBy !== "recommended") count++;
  count += generalFilters.cuisines.length;
  count += generalFilters.features.length;
  if (generalFilters.priceRange.length < 4) count++;
  if (generalFilters.bookingPolicy !== "all") count++;
  if (generalFilters.minRating > 0) count++;
  if (bookingFilters.availableOnly) count++;
  return count;
};

// Generate date options for next N days
export const generateDateOptions = (days: number = 14): Date[] => {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
};
