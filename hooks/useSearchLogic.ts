// hooks/useSearchLogic.ts - Updated to use new location system
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Alert, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Region } from "react-native-maps";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import { LocationService } from "@/lib/locationService";
import { useRestaurantStore } from "@/stores/index";
import {
  DEFAULT_BOOKING_FILTERS,
  DEFAULT_GENERAL_FILTERS,
  DEFAULT_MAP_REGION,
} from "@/constants/searchConstants";
import {
  checkRestaurantAvailability,
  sortRestaurants,
  applyFeatureFilters,
  calculateActiveFilterCount,
  generateDateOptions,
} from "@/lib/searchUtils";
import {
  advancedSearchEngine,
  type SearchSuggestion,
} from "@/lib/advancedSearchUtils";
import type {
  Restaurant,
  ViewMode,
  BookingFilters,
  GeneralFilters,
  UseSearchReturn,
  LocationData,
} from "@/types/search";

export const useSearchLogic = (): UseSearchReturn => {
  const router = useRouter();
  const { profile } = useAuth();

  // Zustand store for favorites
  const {
    isFavorite: checkIsFavorite,
    addToFavorites,
    removeFromFavorites,
    favorites: favoritesSet,
  } = useRestaurantStore();

  // Use your new location hook instead of the old one
  const {
    location: userLocation,
    loading: locationLoading,
    calculateDistance,
    formatDistance,
    getDisplayName,
  } = useLocationWithDistance();

  // Core state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<
    SearchSuggestion[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_MAP_REGION);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]); // Cache all restaurants for search

  // Filter state
  const [bookingFilters, setBookingFilters] = useState<BookingFilters>(
    DEFAULT_BOOKING_FILTERS,
  );
  const [generalFilters, setGeneralFilters] = useState<GeneralFilters>(
    DEFAULT_GENERAL_FILTERS,
  );

  // Refs for optimization
  const fetchTimeoutRef = useRef<any>(null);
  const isInitialLoad = useRef(true);

  // Update map region when user location changes
  useEffect(() => {
    if (userLocation && isInitialLoad.current) {
      setMapRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [userLocation]);

  // Sync favorites from database to Zustand store
  const fetchFavorites = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("favorites")
        .select("restaurant_id")
        .eq("user_id", profile.id);

      if (error) throw error;

      // Sync to Zustand store
      const favoriteIds = data?.map((f) => f.restaurant_id) || [];
      favoriteIds.forEach((id) => {
        if (!checkIsFavorite(id)) {
          addToFavorites(id);
        }
      });
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  }, [profile?.id, checkIsFavorite, addToFavorites]);

  // Toggle favorite status
  const toggleFavorite = useCallback(
    async (restaurantId: string) => {
      if (!profile?.id) {
        console.error("Search: Missing profile ID");
        return;
      }

      try {
        // Check current favorite status
        const currentIsFavorite = checkIsFavorite(restaurantId);

        if (currentIsFavorite) {
          // Remove from favorites
          const { error, data } = await supabase
            .from("favorites")
            .delete()
            .eq("user_id", profile.id)
            .eq("restaurant_id", restaurantId)
            .select();

          if (error) {
            console.error("Search: Supabase delete error:", error);
            throw error;
          }

          // Update Zustand store
          removeFromFavorites(restaurantId);
        } else {
          // Add to favorites
          const { error, data } = await supabase
            .from("favorites")
            .insert({
              user_id: profile.id,
              restaurant_id: restaurantId,
            })
            .select();

          if (error) {
            console.error("Search: Supabase insert error:", error);
            throw error;
          }

          // Update Zustand store
          addToFavorites(restaurantId);
        }
      } catch (error: any) {
        console.error("Search: Error toggling favorite:", {
          error,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
        });
        Alert.alert(
          "Error",
          `Failed to update favorite status: ${error?.message || "Unknown error"}`,
        );
      }
    },
    [profile?.id, checkIsFavorite, addToFavorites, removeFromFavorites],
  );

  // Main restaurant fetching logic - Updated to use LocationService
  const fetchRestaurants = useCallback(
    async (
      query: string,
      gFilters: GeneralFilters,
      bFilters: BookingFilters,
      favoriteCuisines: string[] | undefined,
      favoriteSet: Set<string>,
    ) => {
      setLoading(true);

      try {
        if (userLocation) {
          // Use your new LocationService method
          const restaurantsWithDistance =
            await LocationService.getRestaurantsWithDistance(
              userLocation,
              gFilters.maxDistance,
            );

          let processedRestaurants = restaurantsWithDistance.map(
            (restaurant) => ({
              ...restaurant,
              staticCoordinates: restaurant.coordinates
                ? {
                    lat: restaurant.coordinates.latitude,
                    lng: restaurant.coordinates.longitude,
                  }
                : undefined,
            }),
          );

          // Use advanced fuzzy search instead of basic filtering
          if (query.trim()) {
            const searchResult = advancedSearchEngine.search(
              query,
              processedRestaurants,
              userLocation,
              processedRestaurants.length, // Don't limit here, we'll apply other filters first
            );
            processedRestaurants = searchResult.restaurants;
            setSearchSuggestions(searchResult.suggestions);
          } else {
            setSearchSuggestions([]);
          }

          // Apply cuisine filters
          if (gFilters.cuisines.length > 0) {
            processedRestaurants = processedRestaurants.filter((restaurant) =>
              gFilters.cuisines.includes(restaurant.cuisine_type),
            );
          }

          // Apply price range filter
          if (gFilters.priceRange.length < 4) {
            processedRestaurants = processedRestaurants.filter((restaurant) =>
              gFilters.priceRange.includes(restaurant.price_range),
            );
          }

          // Apply booking policy filter
          if (gFilters.bookingPolicy !== "all") {
            processedRestaurants = processedRestaurants.filter(
              (restaurant) =>
                restaurant.booking_policy === gFilters.bookingPolicy,
            );
          }

          // Apply minimum rating filter
          if (gFilters.minRating > 0) {
            processedRestaurants = processedRestaurants.filter(
              (restaurant) =>
                (restaurant.average_rating || 0) >= gFilters.minRating,
            );
          }

          // Apply feature filters (client-side)
          processedRestaurants = applyFeatureFilters(
            processedRestaurants,
            gFilters.features,
          );

          // Check availability for all restaurants only if specific criteria are set
          const needsAvailabilityCheck =
            bFilters.availableOnly ||
            bFilters.partySize !== null ||
            bFilters.date !== null ||
            bFilters.time !== null;

          if (needsAvailabilityCheck) {
            const availabilityChecks = await Promise.all(
              processedRestaurants.map(async (restaurant) => {
                const isAvailable = await checkRestaurantAvailability(
                  restaurant.id,
                  bFilters.date || new Date(), // Use current date if null
                  bFilters.time || "19:00", // Use default time if null
                  bFilters.partySize || 2, // Use default party size if null
                );
                return { ...restaurant, isAvailable };
              }),
            );

            processedRestaurants = availabilityChecks;

            // Filter by availability if enabled OR if specific booking criteria are set
            const shouldFilterByAvailability =
              bFilters.availableOnly ||
              bFilters.partySize !== null ||
              bFilters.date !== null ||
              bFilters.time !== null;

            if (shouldFilterByAvailability) {
              processedRestaurants = processedRestaurants.filter(
                (r) => r.isAvailable,
              );
            }
          } else {
            // If no specific criteria, mark all as available (no filtering)
            processedRestaurants = processedRestaurants.map((restaurant) => ({
              ...restaurant,
              isAvailable: true,
            }));
          }

          // Sort restaurants using the existing sort function
          // The LocationService already provides distance, so this will work well
          processedRestaurants = sortRestaurants(
            processedRestaurants,
            gFilters.sortBy,
            userLocation,
            favoriteCuisines,
            favoriteSet,
            bFilters.availableOnly,
          );

          setRestaurants(processedRestaurants);

          // Cache all fetched restaurants for advanced search
          if (!query.trim()) {
            setAllRestaurants(processedRestaurants);
          }
        } else {
          // If no location, still fetch restaurants but without distance

          let supabaseQuery = supabase
            .from("restaurants")
            .select("*")
            .eq("status", "active");

          // We'll apply search after fetching all data for better fuzzy matching
          // Database-level search is removed in favor of client-side advanced search

          // Apply cuisine filters
          if (gFilters.cuisines.length > 0) {
            supabaseQuery = supabaseQuery.in("cuisine_type", gFilters.cuisines);
          }

          // Apply price range filter
          if (gFilters.priceRange.length < 4) {
            supabaseQuery = supabaseQuery.in(
              "price_range",
              gFilters.priceRange,
            );
          }

          // Apply booking policy filter
          if (gFilters.bookingPolicy !== "all") {
            supabaseQuery = supabaseQuery.eq(
              "booking_policy",
              gFilters.bookingPolicy,
            );
          }

          // Apply minimum rating filter
          if (gFilters.minRating > 0) {
            supabaseQuery = supabaseQuery.gte(
              "average_rating",
              gFilters.minRating,
            );
          }

          const { data, error } = await supabaseQuery;

          if (error) throw error;

          let processedRestaurants = (data || []).map((restaurant) => {
            const coords = LocationService.extractCoordinates(
              restaurant.location,
            );
            return {
              ...restaurant,
              distance: null,
              coordinates: coords,
              staticCoordinates: coords
                ? {
                    lat: coords.latitude,
                    lng: coords.longitude,
                  }
                : undefined,
            };
          });

          // Apply feature filters
          processedRestaurants = applyFeatureFilters(
            processedRestaurants,
            gFilters.features,
          );

          // Use advanced fuzzy search for no-location scenario
          if (query.trim()) {
            const searchResult = advancedSearchEngine.search(
              query,
              processedRestaurants,
              null, // No user location
              processedRestaurants.length,
            );
            processedRestaurants = searchResult.restaurants;
            setSearchSuggestions(searchResult.suggestions);
          } else {
            setSearchSuggestions([]);
          }

          // Check availability only if specific criteria are set
          const needsAvailabilityCheck =
            bFilters.availableOnly ||
            bFilters.partySize !== null ||
            bFilters.date !== null ||
            bFilters.time !== null;

          if (needsAvailabilityCheck) {
            const availabilityChecks = await Promise.all(
              processedRestaurants.map(async (restaurant) => {
                const isAvailable = await checkRestaurantAvailability(
                  restaurant.id,
                  bFilters.date || new Date(), // Use current date if null
                  bFilters.time || "19:00", // Use default time if null
                  bFilters.partySize || 2, // Use default party size if null
                );
                return { ...restaurant, isAvailable };
              }),
            );

            processedRestaurants = availabilityChecks;

            // Filter by availability if enabled OR if specific booking criteria are set
            const shouldFilterByAvailability =
              bFilters.availableOnly ||
              bFilters.partySize !== null ||
              bFilters.date !== null ||
              bFilters.time !== null;

            if (shouldFilterByAvailability) {
              processedRestaurants = processedRestaurants.filter(
                (r) => r.isAvailable,
              );
            }
          } else {
            // If no specific criteria, mark all as available (no filtering)
            processedRestaurants = processedRestaurants.map((restaurant) => ({
              ...restaurant,
              isAvailable: true,
            }));
          }

          // Sort restaurants
          processedRestaurants = sortRestaurants(
            processedRestaurants,
            gFilters.sortBy,
            null, // No user location
            favoriteCuisines,
            favoriteSet,
            bFilters.availableOnly,
          );

          setRestaurants(processedRestaurants);

          // Cache all fetched restaurants for advanced search
          if (!query.trim()) {
            setAllRestaurants(processedRestaurants);
          }
        }
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        Alert.alert("Error", "Failed to load restaurants");
      } finally {
        setLoading(false);
        setRefreshing(false);
        isInitialLoad.current = false;
      }
    },
    [userLocation],
  );

  // Navigation handlers
  const handleRestaurantPress = useCallback(
    (restaurantId: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: {
          id: restaurantId,
          date: bookingFilters.date
            ? bookingFilters.date.toISOString()
            : new Date().toISOString(),
          time: bookingFilters.time || "19:00",
          partySize: (bookingFilters.partySize || 2).toString(),
        },
      });
    },
    [router, bookingFilters],
  );

  const openDirections = useCallback(async (restaurant: Restaurant) => {
    const coords = restaurant.staticCoordinates || {
      lat: 33.8938,
      lng: 35.5018,
    };

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${coords.lat},${coords.lng}`;
    const label = restaurant.name;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        Alert.alert("Error", "Unable to open maps");
      }
    }
  }, []);

  // Filter update handlers
  const updateBookingFilters = useCallback(
    (updates: Partial<BookingFilters>) => {
      setBookingFilters((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const updateGeneralFilters = useCallback((filters: GeneralFilters) => {
    setGeneralFilters(filters);
  }, []);

  // Generate search suggestions for autocomplete
  const generateSearchSuggestions = useCallback(
    (partialQuery: string) => {
      if (partialQuery.length < 2) {
        setSearchSuggestions([]);
        return;
      }

      const suggestions = advancedSearchEngine.generateSuggestions(
        partialQuery,
        allRestaurants.length > 0 ? allRestaurants : restaurants,
      );
      setSearchSuggestions(suggestions);
    },
    [allRestaurants, restaurants],
  );

  const toggleAvailableOnly = useCallback(() => {
    setBookingFilters((prev) => ({
      ...prev,
      availableOnly: !prev.availableOnly,
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setGeneralFilters(DEFAULT_GENERAL_FILTERS);
    setBookingFilters((prev) => ({ ...prev, availableOnly: false }));
    setSearchQuery("");
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // The effect below will trigger the search
  }, []);

  // Debounced restaurant fetching
  const debouncedFetchRestaurants = useCallback(
    (
      query: string,
      gFilters: GeneralFilters,
      bFilters: BookingFilters,
      favCuisines: string[] | undefined,
      favoriteSet: Set<string>,
    ) => {
      // Clear existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Set new timeout
      fetchTimeoutRef.current = setTimeout(() => {
        fetchRestaurants(query, gFilters, bFilters, favCuisines, favoriteSet);
      }, 300);
    },
    [fetchRestaurants],
  );

  // Initialize on mount
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Trigger fetching when dependencies change
  useEffect(() => {
    // Wait for location to be loaded or confirmed as not available
    if (!locationLoading) {
      debouncedFetchRestaurants(
        searchQuery,
        generalFilters,
        bookingFilters,
        profile?.favorite_cuisines,
        favoritesSet,
      );
    }

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [
    searchQuery,
    generalFilters,
    bookingFilters,
    userLocation,
    locationLoading,
    profile?.favorite_cuisines,
    favoritesSet,
    debouncedFetchRestaurants,
    refreshing,
  ]);

  // Computed values
  const activeFilterCount = useMemo(
    () => calculateActiveFilterCount(generalFilters, bookingFilters),
    [generalFilters, bookingFilters],
  );

  const dateOptions = useMemo(() => generateDateOptions(14), []);

  return {
    searchState: {
      restaurants,
      favorites: favoritesSet,
      loading: loading || locationLoading,
      refreshing,
      userLocation,
      viewMode,
      searchQuery,
      bookingFilters,
      generalFilters,
      searchSuggestions,
    },
    actions: {
      setViewMode,
      setSearchQuery,
      updateBookingFilters,
      updateGeneralFilters,
      toggleFavorite,
      clearAllFilters,
      handleRefresh,
      generateSearchSuggestions,
    },
    handlers: {
      handleRestaurantPress,
      openDirections,
      toggleAvailableOnly,
    },
    computed: {
      activeFilterCount,
      dateOptions,
    },
    // Expose location utilities
    location: {
      formatDistance,
      calculateDistance,
      displayName: getDisplayName(),
    },
  };
};
