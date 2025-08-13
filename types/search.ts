// types/search.ts - Updated with location types
import { Region } from "react-native-maps";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationData extends LocationCoordinates {
  city: string;
  district: string;
  country: string;
}

export interface UserLocation extends LocationCoordinates {}

export type ViewMode = "list" | "map";

export interface BookingFilters {
  date: Date | null;
  time: string | null;
  partySize: number | null;
  availableOnly: boolean;
}

export interface GeneralFilters {
  sortBy:  "rating" | "distance" | "name";
  cuisines: string[];
  features: string[];
  priceRange: number[];
  bookingPolicy: "all" | "instant" | "request";
  minRating: number;
  maxDistance: number;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisine_type: string;
  main_image_url: string;
  address: string;
  location: any; // PostGIS geography type
  opening_time?: string; // Legacy field - use restaurant_hours instead
  closing_time?: string; // Legacy field - use restaurant_hours instead
  booking_policy: "instant" | "request";
  price_range: number;
  average_rating?: number | null;
  total_reviews?: number | null;
  tags?: string[] | null;
  distance?: number | null;
  coordinates?: LocationCoordinates | null;
  staticCoordinates?: { lat: number; lng: number };
  isAvailable?: boolean;
  featured?: boolean;
  restaurant_hours?: {
    day_of_week: string;
    is_open: boolean;
    open_time: string | null;
    close_time: string | null;
  }[];
}

export interface SearchState {
  restaurants: Restaurant[];
  favorites: Set<string>;
  loading: boolean;
  refreshing: boolean;
  userLocation: LocationData | null;
  viewMode: ViewMode;
  searchQuery: string;
  bookingFilters: BookingFilters;
  generalFilters: GeneralFilters;
}

export interface SearchActions {
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  updateBookingFilters: (updates: Partial<BookingFilters>) => void;
  updateGeneralFilters: (filters: GeneralFilters) => void;
  toggleFavorite: (restaurantId: string) => Promise<void>;
  clearAllFilters: () => void;
  handleRefresh: () => void;
}

export interface SearchHandlers {
  handleRestaurantPress: (restaurantId: string) => void;
  openDirections: (restaurant: Restaurant) => Promise<void>;
  toggleAvailableOnly: () => void;
}

export interface SearchComputed {
  activeFilterCount: number;
  dateOptions: Date[];
}

export interface LocationUtilities {
  formatDistance: (distance: number | null) => string;
  calculateDistance: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => number;
  displayName: string;
}

export interface UseSearchReturn {
  searchState: SearchState;
  actions: SearchActions;
  handlers: SearchHandlers;
  computed: SearchComputed;
  location: LocationUtilities;
}
