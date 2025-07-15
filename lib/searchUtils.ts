import { LEBANON_BOUNDS, FEATURES } from "@/constants/searchConstants";
import { supabase } from "@/config/supabase";
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

// Check restaurant availability with mock data fallback
export const checkRestaurantAvailability = async (
  restaurantId: string,
  date: Date,
  time: string,
  partySize: number,
): Promise<boolean> => {
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
      console.log("Database availability check failed, using mock data");
    }

    // If we have real availability data, use it
    if (data && data.length > 0) {
      return data[0].available_capacity >= partySize;
    }

    // Generate realistic mock availability based on restaurant ID, date, time, and party size
    const restaurantSeed = restaurantId.split("").reduce((acc, char, index) => {
      return acc + char.charCodeAt(0) * (index + 1);
    }, 0);

    const hour = parseInt(time.split(":")[0]);
    const minute = parseInt(time.split(":")[1] || "0");
    const timeValue = hour * 60 + minute;

    // Peak hours: lunch (12-14) and dinner (19-21) have lower availability
    const isPeakHour =
      (timeValue >= 12 * 60 && timeValue <= 14 * 60) ||
      (timeValue >= 19 * 60 && timeValue <= 21 * 60);

    // Weekend factor (Friday/Saturday are busier)
    const isWeekend = [5, 6].includes(date.getDay());

    // Base availability chance
    let availabilityChance = 0.8;

    // Reduce for peak hours
    if (isPeakHour) availabilityChance *= 0.4;

    // Reduce for weekends
    if (isWeekend) availabilityChance *= 0.6;

    // Reduce for larger parties
    if (partySize >= 6) availabilityChance *= 0.5;
    else if (partySize >= 4) availabilityChance *= 0.7;

    // Add some restaurant-specific variation
    const restaurantFactor = ((restaurantSeed % 100) / 100) * 0.3;
    availabilityChance = Math.max(
      0.1,
      Math.min(0.95, availabilityChance + restaurantFactor),
    );

    // Create deterministic result based on all inputs
    const seed =
      restaurantSeed + date.getTime() / 1000000 + timeValue + partySize;
    const random = (seed % 1000) / 1000;

    return random < availabilityChance;
  } catch (error) {
    console.error("Error checking availability:", error);
    // Return a simple fallback
    return Math.random() > 0.5;
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
      case "availability":
        return availableOnly
          ? 0
          : (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0);
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
