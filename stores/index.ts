import { create } from "zustand";
import {
  devtools,
  persist,
  createJSONStorage,
  subscribeWithSelector,
} from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";

import type { Restaurant } from "@/types/restaurant";

// Profile type definition (matching what we use in the app)
type Profile = {
  id: string;
  full_name: string;
  phone_number?: string;
  avatar_url?: string;
  allergies?: string[];
  favorite_cuisines?: string[];
  dietary_restrictions?: string[];
  preferred_party_size?: number;
  notification_preferences?: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  loyalty_points?: number;
  membership_tier?: "bronze" | "silver" | "gold" | "platinum";
  created_at?: string;
  updated_at?: string;
};

/**
 * Auth Store - Handles authentication state
 */
interface AuthState {
  // State
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setIsGuest: (isGuest: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          session: null,
          user: null,
          profile: null,
          isGuest: false,
          initialized: false,
          loading: false,
          error: null,

          // Actions
          setSession: (session) =>
            set((state) => {
              state.session = session;
              if (session) {
                state.user = session.user;
                state.isGuest = false;
              }
            }),

          setUser: (user) =>
            set((state) => {
              state.user = user;
            }),

          setProfile: (profile) =>
            set((state) => {
              state.profile = profile;
            }),

          setIsGuest: (isGuest) =>
            set((state) => {
              state.isGuest = isGuest;
              if (isGuest) {
                state.session = null;
                state.user = null;
                state.profile = null;
              }
            }),

          setInitialized: (initialized) =>
            set((state) => {
              state.initialized = initialized;
            }),

          setLoading: (loading) =>
            set((state) => {
              state.loading = loading;
            }),

          setError: (error) =>
            set((state) => {
              state.error = error;
            }),

          reset: () =>
            set((state) => {
              state.session = null;
              state.user = null;
              state.profile = null;
              state.isGuest = false;
              state.error = null;
            }),
        })),
        {
          name: "auth-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            isGuest: state.isGuest,
            initialized: state.initialized,
          }),
        },
      ),
    ),
    { name: "AuthStore" },
  ),
);

/**
 * App Store - Handles global app state
 */
interface AppState {
  // Network state
  isOnline: boolean;
  networkStrength: "weak" | "strong" | "unknown";

  // UI state
  theme: "light" | "dark" | "system";
  isLoading: boolean;
  globalError: string | null;

  // Location state
  currentLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  locationPermission: "granted" | "denied" | "pending";

  // Search state
  recentSearches: string[];
  searchFilters: Record<string, any>;

  // Notifications
  notifications: {
    id: string;
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
  }[];

  // Actions
  setNetworkStatus: (
    isOnline: boolean,
    strength?: "weak" | "strong" | "unknown",
  ) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLoading: (loading: boolean) => void;
  setGlobalError: (error: string | null) => void;
  setLocation: (location: AppState["currentLocation"]) => void;
  setLocationPermission: (permission: AppState["locationPermission"]) => void;
  addRecentSearch: (search: string) => void;
  clearRecentSearches: () => void;
  setSearchFilters: (filters: Record<string, any>) => void;
  addNotification: (
    notification: Omit<
      AppState["notifications"][0],
      "id" | "timestamp" | "read"
    >,
  ) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          isOnline: true,
          networkStrength: "unknown",
          theme: "system",
          isLoading: false,
          globalError: null,
          currentLocation: null,
          locationPermission: "pending",
          recentSearches: [],
          searchFilters: {},
          notifications: [],

          // Actions
          setNetworkStatus: (isOnline, strength = "unknown") =>
            set((state) => {
              state.isOnline = isOnline;
              state.networkStrength = strength;
            }),

          setTheme: (theme) =>
            set((state) => {
              state.theme = theme;
            }),

          setLoading: (loading) =>
            set((state) => {
              state.isLoading = loading;
            }),

          setGlobalError: (error) =>
            set((state) => {
              state.globalError = error;
            }),

          setLocation: (location) =>
            set((state) => {
              state.currentLocation = location;
            }),

          setLocationPermission: (permission) =>
            set((state) => {
              state.locationPermission = permission;
            }),

          addRecentSearch: (search) =>
            set((state) => {
              // Remove if exists and add to front
              state.recentSearches = [
                search,
                ...state.recentSearches.filter((s) => s !== search),
              ].slice(0, 10); // Keep only 10 recent searches
            }),

          clearRecentSearches: () =>
            set((state) => {
              state.recentSearches = [];
            }),

          setSearchFilters: (filters) =>
            set((state) => {
              state.searchFilters = filters;
            }),

          addNotification: (notification) =>
            set((state) => {
              state.notifications.unshift({
                ...notification,
                id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: Date.now(),
                read: false,
              });
            }),

          markNotificationRead: (id) =>
            set((state) => {
              const notification = state.notifications.find((n) => n.id === id);
              if (notification) {
                notification.read = true;
              }
            }),

          clearNotifications: () =>
            set((state) => {
              state.notifications = [];
            }),
        })),
        {
          name: "app-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            theme: state.theme,
            recentSearches: state.recentSearches,
            searchFilters: state.searchFilters,
            locationPermission: state.locationPermission,
          }),
        },
      ),
    ),
    { name: "AppStore" },
  ),
);

/**
 * Restaurant Store - Handles restaurant data and favorites
 */
interface RestaurantState {
  // Favorites
  favorites: Set<string>;
  favoritesList: Restaurant[];

  // Recently viewed
  recentlyViewed: Restaurant[];

  // Cache
  restaurantsCache: Map<string, Restaurant>;
  searchResultsCache: Map<string, Restaurant[]>;

  // Loading states
  favoritesLoading: boolean;
  restaurantLoading: Map<string, boolean>;

  // Actions
  addToFavorites: (restaurantId: string) => void;
  removeFromFavorites: (restaurantId: string) => void;
  toggleFavorite: (restaurantId: string) => void;
  isFavorite: (restaurantId: string) => boolean;
  setFavoritesList: (restaurants: Restaurant[]) => void;
  addToRecentlyViewed: (restaurant: Restaurant) => void;
  cacheRestaurant: (restaurant: Restaurant) => void;
  getCachedRestaurant: (id: string) => Restaurant | undefined;
  cacheSearchResults: (query: string, results: Restaurant[]) => void;
  getCachedSearchResults: (query: string) => Restaurant[] | undefined;
  setFavoritesLoading: (loading: boolean) => void;
  setRestaurantLoading: (id: string, loading: boolean) => void;
  clearCache: () => void;
}

export const useRestaurantStore = create<RestaurantState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          favorites: new Set<string>(),
          favoritesList: [],
          recentlyViewed: [],
          restaurantsCache: new Map<string, Restaurant>(),
          searchResultsCache: new Map<string, Restaurant[]>(),
          favoritesLoading: false,
          restaurantLoading: new Map<string, boolean>(),

          // Actions
          addToFavorites: (restaurantId) =>
            set((state) => {
              state.favorites.add(restaurantId);
            }),

          removeFromFavorites: (restaurantId) =>
            set((state) => {
              state.favorites.delete(restaurantId);
              state.favoritesList = state.favoritesList.filter(
                (r) => r.id !== restaurantId,
              );
            }),

          toggleFavorite: (restaurantId) =>
            set((state) => {
              if (state.favorites.has(restaurantId)) {
                state.favorites.delete(restaurantId);
                state.favoritesList = state.favoritesList.filter(
                  (r) => r.id !== restaurantId,
                );
              } else {
                state.favorites.add(restaurantId);
              }
            }),

          isFavorite: (restaurantId) => {
            return get().favorites.has(restaurantId);
          },

          setFavoritesList: (restaurants) =>
            set((state) => {
              state.favoritesList = restaurants;
            }),

          addToRecentlyViewed: (restaurant) =>
            set((state) => {
              // Remove if exists and add to front
              state.recentlyViewed = [
                restaurant,
                ...state.recentlyViewed.filter((r) => r.id !== restaurant.id),
              ].slice(0, 20); // Keep only 20 recent items
            }),

          cacheRestaurant: (restaurant) =>
            set((state) => {
              state.restaurantsCache.set(restaurant.id, restaurant);
            }),

          getCachedRestaurant: (id) => {
            return get().restaurantsCache.get(id);
          },

          cacheSearchResults: (query, results) =>
            set((state) => {
              state.searchResultsCache.set(query, results);
            }),

          getCachedSearchResults: (query) => {
            return get().searchResultsCache.get(query);
          },

          setFavoritesLoading: (loading) =>
            set((state) => {
              state.favoritesLoading = loading;
            }),

          setRestaurantLoading: (id, loading) =>
            set((state) => {
              if (loading) {
                state.restaurantLoading.set(id, true);
              } else {
                state.restaurantLoading.delete(id);
              }
            }),

          clearCache: () =>
            set((state) => {
              state.restaurantsCache.clear();
              state.searchResultsCache.clear();
            }),
        })),
        {
          name: "restaurant-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            favorites: Array.from(state.favorites),
            recentlyViewed: state.recentlyViewed,
          }),
          onRehydrateStorage: () => (state) => {
            if (state && Array.isArray(state.favorites)) {
              // Convert array back to Set
              (state as any).favorites = new Set(state.favorites);
            }
          },
        },
      ),
    ),
    { name: "RestaurantStore" },
  ),
);

/**
 * Booking Store - Handles booking state
 */
interface BookingState {
  // Current booking flow
  currentBooking: {
    restaurantId?: string;
    date?: string;
    time?: string;
    partySize?: number;
    specialRequests?: string;
    guestInfo?: {
      name: string;
      email: string;
      phone: string;
    };
  };

  // Bookings lists
  upcomingBookings: any[];
  pastBookings: any[];

  // Booking history
  recentBookings: any[];

  // Loading states
  isCreating: boolean;
  availabilityLoading: boolean;
  bookingsLoading: boolean;

  // Actions
  setBookingData: (data: Partial<BookingState["currentBooking"]>) => void;
  clearCurrentBooking: () => void;
  addRecentBooking: (booking: any) => void;
  setCreating: (creating: boolean) => void;
  setAvailabilityLoading: (loading: boolean) => void;
  setBookingsLoading: (loading: boolean) => void;
  setUpcomingBookings: (bookings: any[]) => void;
  setPastBookings: (bookings: any[]) => void;
  addNewBooking: (booking: any) => void;
  updateBooking: (bookingId: string, updates: any) => void;
  removeBooking: (bookingId: string) => void;
}

export const useBookingStore = create<BookingState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // Initial state
          currentBooking: {},
          upcomingBookings: [],
          pastBookings: [],
          recentBookings: [],
          isCreating: false,
          availabilityLoading: false,
          bookingsLoading: false,

          // Actions
          setBookingData: (data) =>
            set((state) => {
              state.currentBooking = { ...state.currentBooking, ...data };
            }),

          clearCurrentBooking: () =>
            set((state) => {
              state.currentBooking = {};
            }),

          addRecentBooking: (booking) =>
            set((state) => {
              state.recentBookings.unshift(booking);
              state.recentBookings = state.recentBookings.slice(0, 50); // Keep only 50 recent
            }),

          setCreating: (creating) =>
            set((state) => {
              state.isCreating = creating;
            }),

          setAvailabilityLoading: (loading) =>
            set((state) => {
              state.availabilityLoading = loading;
            }),

          setBookingsLoading: (loading) =>
            set((state) => {
              state.bookingsLoading = loading;
            }),

          setUpcomingBookings: (bookings) =>
            set((state) => {
              state.upcomingBookings = bookings;
            }),

          setPastBookings: (bookings) =>
            set((state) => {
              state.pastBookings = bookings;
            }),

          addNewBooking: (booking) =>
            set((state) => {
              // Add to recent bookings
              state.recentBookings.unshift(booking);
              state.recentBookings = state.recentBookings.slice(0, 50);

              // Add to appropriate list based on status and date
              const bookingDate = new Date(booking.booking_time);
              const now = new Date();

              if (
                (booking.status === "pending" ||
                  booking.status === "confirmed") &&
                bookingDate >= now
              ) {
                // Add to upcoming bookings in chronological order
                state.upcomingBookings.push(booking);
                state.upcomingBookings.sort(
                  (a, b) =>
                    new Date(a.booking_time).getTime() -
                    new Date(b.booking_time).getTime(),
                );
              } else {
                // Add to past bookings in reverse chronological order
                state.pastBookings.unshift(booking);
                state.pastBookings = state.pastBookings.slice(0, 50); // Keep only 50 recent
              }
            }),

          updateBooking: (bookingId, updates) =>
            set((state) => {
              // Update in upcoming bookings
              const upcomingIndex = state.upcomingBookings.findIndex(
                (b) => b.id === bookingId,
              );
              if (upcomingIndex !== -1) {
                const updatedBooking = {
                  ...state.upcomingBookings[upcomingIndex],
                  ...updates,
                };

                // Check if booking should be moved to past bookings
                const bookingDate = new Date(updatedBooking.booking_time);
                const now = new Date();
                const shouldMoveToPast =
                  updatedBooking.status === "completed" ||
                  updatedBooking.status === "cancelled_by_user" ||
                  updatedBooking.status === "declined_by_restaurant" ||
                  updatedBooking.status === "no_show" ||
                  bookingDate < now;

                if (shouldMoveToPast) {
                  state.upcomingBookings.splice(upcomingIndex, 1);
                  state.pastBookings.unshift(updatedBooking);
                  state.pastBookings = state.pastBookings.slice(0, 50);
                } else {
                  state.upcomingBookings[upcomingIndex] = updatedBooking;
                  // Re-sort upcoming bookings
                  state.upcomingBookings.sort(
                    (a, b) =>
                      new Date(a.booking_time).getTime() -
                      new Date(b.booking_time).getTime(),
                  );
                }
              } else {
                // Update in past bookings
                const pastIndex = state.pastBookings.findIndex(
                  (b) => b.id === bookingId,
                );
                if (pastIndex !== -1) {
                  state.pastBookings[pastIndex] = {
                    ...state.pastBookings[pastIndex],
                    ...updates,
                  };
                }
              }

              // Update in recent bookings
              const recentIndex = state.recentBookings.findIndex(
                (b) => b.id === bookingId,
              );
              if (recentIndex !== -1) {
                state.recentBookings[recentIndex] = {
                  ...state.recentBookings[recentIndex],
                  ...updates,
                };
              }
            }),

          removeBooking: (bookingId) =>
            set((state) => {
              state.upcomingBookings = state.upcomingBookings.filter(
                (b) => b.id !== bookingId,
              );
              state.pastBookings = state.pastBookings.filter(
                (b) => b.id !== bookingId,
              );
              state.recentBookings = state.recentBookings.filter(
                (b) => b.id !== bookingId,
              );
            }),
        })),
        {
          name: "booking-store",
          storage: createJSONStorage(() => AsyncStorage),
          partialize: (state) => ({
            recentBookings: state.recentBookings,
          }),
        },
      ),
    ),
    { name: "BookingStore" },
  ),
);

/**
 * Waiting List Store - Handles waiting list state
 */
interface WaitingListState {
  entries: any[];
  loading: boolean;

  // Actions
  setEntries: (entries: any[]) => void;
  addEntry: (entry: any) => void;
  updateWaitingListEntry: (id: string, updates: any) => void;
  removeEntry: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useWaitingListStore = create<WaitingListState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        entries: [],
        loading: false,

        // Actions
        setEntries: (entries) =>
          set((state) => {
            state.entries = entries;
          }),

        addEntry: (entry) =>
          set((state) => {
            state.entries.unshift(entry);
          }),

        updateWaitingListEntry: (id, updates) =>
          set((state) => {
            const index = state.entries.findIndex((entry) => entry.id === id);
            if (index !== -1) {
              state.entries[index] = { ...state.entries[index], ...updates };
            }
          }),

        removeEntry: (id) =>
          set((state) => {
            state.entries = state.entries.filter((entry) => entry.id !== id);
          }),

        setLoading: (loading) =>
          set((state) => {
            state.loading = loading;
          }),
      })),
    ),
    { name: "WaitingListStore" },
  ),
);

/**
 * Store selectors for performance optimization
 */
export const useAuth = () =>
  useAuthStore((state) => ({
    session: state.session,
    user: state.user,
    profile: state.profile,
    isGuest: state.isGuest,
    initialized: state.initialized,
    loading: state.loading,
    error: state.error,
  }));

export const useAuthActions = () =>
  useAuthStore((state) => ({
    setSession: state.setSession,
    setUser: state.setUser,
    setProfile: state.setProfile,
    setIsGuest: state.setIsGuest,
    setInitialized: state.setInitialized,
    setLoading: state.setLoading,
    setError: state.setError,
    reset: state.reset,
  }));

export const useNetworkStatus = () =>
  useAppStore((state) => ({
    isOnline: state.isOnline,
    networkStrength: state.networkStrength,
  }));

export const useLocation = () =>
  useAppStore((state) => ({
    currentLocation: state.currentLocation,
    locationPermission: state.locationPermission,
  }));

export const useFavorites = () =>
  useRestaurantStore((state) => ({
    favorites: state.favorites,
    favoritesList: state.favoritesList,
    favoritesLoading: state.favoritesLoading,
    isFavorite: state.isFavorite,
    toggleFavorite: state.toggleFavorite,
  }));

export const useCurrentBooking = () =>
  useBookingStore((state) => ({
    currentBooking: state.currentBooking,
    isCreating: state.isCreating,
    setBookingData: state.setBookingData,
    clearCurrentBooking: state.clearCurrentBooking,
  }));

export const useBookingsStore = () =>
  useBookingStore((state) => ({
    upcomingBookings: state.upcomingBookings,
    pastBookings: state.pastBookings,
    bookingsLoading: state.bookingsLoading,
    setUpcomingBookings: state.setUpcomingBookings,
    setPastBookings: state.setPastBookings,
    setBookingsLoading: state.setBookingsLoading,
    addNewBooking: state.addNewBooking,
    updateBooking: state.updateBooking,
    removeBooking: state.removeBooking,
  }));

/**
 * Store subscription hooks for reactive updates
 */
export const useAuthSubscription = (callback: (state: AuthState) => void) => {
  useAuthStore.subscribe(callback);
};

export const useThemeSubscription = (callback: (theme: string) => void) => {
  useAppStore.subscribe((state) => state.theme, callback);
};

/**
 * Store reset for testing and development
 */
export const resetAllStores = () => {
  useAuthStore.persist.clearStorage();
  useAppStore.persist.clearStorage();
  useRestaurantStore.persist.clearStorage();
  useBookingStore.persist.clearStorage();
};

/**
 * Development helpers
 */
if (__DEV__) {
  // Enable devtools
  (window as any).__ZUSTAND_AUTH_STORE__ = useAuthStore;
  (window as any).__ZUSTAND_APP_STORE__ = useAppStore;
  (window as any).__ZUSTAND_RESTAURANT_STORE__ = useRestaurantStore;
  (window as any).__ZUSTAND_BOOKING_STORE__ = useBookingStore;
}
