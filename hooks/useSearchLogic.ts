// hooks/useSearchLogic.ts
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Alert, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Region } from "react-native-maps";

import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import {
  DEFAULT_BOOKING_FILTERS,
  DEFAULT_GENERAL_FILTERS,
  DEFAULT_MAP_REGION,
} from "@/constants/searchConstants";
import {
  generateStaticCoordinates,
  calculateDistance,
  checkRestaurantAvailability,
  sortRestaurants,
  applyFeatureFilters,
  calculateActiveFilterCount,
  generateDateOptions,
} from "@/lib/searchUtils";
import type {
  Restaurant,
  UserLocation,
  ViewMode,
  BookingFilters,
  GeneralFilters,
  UseSearchReturn,
} from "@/types/search";

export const useSearchLogic = (): UseSearchReturn => {
  const router = useRouter();
  const { profile } = useAuth();

  // Core state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_MAP_REGION);

  // Filter state
  const [bookingFilters, setBookingFilters] = useState<BookingFilters>(
    DEFAULT_BOOKING_FILTERS
  );
  const [generalFilters, setGeneralFilters] = useState<GeneralFilters>(
    DEFAULT_GENERAL_FILTERS
  );

  // Refs for optimization
  const fetchTimeoutRef = useRef<any>(null);
  const isInitialLoad = useRef(true);

  // Fetch favorites from database
  const fetchFavorites = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from("favorites")
        .select("restaurant_id")
        .eq("user_id", profile.id);

      if (error) throw error;
      setFavorites(new Set(data?.map((f) => f.restaurant_id) || []));
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  }, [profile?.id]);

  // Toggle favorite status
  const toggleFavorite = useCallback(
    async (restaurantId: string) => {
      if (!profile?.id) return;

      const isFavorite = favorites.has(restaurantId);

      try {
        if (isFavorite) {
          const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("user_id", profile.id)
            .eq("restaurant_id", restaurantId);

          if (error) throw error;

          setFavorites((prev) => {
            const next = new Set(prev);
            next.delete(restaurantId);
            return next;
          });
        } else {
          const { error } = await supabase.from("favorites").insert({
            user_id: profile.id,
            restaurant_id: restaurantId,
          });

          if (error) throw error;
          setFavorites((prev) => new Set([...prev, restaurantId]));
        }
      } catch (error) {
        console.error("Error toggling favorite:", error);
        Alert.alert("Error", "Failed to update favorite status");
      }
    },
    [profile?.id, favorites]
  );

  // Get user location
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(newLocation);

      // Only update map region if we don't have restaurants yet (initial load)
      if (isInitialLoad.current) {
        setMapRegion({
          latitude: newLocation.latitude,
          longitude: newLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (error) {
      console.error("Error getting location:", error);
    }
  }, []);

  // Main restaurant fetching logic
  const fetchRestaurants = useCallback(
    async (
      query: string,
      gFilters: GeneralFilters,
      bFilters: BookingFilters,
      location: UserLocation | null,
      favoriteCuisines: string[] | undefined,
      favoriteSet: Set<string>
    ) => {
      setLoading(true);

      try {
        let supabaseQuery = supabase.from("restaurants").select("*");

        // Apply search query
        if (query.trim()) {
          supabaseQuery = supabaseQuery.or(
            `name.ilike.%${query}%,cuisine_type.ilike.%${query}%,tags.cs.{${query}}`
          );
        }

        // Apply cuisine filters
        if (gFilters.cuisines.length > 0) {
          supabaseQuery = supabaseQuery.in("cuisine_type", gFilters.cuisines);
        }

        // Apply price range filter
        if (gFilters.priceRange.length < 4) {
          supabaseQuery = supabaseQuery.in("price_range", gFilters.priceRange);
        }

        // Apply booking policy filter
        if (gFilters.bookingPolicy !== "all") {
          supabaseQuery = supabaseQuery.eq(
            "booking_policy",
            gFilters.bookingPolicy
          );
        }

        // Apply minimum rating filter
        if (gFilters.minRating > 0) {
          supabaseQuery = supabaseQuery.gte(
            "average_rating",
            gFilters.minRating
          );
        }

        const { data, error } = await supabaseQuery;

        if (error) throw error;

        let processedRestaurants = (data || []).map((restaurant) => {
          const staticCoords = generateStaticCoordinates(restaurant.id);
          const distance = location
            ? calculateDistance(
                location.latitude,
                location.longitude,
                staticCoords.lat,
                staticCoords.lng
              )
            : undefined;

          return {
            ...restaurant,
            distance,
            staticCoordinates: staticCoords,
          };
        });

        // Apply feature filters (client-side)
        processedRestaurants = applyFeatureFilters(
          processedRestaurants,
          gFilters.features
        );

        // Check availability for all restaurants
        const availabilityChecks = await Promise.all(
          processedRestaurants.map(async (restaurant) => {
            const isAvailable = await checkRestaurantAvailability(
              restaurant.id,
              bFilters.date,
              bFilters.time,
              bFilters.partySize
            );
            return { ...restaurant, isAvailable };
          })
        );

        processedRestaurants = availabilityChecks;

        // Filter by availability if enabled
        if (bFilters.availableOnly) {
          processedRestaurants = processedRestaurants.filter(
            (r) => r.isAvailable
          );
        }

        // Sort restaurants
        processedRestaurants = sortRestaurants(
          processedRestaurants,
          gFilters.sortBy,
          location,
          favoriteCuisines,
          favoriteSet,
          bFilters.availableOnly
        );

        setRestaurants(processedRestaurants);
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        Alert.alert("Error", "Failed to load restaurants");
      } finally {
        setLoading(false);
        setRefreshing(false);
        isInitialLoad.current = false;
      }
    },
    []
  );

  // Debounced restaurant fetching
  const debouncedFetchRestaurants = useCallback(
    (
      query: string,
      gFilters: GeneralFilters,
      bFilters: BookingFilters,
      location: UserLocation | null,
      favCuisines: string[] | undefined,
      favoriteSet: Set<string>
    ) => {
      // Clear existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Set new timeout
      fetchTimeoutRef.current = setTimeout(() => {
        fetchRestaurants(
          query,
          gFilters,
          bFilters,
          location,
          favCuisines,
          favoriteSet
        );
      }, 300);
    },
    [fetchRestaurants]
  );

  // Navigation handlers
  const handleRestaurantPress = useCallback(
    (restaurantId: string) => {
      router.push({
        pathname: "/restaurant/[id]",
        params: {
          id: restaurantId,
          date: bookingFilters.date.toISOString(),
          time: bookingFilters.time,
          partySize: bookingFilters.partySize.toString(),
        },
      });
    },
    [router, bookingFilters]
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
    []
  );

  const updateGeneralFilters = useCallback((filters: GeneralFilters) => {
    setGeneralFilters(filters);
  }, []);

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
    debouncedFetchRestaurants(
      searchQuery,
      generalFilters,
      bookingFilters,
      userLocation,
      profile?.favorite_cuisines,
      favorites
    );
  }, [
    debouncedFetchRestaurants,
    searchQuery,
    generalFilters,
    bookingFilters,
    userLocation,
    profile?.favorite_cuisines,
    favorites,
  ]);

  // Initialize on mount
  useEffect(() => {
    getUserLocation();
    fetchFavorites();

    // Initial fetch after a short delay
    const initialFetchTimeout = setTimeout(() => {
      fetchRestaurants(
        searchQuery,
        generalFilters,
        bookingFilters,
        userLocation,
        profile?.favorite_cuisines,
        favorites
      );
      isInitialLoad.current = false;
    }, 100);

    return () => {
      clearTimeout(initialFetchTimeout);
    };
  }, []);

  // Trigger fetching when dependencies change
  useEffect(() => {
    if (!isInitialLoad.current) {
      debouncedFetchRestaurants(
        searchQuery,
        generalFilters,
        bookingFilters,
        userLocation,
        profile?.favorite_cuisines,
        favorites
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
    profile?.favorite_cuisines,
    favorites,
  ]);

  // Computed values
  const activeFilterCount = useMemo(
    () => calculateActiveFilterCount(generalFilters, bookingFilters),
    [generalFilters, bookingFilters]
  );

  const dateOptions = useMemo(() => generateDateOptions(14), []);

  return {
    searchState: {
      restaurants,
      favorites,
      loading,
      refreshing,
      userLocation,
      viewMode,
      searchQuery,
      bookingFilters,
      generalFilters,
    },
    actions: {
      setViewMode,
      setSearchQuery,
      updateBookingFilters,
      updateGeneralFilters,
      toggleFavorite,
      clearAllFilters,
      handleRefresh,
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
  };
};
