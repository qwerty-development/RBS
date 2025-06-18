import { Database } from "@/types/supabase";

// Core restaurant type with search-specific extensions
export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  distance?: number;
  availableSlots?: string[];
  isAvailable?: boolean;
  staticCoordinates?: { lat: number; lng: number };
};

// View mode for search results
export type ViewMode = "list" | "map";

// User location interface
export interface UserLocation {
  latitude: number;
  longitude: number;
}

// Booking filters interface
export interface BookingFilters {
  date: Date;
  time: string;
  partySize: number;
  availableOnly: boolean;
}

// General filters interface
export interface GeneralFilters {
  sortBy: "recommended" | "rating" | "distance" | "name" | "availability";
  cuisines: string[];
  features: string[];
  priceRange: number[];
  bookingPolicy: "all" | "instant" | "request";
  minRating: number;
}

// Combined search state interface
export interface SearchState {
  restaurants: Restaurant[];
  favorites: Set<string>;
  loading: boolean;
  refreshing: boolean;
  userLocation: UserLocation | null;
  viewMode: ViewMode;
  searchQuery: string;
  bookingFilters: BookingFilters;
  generalFilters: GeneralFilters;
}

// Search hook return type
export interface UseSearchReturn {
  searchState: SearchState;
  actions: {
    setViewMode: (mode: ViewMode) => void;
    setSearchQuery: (query: string) => void;
    updateBookingFilters: (updates: Partial<BookingFilters>) => void;
    updateGeneralFilters: (filters: GeneralFilters) => void;
    toggleFavorite: (restaurantId: string) => Promise<void>;
    clearAllFilters: () => void;
    handleRefresh: () => void;
  };
  handlers: {
    handleRestaurantPress: (restaurantId: string) => void;
    openDirections: (restaurant: Restaurant) => Promise<void>;
    toggleAvailableOnly: () => void;
  };
  computed: {
    activeFilterCount: number;
    dateOptions: Date[];
  };
}
