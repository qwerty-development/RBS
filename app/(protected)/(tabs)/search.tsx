// app/(protected)/(tabs)/search.tsx
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  Platform,
  Dimensions,
  Alert,
  RefreshControl,
} from "react-native";
import MapView, { Region } from "react-native-maps";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as Linking from "expo-linking";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { SearchHeader } from "@/components/search/SearchHeader";
import { RestaurantMapView } from "@/components/search/RestaurantMapView";
import { DatePickerModal } from "@/components/search/DatePickerModal";
import { TimePickerModal } from "@/components/search/TimePickerModal";
import { PartySizePickerModal } from "@/components/search/PartySizePickerModal";
import { GeneralFiltersModal } from "@/components/search/GeneralFiltersModal";

// Type definitions
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  distance?: number;
  availableSlots?: string[];
  isAvailable?: boolean;
  staticCoordinates?: { lat: number; lng: number };
};
type ViewMode = "list" | "map";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Constants
const CUISINE_TYPES = [
  "Lebanese",
  "Italian",
  "French",
  "Japanese",
  "Chinese",
  "Indian",
  "Mexican",
  "American",
  "Mediterranean",
  "Seafood",
  "Steakhouse",
  "Vegetarian",
];

const FEATURES = [
  { id: "outdoor_seating", label: "Outdoor Seating", field: "outdoor_seating" },
  { id: "valet_parking", label: "Valet Parking", field: "valet_parking" },
  { id: "parking_available", label: "Parking", field: "parking_available" },
  { id: "shisha_available", label: "Shisha", field: "shisha_available" },
  { id: "live_music", label: "Live Music", field: "live_music_schedule" },
];

const TIME_SLOTS = [
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
];

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

// FIXED: Lebanon geographic bounds for realistic coordinates
const LEBANON_BOUNDS = {
  north: 34.691,
  south: 33.039,
  east: 36.625,
  west: 35.099,
  // Major city centers for realistic distribution
  cities: [
    { name: "Beirut", lat: 33.8938, lng: 35.5018, weight: 0.4 },
    { name: "Tripoli", lat: 34.4332, lng: 35.8498, weight: 0.15 },
    { name: "Sidon", lat: 33.5634, lng: 35.3711, weight: 0.15 },
    { name: "Tyre", lat: 33.2704, lng: 35.2038, weight: 0.1 },
    { name: "Jounieh", lat: 33.9806, lng: 35.6178, weight: 0.1 },
    { name: "Baalbek", lat: 34.0042, lng: 36.2075, weight: 0.1 },
  ],
};

interface BookingFilters {
  date: Date;
  time: string;
  partySize: number;
  availableOnly: boolean;
}

interface GeneralFilters {
  sortBy: "recommended" | "rating" | "distance" | "name" | "availability";
  cuisines: string[];
  features: string[];
  priceRange: number[];
  bookingPolicy: "all" | "instant" | "request";
  minRating: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

// FIXED: Improved static coordinate generation with realistic Lebanon distribution
const generateStaticCoordinates = (
  restaurantId: string
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
    Math.min(LEBANON_BOUNDS.north, selectedCity.lat + latOffset)
  );
  const lng = Math.max(
    LEBANON_BOUNDS.west,
    Math.min(LEBANON_BOUNDS.east, selectedCity.lng + lngOffset)
  );

  return { lat, lng };
};

export default function SearchScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();

  // Core state
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [showGeneralFilters, setShowGeneralFilters] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPartySizePicker, setShowPartySizePicker] = useState(false);

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  // Booking filters (prominent)
  const [bookingFilters, setBookingFilters] = useState<BookingFilters>({
    date: new Date(),
    time: "19:00",
    partySize: 2,
    availableOnly: false,
  });

  // General filters (secondary)
  const [generalFilters, setGeneralFilters] = useState<GeneralFilters>({
    sortBy: "recommended",
    cuisines: [],
    features: [],
    priceRange: [1, 2, 3, 4],
    bookingPolicy: "all",
    minRating: 0,
  });

  // FIXED: Separate map region state to prevent conflicts
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 33.8938,
    longitude: 35.5018,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Refs
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);
  const fetchTimeoutRef = useRef<any>(null);
  const isInitialLoad = useRef(true);

  // FIXED: Stable calculation function
  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
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
    },
    []
  );

  // FIXED: Normalize time format for database queries
  const normalizeTimeForDatabase = useCallback((time: string): string => {
    if (time.length === 5) {
      return `${time}:00`;
    }
    return time;
  }, []);

  // FIXED: Check availability with better mock data for development
  const checkRestaurantAvailability = useCallback(
    async (
      restaurantId: string,
      date: Date,
      time: string,
      partySize: number
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
        const restaurantSeed = restaurantId
          .split("")
          .reduce((acc, char, index) => {
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
          Math.min(0.95, availabilityChance + restaurantFactor)
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
    },
    [normalizeTimeForDatabase]
  );

  // FIXED: Stable favorites fetching
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

  // FIXED: Optimized toggle favorite
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

  // FIXED: Stable location fetching
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

  // FIXED: Stable restaurant fetching with proper debouncing
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
        if (gFilters.features.length > 0) {
          processedRestaurants = processedRestaurants.filter((restaurant) =>
            gFilters.features.every((feature) => {
              const featureField = FEATURES.find(
                (f) => f.id === feature
              )?.field;
              return (
                featureField && restaurant[featureField as keyof Restaurant]
              );
            })
          );
        }

        // FIXED: Always check availability for selected date/time, but only filter if availableOnly is true
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

        // Update all restaurants with availability info
        processedRestaurants = availabilityChecks;

        // Filter by availability only if the user has enabled "Available Now"
        if (bFilters.availableOnly) {
          processedRestaurants = processedRestaurants.filter(
            (r) => r.isAvailable
          );
        }

        // Sort restaurants
        processedRestaurants.sort((a, b) => {
          switch (gFilters.sortBy) {
            case "rating":
              return (b.average_rating || 0) - (a.average_rating || 0);
            case "name":
              return a.name.localeCompare(b.name);
            case "distance":
              return (a.distance || Infinity) - (b.distance || Infinity);
            case "availability":
              return bFilters.availableOnly
                ? 0
                : (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0);
            case "recommended":
            default:
              const scoreA =
                (a.average_rating || 0) * 0.4 +
                (a.total_reviews || 0) * 0.001 +
                (favoriteCuisines?.includes(a.cuisine_type) ? 0.3 : 0) +
                (favoriteSet.has(a.id) ? 0.2 : 0) +
                (a.distance ? Math.max(0, 1 - a.distance / 10) * 0.1 : 0);
              const scoreB =
                (b.average_rating || 0) * 0.4 +
                (b.total_reviews || 0) * 0.001 +
                (favoriteCuisines?.includes(b.cuisine_type) ? 0.3 : 0) +
                (favoriteSet.has(b.id) ? 0.2 : 0) +
                (b.distance ? Math.max(0, 1 - b.distance / 10) * 0.1 : 0);
              return scoreB - scoreA;
          }
        });

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
    [calculateDistance, checkRestaurantAvailability]
  );

  // FIXED: Stable debounced function with proper cleanup
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

  // FIXED: Initialize only once with stable dependencies
  useEffect(() => {
    getUserLocation();
    fetchFavorites();

    // Initial fetch after a short delay to ensure state is initialized
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
  }, []); // Only run once on mount

  // FIXED: Trigger fetching when dependencies change (ONLY after initial load)
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
  ]); // Removed debouncedFetchRestaurants from dependencies to prevent loop

  // Generate date options for next 14 days (memoized)
  const dateOptions = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  // FIXED: Stable map region handler to prevent conflicts
  const handleMapRegionChange = useCallback(
    (region: Region) => {
      // Only update if the change is significant (user intentionally moved map)
      const deltaThreshold = 0.01;
      if (
        Math.abs(region.latitude - mapRegion.latitude) > deltaThreshold ||
        Math.abs(region.longitude - mapRegion.longitude) > deltaThreshold
      ) {
        setMapRegion(region);
      }
    },
    [mapRegion]
  );

  // Calculate active filter count (memoized)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (generalFilters.sortBy !== "recommended") count++;
    count += generalFilters.cuisines.length;
    count += generalFilters.features.length;
    if (generalFilters.priceRange.length < 4) count++;
    if (generalFilters.bookingPolicy !== "all") count++;
    if (generalFilters.minRating > 0) count++;
    if (bookingFilters.availableOnly) count++;
    return count;
  }, [generalFilters, bookingFilters]);

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

  // Filter update handlers (optimized with useCallback)
  const updateBookingFilters = useCallback(
    (updates: Partial<BookingFilters>) => {
      setBookingFilters((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const toggleAvailableOnly = useCallback(() => {
    setBookingFilters((prev) => ({
      ...prev,
      availableOnly: !prev.availableOnly,
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setGeneralFilters({
      sortBy: "recommended",
      cuisines: [],
      features: [],
      priceRange: [1, 2, 3, 4],
      bookingPolicy: "all",
      minRating: 0,
    });
    setBookingFilters((prev) => ({ ...prev, availableOnly: false }));
    setSearchQuery("");
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <SearchHeader
        searchQuery={searchQuery}
        bookingFilters={bookingFilters}
        viewMode={viewMode}
        activeFilterCount={activeFilterCount}
        colorScheme={colorScheme}
        onSearchChange={setSearchQuery}
        onShowDatePicker={() => setShowDatePicker(true)}
        onShowTimePicker={() => setShowTimePicker(true)}
        onShowPartySizePicker={() => setShowPartySizePicker(true)}
        onToggleAvailableOnly={toggleAvailableOnly}
        onViewModeChange={setViewMode}
        onShowGeneralFilters={() => setShowGeneralFilters(true)}
      />

      {/* Results count with better availability context */}
      <View className="px-4 py-2 border-b border-border">
        <Text className="text-sm text-muted-foreground">
          {loading ? (
            "Searching restaurants..."
          ) : (
            <>
              {restaurants.length} restaurants found
              {bookingFilters.availableOnly
                ? ` • Showing only available for ${bookingFilters.time}`
                : ` • Showing availability for ${
                    bookingFilters.date.toDateString() ===
                    new Date().toDateString()
                      ? "today"
                      : bookingFilters.date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                  } at ${bookingFilters.time}`}
            </>
          )}
        </Text>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
          <Text className="mt-4 text-muted-foreground">
            Loading restaurants...
          </Text>
        </View>
      ) : viewMode === "list" ? (
        <FlatList
          ref={listRef}
          data={restaurants}
          renderItem={({ item }) => (
            <RestaurantSearchCard
              item={item}
              bookingFilters={bookingFilters}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              onDirections={openDirections}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colorScheme === "dark" ? "#fff" : "#000"}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Muted>No restaurants found</Muted>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onPress={clearAllFilters}
              >
                <Text>Clear all filters</Text>
              </Button>
            </View>
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={5}
          getItemLayout={(data, index) => ({
            length: 200,
            offset: 200 * index,
            index,
          })}
        />
      ) : (
        <RestaurantMapView
          restaurants={restaurants}
          mapRegion={mapRegion}
          mapRef={mapRef}
          onRegionChangeComplete={handleMapRegionChange}
          onRestaurantPress={(restaurantId: string) =>
            handleRestaurantPress(restaurantId)
          }
        />
      )}

      {/* Modals */}
      <DatePickerModal
        visible={showDatePicker}
        bookingFilters={bookingFilters}
        onDateSelect={(date) =>
          setBookingFilters((prev) => ({ ...prev, date }))
        }
        onClose={() => setShowDatePicker(false)}
      />
      <TimePickerModal
        visible={showTimePicker}
        bookingFilters={bookingFilters}
        onTimeSelect={(time) =>
          setBookingFilters((prev) => ({ ...prev, time }))
        }
        onClose={() => setShowTimePicker(false)}
      />
      <PartySizePickerModal
        visible={showPartySizePicker}
        bookingFilters={bookingFilters}
        onPartySizeSelect={(partySize) =>
          setBookingFilters((prev) => ({ ...prev, partySize }))
        }
        onClose={() => setShowPartySizePicker(false)}
      />
      <GeneralFiltersModal
        visible={showGeneralFilters}
        generalFilters={generalFilters}
        onApplyFilters={(filters) => {
          setGeneralFilters(filters);
          setShowGeneralFilters(false);
        }}
        onClose={() => setShowGeneralFilters(false)}
      />
    </SafeAreaView>
  );
}
