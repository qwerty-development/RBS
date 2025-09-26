// types/search.ts - Updated with location types and search functionality
import { Region } from "react-native-maps";
import type { SearchSuggestion } from "@/lib/advancedSearchUtils";
import type { Restaurant } from "@/types/restaurant";

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
  sortBy: "recommended" | "rating" | "distance" | "name";
  cuisines: string[];
  features: string[];
  priceRange: number[];
  bookingPolicy: "all" | "instant" | "request";
  minRating: number;
  maxDistance: number;
}

// Re-export Restaurant from restaurant.ts to avoid duplication
export type { Restaurant } from "@/types/restaurant";

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
  searchSuggestions: SearchSuggestion[];
}

export interface SearchActions {
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  updateBookingFilters: (updates: Partial<BookingFilters>) => void;
  updateGeneralFilters: (filters: GeneralFilters) => void;
  toggleFavorite: (restaurantId: string) => Promise<void>;
  clearAllFilters: () => void;
  handleRefresh: () => void;
  generateSearchSuggestions: (query: string) => void;
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
