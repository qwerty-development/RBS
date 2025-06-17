// app/(protected)/(tabs)/search.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  Dimensions,
  Alert,
  RefreshControl,
} from "react-native";
import MapView, { Marker, Callout, Region, PROVIDER_GOOGLE } from "react-native-maps";
import { useRouter } from "expo-router";
import {
  Search as SearchIcon,
  Map,
  List,
  Filter,
  X,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Heart,
  Navigation,
  Calendar,
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react-native";
import * as Location from "expo-location";
import * as Linking from "expo-linking";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

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
  "Lebanese", "Italian", "French", "Japanese", "Chinese", "Indian",
  "Mexican", "American", "Mediterranean", "Seafood", "Steakhouse", "Vegetarian",
];

const FEATURES = [
  { id: "outdoor_seating", label: "Outdoor Seating", field: "outdoor_seating" },
  { id: "valet_parking", label: "Valet Parking", field: "valet_parking" },
  { id: "parking_available", label: "Parking", field: "parking_available" },
  { id: "shisha_available", label: "Shisha", field: "shisha_available" },
  { id: "live_music", label: "Live Music", field: "live_music_schedule" },
];

const TIME_SLOTS = [
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"
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
  ]
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
const generateStaticCoordinates = (restaurantId: string): { lat: number; lng: number } => {
  // Create a stable hash from restaurant ID
  const hash = restaurantId.split('').reduce((acc, char, index) => {
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
  
  const lat = Math.max(LEBANON_BOUNDS.south, Math.min(LEBANON_BOUNDS.north, 
    selectedCity.lat + latOffset));
  const lng = Math.max(LEBANON_BOUNDS.west, Math.min(LEBANON_BOUNDS.east, 
    selectedCity.lng + lngOffset));
  
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
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  // FIXED: Stable calculation function
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // FIXED: Normalize time format for database queries
  const normalizeTimeForDatabase = useCallback((time: string): string => {
    if (time.length === 5) {
      return `${time}:00`;
    }
    return time;
  }, []);

  // FIXED: Check availability with proper error handling
  const checkRestaurantAvailability = useCallback(async (restaurantId: string, date: Date, time: string, partySize: number): Promise<boolean> => {
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
        console.error("Availability check error:", error);
        return false;
      }
      
      return data && data.length > 0;
    } catch (error) {
      console.error("Error checking availability:", error);
      return false;
    }
  }, [normalizeTimeForDatabase]);

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
  const toggleFavorite = useCallback(async (restaurantId: string) => {
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
        const { error } = await supabase
          .from("favorites")
          .insert({
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
  }, [profile?.id, favorites]);

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
  const fetchRestaurants = useCallback(async (
    query: string,
    gFilters: GeneralFilters,
    bFilters: BookingFilters,
    location: UserLocation | null,
    favoriteCuisines: string[] | undefined,
    favoriteSet: Set<string>
  ) => {
    setLoading(true);
    
    try {
      let supabaseQuery = supabase
        .from("restaurants")
        .select("*");
      
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
        supabaseQuery = supabaseQuery.eq("booking_policy", gFilters.bookingPolicy);
      }
      
      // Apply minimum rating filter
      if (gFilters.minRating > 0) {
        supabaseQuery = supabaseQuery.gte("average_rating", gFilters.minRating);
      }
      
      const { data, error } = await supabaseQuery;
      
      if (error) throw error;
      
      let processedRestaurants = (data || []).map(restaurant => {
        const staticCoords = generateStaticCoordinates(restaurant.id);
        const distance = location 
          ? calculateDistance(location.latitude, location.longitude, staticCoords.lat, staticCoords.lng)
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
            const featureField = FEATURES.find((f) => f.id === feature)?.field;
            return featureField && restaurant[featureField as keyof Restaurant];
          })
        );
      }
      
      // FIXED: Check availability if filtering by availability
      if (bFilters.availableOnly) {
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
        
        processedRestaurants = availabilityChecks.filter(r => r.isAvailable);
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
            return bFilters.availableOnly ? 0 : (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0);
          case "recommended":
          default:
            const scoreA = (a.average_rating || 0) * 0.4 + 
                          (a.total_reviews || 0) * 0.001 +
                          (favoriteCuisines?.includes(a.cuisine_type) ? 0.3 : 0) +
                          (favoriteSet.has(a.id) ? 0.2 : 0) +
                          (a.distance ? Math.max(0, 1 - a.distance / 10) * 0.1 : 0);
            const scoreB = (b.average_rating || 0) * 0.4 + 
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
  }, [calculateDistance, checkRestaurantAvailability]);

  // FIXED: Stable debounced function with proper cleanup
  const debouncedFetchRestaurants = useCallback(
    (query: string, gFilters: GeneralFilters, bFilters: BookingFilters, location: UserLocation | null, favCuisines: string[] | undefined, favoriteSet: Set<string>) => {
      // Clear existing timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Set new timeout
      fetchTimeoutRef.current = setTimeout(() => {
        fetchRestaurants(query, gFilters, bFilters, location, favCuisines, favoriteSet);
      }, 300);
    },
    [fetchRestaurants]
  );

  // Navigation handlers
  const handleRestaurantPress = useCallback((restaurantId: string) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: { 
        id: restaurantId,
        date: bookingFilters.date.toISOString(),
        time: bookingFilters.time,
        partySize: bookingFilters.partySize.toString(),
      },
    });
  }, [router, bookingFilters]);

  const openDirections = useCallback(async (restaurant: Restaurant) => {
    const coords = restaurant.staticCoordinates || { lat: 33.8938, lng: 35.5018 };

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
  }, []); // Only run once on mount

  // FIXED: Trigger fetching when dependencies change (with stable references)
  useEffect(() => {
    debouncedFetchRestaurants(
      searchQuery,
      generalFilters,
      bookingFilters,
      userLocation,
      profile?.favorite_cuisines,
      favorites
    );
    
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
    debouncedFetchRestaurants
  ]);

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
  const handleMapRegionChange = useCallback((region: Region) => {
    // Only update if the change is significant (user intentionally moved map)
    const deltaThreshold = 0.01;
    if (
      Math.abs(region.latitude - mapRegion.latitude) > deltaThreshold ||
      Math.abs(region.longitude - mapRegion.longitude) > deltaThreshold
    ) {
      setMapRegion(region);
    }
  }, [mapRegion]);

  // FIXED: Restaurant card component (memoized with stable props)
  const RestaurantCard = React.memo(({ item }: { item: Restaurant }) => {
    return (
      <Pressable
        onPress={() => handleRestaurantPress(item.id)}
        className="bg-card rounded-xl overflow-hidden mb-4 shadow-sm"
      >
        <View className="flex-row">
          <Image
            source={{ uri: item.main_image_url }}
            className="w-32 h-32"
            contentFit="cover"
          />
          <View className="flex-1 p-4">
            <View className="flex-row justify-between items-start mb-1">
              <H3 className="flex-1" numberOfLines={2}>{item.name}</H3>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item.id);
                }}
                className="p-1 ml-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Heart
                  size={20}
                  color={favorites.has(item.id) ? "#ef4444" : "#666"}
                  fill={favorites.has(item.id) ? "#ef4444" : "transparent"}
                />
              </Pressable>
            </View>
            
            <P className="text-muted-foreground mb-2">{item.cuisine_type}</P>
            
            <View className="flex-row items-center gap-4 mb-2">
              {(item.average_rating || 0) > 0 && (
                <View className="flex-row items-center gap-1">
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <Text className="text-sm font-medium">
                    {item.average_rating?.toFixed(1)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    ({item.total_reviews || 0})
                  </Text>
                </View>
              )}
              
              <View className="flex-row items-center gap-1">
                <DollarSign size={14} color="#666" />
                <Text className="text-sm">{"$".repeat(item.price_range)}</Text>
              </View>
              
              {item.distance && (
                <View className="flex-row items-center gap-1">
                  <MapPin size={14} color="#666" />
                  <Text className="text-sm text-muted-foreground">
                    {item.distance < 1 ? `${(item.distance * 1000).toFixed(0)}m` : `${item.distance.toFixed(1)}km`}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Availability indicator */}
            {bookingFilters.availableOnly && item.isAvailable && (
              <View className="bg-green-100 dark:bg-green-900/20 px-2 py-1 rounded-full self-start mb-2">
                <Text className="text-xs text-green-800 dark:text-green-200 font-medium">
                  Available {bookingFilters.time}
                </Text>
              </View>
            )}
            
            {item.tags && item.tags.length > 0 && (
              <View className="flex-row flex-wrap gap-1">
                {item.tags.slice(0, 3).map((tag) => (
                  <View
                    key={tag}
                    className="bg-muted px-2 py-0.5 rounded-full"
                  >
                    <Text className="text-xs">{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
        
        <View className="border-t border-border px-4 py-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Clock size={14} color="#666" />
              <Text className="text-xs text-muted-foreground">
                {item.opening_time} - {item.closing_time}
              </Text>
            </View>
            
            <View className="flex-row items-center gap-2">
              <Text className={`text-xs font-medium ${
                item.booking_policy === "instant" ? "text-green-600" : "text-orange-600"
              }`}>
                {item.booking_policy === "instant" ? "Instant Book" : "Request to Book"}
              </Text>
              
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  openDirections(item);
                }}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Navigation size={16} color="#3b82f6" />
              </Pressable>
            </View>
          </View>
        </View>
      </Pressable>
    );
  });

  // FIXED: Optimized map component with stable coordinates and memoization
  const RestaurantMapView = React.memo(() => {
    // FIXED: Memoize markers to prevent recreation on every render
    const markers = useMemo(() => {
      return restaurants.map((restaurant) => {
        if (!restaurant.staticCoordinates) return null;
        
        return (
          <Marker
            key={`marker-${restaurant.id}`}
            coordinate={{
              latitude: restaurant.staticCoordinates.lat,
              longitude: restaurant.staticCoordinates.lng,
            }}
            title={restaurant.name}
            description={restaurant.cuisine_type}
            onPress={() => handleRestaurantPress(restaurant.id)}
          >
            {/* Custom marker with restaurant image */}
            <View className="items-center">
              <View className="bg-white rounded-full p-1 shadow-lg">
                <Image
                  source={{ uri: restaurant.main_image_url }}
                  className="w-12 h-12 rounded-full"
                  contentFit="cover"
                />
              </View>
              {/* Small triangle pointer */}
              <View style={{
                width: 0,
                height: 0,
                backgroundColor: 'transparent',
                borderStyle: 'solid',
                borderLeftWidth: 6,
                borderRightWidth: 6,
                borderBottomWidth: 0,
                borderTopWidth: 8,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: 'white',
                marginTop: -1,
              }} />
            </View>
            
            <Callout 
              tooltip
              onPress={() => handleRestaurantPress(restaurant.id)}
            >
              <View className="bg-white p-3 rounded-lg shadow-lg w-48">
                <Text className="font-semibold text-black">{restaurant.name}</Text>
                <Text className="text-sm text-gray-600 mb-2">
                  {restaurant.cuisine_type}
                </Text>
                <View className="flex-row items-center gap-2">
                  {(restaurant.average_rating || 0) > 0 && (
                    <View className="flex-row items-center gap-1">
                      <Star size={12} color="#f59e0b" fill="#f59e0b" />
                      <Text className="text-xs text-black">
                        {restaurant.average_rating?.toFixed(1)}
                      </Text>
                    </View>
                  )}
                  <Text className="text-xs text-black">
                    {"$".repeat(restaurant.price_range)}
                  </Text>
                </View>
                <Text className="text-xs text-blue-600 mt-2 font-medium">Tap for details</Text>
              </View>
            </Callout>
          </Marker>
        );
      }).filter(Boolean);
    }, [restaurants, handleRestaurantPress]);

    return (
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          onRegionChangeComplete={handleMapRegionChange}
          showsUserLocation
          showsMyLocationButton
          moveOnMarkerPress={false}
          showsCompass={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {markers}
        </MapView>
      </View>
    );
  }, [restaurants, mapRegion, handleMapRegionChange, handleRestaurantPress]);

  // FIXED: Simplified modal components with stable state management
  const DatePickerModal = React.memo(() => (
    <Modal
      visible={showDatePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDatePicker(false)}
      statusBarTranslucent={false}
    >
      <Pressable 
        className="flex-1 bg-black/50 justify-center items-center"
        onPress={() => setShowDatePicker(false)}
      >
        <Pressable className="bg-background rounded-lg w-80 max-h-96" onPress={(e) => e.stopPropagation()}>
          <View className="p-4 border-b border-border">
            <Text className="font-semibold text-lg">Select Date</Text>
          </View>
          <ScrollView className="max-h-64">
            {dateOptions.map((date, index) => {
              const isSelected = date.toDateString() === bookingFilters.date.toDateString();
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <Pressable
                  key={index}
                  onPress={() => {
                    setBookingFilters(prev => ({ ...prev, date }));
                    setShowDatePicker(false);
                  }}
                  className={`p-4 border-b border-border ${isSelected ? "bg-primary/10" : ""}`}
                >
                  <Text className={`font-medium ${isSelected ? "text-primary" : ""}`}>
                    {isToday ? "Today" : date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric"
                    })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View className="p-4">
            <Button variant="outline" onPress={() => setShowDatePicker(false)}>
              <Text>Cancel</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  ));

  const TimePickerModal = React.memo(() => (
    <Modal
      visible={showTimePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowTimePicker(false)}
      statusBarTranslucent={false}
    >
      <Pressable 
        className="flex-1 bg-black/50 justify-center items-center"
        onPress={() => setShowTimePicker(false)}
      >
        <Pressable className="bg-background rounded-lg w-80 max-h-96" onPress={(e) => e.stopPropagation()}>
          <View className="p-4 border-b border-border">
            <Text className="font-semibold text-lg">Select Time</Text>
          </View>
          <ScrollView className="max-h-64">
            <View className="p-4">
              <View className="flex-row flex-wrap gap-2">
                {TIME_SLOTS.map((time) => {
                  const isSelected = time === bookingFilters.time;
                  
                  return (
                    <Pressable
                      key={time}
                      onPress={() => {
                        setBookingFilters(prev => ({ ...prev, time }));
                        setShowTimePicker(false);
                      }}
                      className={`px-4 py-2 rounded-lg border ${
                        isSelected ? "bg-primary border-primary" : "bg-background border-border"
                      }`}
                    >
                      <Text className={isSelected ? "text-primary-foreground" : ""}>
                        {time}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
          <View className="p-4">
            <Button variant="outline" onPress={() => setShowTimePicker(false)}>
              <Text>Cancel</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  ));

  const PartySizePickerModal = React.memo(() => (
    <Modal
      visible={showPartySizePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowPartySizePicker(false)}
      statusBarTranslucent={false}
    >
      <Pressable 
        className="flex-1 bg-black/50 justify-center items-center"
        onPress={() => setShowPartySizePicker(false)}
      >
        <Pressable className="bg-background rounded-lg w-80" onPress={(e) => e.stopPropagation()}>
          <View className="p-4 border-b border-border">
            <Text className="font-semibold text-lg">Party Size</Text>
          </View>
          <View className="p-4">
            <View className="flex-row flex-wrap gap-3">
              {PARTY_SIZES.map((size) => {
                const isSelected = size === bookingFilters.partySize;
                
                return (
                  <Pressable
                    key={size}
                    onPress={() => {
                      setBookingFilters(prev => ({ ...prev, partySize: size }));
                      setShowPartySizePicker(false);
                    }}
                    className={`w-16 h-16 rounded-lg border items-center justify-center ${
                      isSelected ? "bg-primary border-primary" : "bg-background border-border"
                    }`}
                  >
                    <Text className={`font-bold text-lg ${isSelected ? "text-primary-foreground" : ""}`}>
                      {size}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className="p-4">
            <Button variant="outline" onPress={() => setShowPartySizePicker(false)}>
              <Text>Cancel</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  ));

  // FIXED: Optimized filters modal with local state management
  const GeneralFiltersModal = React.memo(() => {
    const [tempFilters, setTempFilters] = useState(generalFilters);

    // Synchronize with props when modal opens
    useEffect(() => {
      if (showGeneralFilters) {
        setTempFilters(generalFilters);
      }
    }, [showGeneralFilters, generalFilters]);

    const applyFilters = useCallback(() => {
      setGeneralFilters(tempFilters);
      setShowGeneralFilters(false);
    }, [tempFilters]);

    const clearAllFilters = useCallback(() => {
      const defaultFilters = {
        sortBy: "recommended" as const,
        cuisines: [],
        features: [],
        priceRange: [1, 2, 3, 4],
        bookingPolicy: "all" as const,
        minRating: 0,
      };
      setTempFilters(defaultFilters);
    }, []);

    return (
      <Modal
        visible={showGeneralFilters}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowGeneralFilters(false)}
      >
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
          <View className="flex-row items-center justify-between p-4 border-b border-border">
            <H3>More Filters</H3>
            <Pressable onPress={() => setShowGeneralFilters(false)}>
              <X size={24} />
            </Pressable>
          </View>
          
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Sort By */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Sort By</Text>
              <View className="gap-3">
                {[
                  { value: "recommended", label: "Recommended" },
                  { value: "availability", label: "Best Availability" },
                  { value: "rating", label: "Highest Rated" },
                  { value: "distance", label: "Nearest First" },
                  { value: "name", label: "A-Z" },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setTempFilters(prev => ({ ...prev, sortBy: option.value as any }))}
                    className="flex-row items-center gap-3"
                  >
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      tempFilters.sortBy === option.value ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {tempFilters.sortBy === option.value && (
                        <View className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </View>
                    <Text>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            
            {/* Cuisines */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Cuisines</Text>
              <View className="flex-row flex-wrap gap-2">
                {CUISINE_TYPES.map((cuisine) => (
                  <Pressable
                    key={cuisine}
                    onPress={() => {
                      const isSelected = tempFilters.cuisines.includes(cuisine);
                      setTempFilters(prev => ({
                        ...prev,
                        cuisines: isSelected
                          ? prev.cuisines.filter((c) => c !== cuisine)
                          : [...prev.cuisines, cuisine],
                      }));
                    }}
                    className={`px-3 py-2 rounded-full border ${
                      tempFilters.cuisines.includes(cuisine)
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        tempFilters.cuisines.includes(cuisine)
                          ? "text-primary-foreground"
                          : "text-foreground"
                      }
                    >
                      {cuisine}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            
            {/* Price Range */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Price Range</Text>
              <View className="flex-row gap-3">
                {[1, 2, 3, 4].map((price) => (
                  <Pressable
                    key={price}
                    onPress={() => {
                      const isSelected = tempFilters.priceRange.includes(price);
                      setTempFilters(prev => ({
                        ...prev,
                        priceRange: isSelected
                          ? prev.priceRange.filter((p) => p !== price)
                          : [...prev.priceRange, price],
                      }));
                    }}
                    className={`px-4 py-2 rounded-lg border ${
                      tempFilters.priceRange.includes(price)
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        tempFilters.priceRange.includes(price)
                          ? "text-primary-foreground"
                          : "text-foreground"
                      }
                    >
                      {"$".repeat(price)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            
            {/* Features */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Features</Text>
              <View className="gap-3">
                {FEATURES.map((feature) => (
                  <Pressable
                    key={feature.id}
                    onPress={() => {
                      const isSelected = tempFilters.features.includes(feature.id);
                      setTempFilters(prev => ({
                        ...prev,
                        features: isSelected
                          ? prev.features.filter((f) => f !== feature.id)
                          : [...prev.features, feature.id],
                      }));
                    }}
                    className="flex-row items-center gap-3"
                  >
                    <View className={`w-5 h-5 rounded border-2 items-center justify-center ${
                      tempFilters.features.includes(feature.id)
                        ? "border-primary bg-primary"
                        : "border-border"
                    }`}>
                      {tempFilters.features.includes(feature.id) && (
                        <Text className="text-white text-xs">✓</Text>
                      )}
                    </View>
                    <Text>{feature.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            
            {/* Booking Policy */}
            <View className="p-4 border-b border-border">
              <Text className="font-semibold mb-3">Booking Policy</Text>
              <View className="gap-3">
                {[
                  { value: "all", label: "All" },
                  { value: "instant", label: "Instant Book Only" },
                  { value: "request", label: "Request to Book Only" },
                ].map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setTempFilters(prev => ({ ...prev, bookingPolicy: option.value as any }))}
                    className="flex-row items-center gap-3"
                  >
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      tempFilters.bookingPolicy === option.value ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {tempFilters.bookingPolicy === option.value && (
                        <View className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </View>
                    <Text>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            
            {/* Minimum Rating */}
            <View className="p-4">
              <Text className="font-semibold mb-3">Minimum Rating</Text>
              <View className="flex-row gap-2">
                {[0, 3, 4, 4.5].map((rating) => (
                  <Pressable
                    key={rating}
                    onPress={() => setTempFilters(prev => ({ ...prev, minRating: rating }))}
                    className={`px-3 py-2 rounded-lg border ${
                      tempFilters.minRating === rating
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        tempFilters.minRating === rating
                          ? "text-primary-foreground"
                          : "text-foreground"
                      }
                    >
                      {rating === 0 ? "Any" : `${rating}+`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>
          
          <View className="p-4 border-t border-border flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onPress={clearAllFilters}
            >
              <Text>Clear All</Text>
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onPress={applyFilters}
            >
              <Text>Apply Filters</Text>
            </Button>
          </View>
        </SafeAreaView>
      </Modal>
    );
  });

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
  }, [debouncedFetchRestaurants, searchQuery, generalFilters, bookingFilters, userLocation, profile?.favorite_cuisines, favorites]);

  // Filter update handlers (optimized with useCallback)
  const updateBookingFilters = useCallback((updates: Partial<BookingFilters>) => {
    setBookingFilters(prev => ({ ...prev, ...updates }));
  }, []);

  const toggleAvailableOnly = useCallback(() => {
    setBookingFilters(prev => ({ ...prev, availableOnly: !prev.availableOnly }));
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
    setBookingFilters(prev => ({ ...prev, availableOnly: false }));
    setSearchQuery("");
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header with search */}
      <View className="p-4 border-b border-border">
        <View className="flex-row items-center gap-3 bg-muted rounded-lg px-3 py-2 mb-4">
          <SearchIcon size={20} color="#666" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search restaurants, cuisines..."
            placeholderTextColor="#666"
            className="flex-1 text-base text-foreground"
            returnKeyType="search"
          />
        </View>
        
        {/* Prominent booking filters */}
        <View className="flex-row gap-2 mb-4">
          {/* Date */}
          <Pressable
            onPress={() => setShowDatePicker(true)}
            className="flex-1 bg-muted rounded-lg p-3"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-muted-foreground mb-1">Date</Text>
                <Text className="font-medium">
                  {bookingFilters.date.toDateString() === new Date().toDateString() 
                    ? "Today" 
                    : bookingFilters.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                </Text>
              </View>
              <Calendar size={16} color="#666" />
            </View>
          </Pressable>
          
          {/* Time */}
          <Pressable
            onPress={() => setShowTimePicker(true)}
            className="flex-1 bg-muted rounded-lg p-3"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-muted-foreground mb-1">Time</Text>
                <Text className="font-medium">{bookingFilters.time}</Text>
              </View>
              <Clock size={16} color="#666" />
            </View>
          </Pressable>
          
          {/* Party Size */}
          <Pressable
            onPress={() => setShowPartySizePicker(true)}
            className="bg-muted rounded-lg p-3"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-muted-foreground mb-1">People</Text>
                <Text className="font-medium">{bookingFilters.partySize}</Text>
              </View>
              <Users size={16} color="#666" />
            </View>
          </Pressable>
        </View>
        
        {/* Secondary filters */}
        <View className="flex-row items-center justify-between">
          {/* Availability toggle */}
          <Pressable
            onPress={toggleAvailableOnly}
            className={`flex-row items-center gap-2 px-3 py-2 rounded-lg border ${
              bookingFilters.availableOnly 
                ? "bg-green-100 dark:bg-green-900/20 border-green-500" 
                : "bg-background border-border"
            }`}
          >
            <Text className={`text-sm font-medium ${
              bookingFilters.availableOnly ? "text-green-800 dark:text-green-200" : ""
            }`}>
              Available Now
            </Text>
          </Pressable>
          
          {/* View toggle */}
          <View className="flex-row bg-muted rounded-lg p-1">
            <Pressable
              onPress={() => setViewMode("list")}
              className={`flex-row items-center gap-2 px-3 py-1 rounded-md ${
                viewMode === "list" ? "bg-background" : ""
              }`}
            >
              <List size={16} color={viewMode === "list" ? (colorScheme === "dark" ? "#fff" : "#000") : "#666"} />
            </Pressable>
            <Pressable
              onPress={() => setViewMode("map")}
              className={`flex-row items-center gap-2 px-3 py-1 rounded-md ${
                viewMode === "map" ? "bg-background" : ""
              }`}
            >
              <Map size={16} color={viewMode === "map" ? (colorScheme === "dark" ? "#fff" : "#000") : "#666"} />
            </Pressable>
          </View>
          
          {/* More filters */}
          <Pressable
            onPress={() => setShowGeneralFilters(true)}
            className="flex-row items-center gap-2 bg-primary px-3 py-2 rounded-lg"
          >
            <Filter size={16} color="#fff" />
            <Text className="text-primary-foreground font-medium">Filters</Text>
            {activeFilterCount > 0 && (
              <View className="bg-white rounded-full px-2 py-0.5 ml-1">
                <Text className="text-xs text-primary font-medium">
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      
      {/* Results count */}
      <View className="px-4 py-2 border-b border-border">
        <Text className="text-sm text-muted-foreground">
          {restaurants.length} restaurants found
          {bookingFilters.availableOnly && ` • Available ${bookingFilters.time}`}
        </Text>
      </View>
      
      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
          <Text className="mt-4 text-muted-foreground">Loading restaurants...</Text>
        </View>
      ) : viewMode === "list" ? (
        <FlatList
          ref={listRef}
          data={restaurants}
          renderItem={({ item }) => <RestaurantCard item={item} />}
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
        <RestaurantMapView />
      )}
      
      {/* Modals */}
      <DatePickerModal />
      <TimePickerModal />
      <PartySizePickerModal />
      <GeneralFiltersModal />
    </SafeAreaView>
  );
}