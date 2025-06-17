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
import MapView, { Marker, Callout, Region } from "react-native-maps";
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

const AMBIANCE_TAGS = [
  "romantic", "business", "family-friendly", "casual", "upscale", "trendy",
];

const TIME_SLOTS = [
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"
];

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

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
  ambianceTags: string[];
  minRating: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

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
    ambianceTags: [],
    minRating: 0,
  });
  
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: 33.8938,
    longitude: 35.5018,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  
  // Refs
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);

  // Distance calculation
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

  // Extract coordinates from PostGIS geography type or coordinate object
  const extractCoordinates = (location: any): { lat: number; lng: number } | null => {
    if (!location) return null;
    
    // Handle PostGIS geography type with coordinates array [lng, lat]
    if (location.coordinates && Array.isArray(location.coordinates)) {
      const [lng, lat] = location.coordinates;
      return { lat, lng };
    }
    
    // Handle object with lat/lng properties
    if (location.lat && location.lng) {
      return { lat: location.lat, lng: location.lng };
    }
    
    // Handle object with latitude/longitude properties
    if (location.latitude && location.longitude) {
      return { lat: location.latitude, lng: location.longitude };
    }
    
    return null;
  };

  // Generate time slots for availability checking
  const generateTimeSlots = (openTime: string, closeTime: string) => {
    const slots: string[] = [];
    const [openHour, openMinute] = openTime.split(":").map(Number);
    const [closeHour, closeMinute] = closeTime.split(":").map(Number);
    
    let currentHour = openHour;
    let currentMinute = openMinute;
    
    while (currentHour < closeHour || (currentHour === closeHour && currentMinute < closeMinute)) {
      slots.push(`${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`);
      currentMinute += 30;
      if (currentMinute >= 60) {
        currentHour++;
        currentMinute -= 60;
      }
    }
    
    return slots;
  };

  // Check availability for a restaurant
  const checkRestaurantAvailability = useCallback(async (restaurantId: string, date: Date, time: string, partySize: number) => {
    try {
      const dateStr = date.toISOString().split("T")[0];
      
      const { data, error } = await supabase
        .from("restaurant_availability")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("date", dateStr)
        .eq("time_slot", time)
        .gte("available_capacity", partySize);
      
      return !error && data && data.length > 0;
    } catch (error) {
      console.error("Error checking availability:", error);
      return false;
    }
  }, []);

  // Fetch user's favorites
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
      setMapRegion({
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } catch (error) {
      console.error("Error getting location:", error);
    }
  }, []);

  // Fetch restaurants with enhanced filtering
  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    
    try {
      let query = supabase.from("restaurants").select("*");
      
      // Apply search query
      if (searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${searchQuery}%,cuisine_type.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`
        );
      }
      
      // Apply cuisine filters
      if (generalFilters.cuisines.length > 0) {
        query = query.in("cuisine_type", generalFilters.cuisines);
      }
      
      // Apply price range filter
      if (generalFilters.priceRange.length < 4) {
        query = query.in("price_range", generalFilters.priceRange);
      }
      
      // Apply booking policy filter
      if (generalFilters.bookingPolicy !== "all") {
        query = query.eq("booking_policy", generalFilters.bookingPolicy);
      }
      
      // Apply minimum rating filter
      if (generalFilters.minRating > 0) {
        query = query.gte("average_rating", generalFilters.minRating);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      let processedRestaurants = (data || []).map(restaurant => {
        const coords = extractCoordinates(restaurant.location);
        const distance = userLocation && coords 
          ? calculateDistance(userLocation.latitude, userLocation.longitude, coords.lat, coords.lng)
          : undefined;
        
        return {
          ...restaurant,
          distance,
        };
      });
      
      // Apply feature filters (client-side)
      if (generalFilters.features.length > 0) {
        processedRestaurants = processedRestaurants.filter((restaurant) =>
          generalFilters.features.every((feature) => {
            const featureField = FEATURES.find((f) => f.id === feature)?.field;
            return featureField && restaurant[featureField as keyof Restaurant];
          })
        );
      }
      
      // Apply ambiance tag filters
      if (generalFilters.ambianceTags.length > 0) {
        processedRestaurants = processedRestaurants.filter((restaurant) =>
          generalFilters.ambianceTags.some((tag) =>
            restaurant.ambiance_tags?.includes(tag)
          )
        );
      }
      
      // Check availability if filtering by availability
      if (bookingFilters.availableOnly) {
        const availabilityChecks = await Promise.all(
          processedRestaurants.map(async (restaurant) => {
            const isAvailable = await checkRestaurantAvailability(
              restaurant.id,
              bookingFilters.date,
              bookingFilters.time,
              bookingFilters.partySize
            );
            return { ...restaurant, isAvailable };
          })
        );
        
        processedRestaurants = availabilityChecks.filter(r => r.isAvailable);
      }
      
      // Sort restaurants
      processedRestaurants.sort((a, b) => {
        switch (generalFilters.sortBy) {
          case "rating":
            return (b.average_rating || 0) - (a.average_rating || 0);
          case "name":
            return a.name.localeCompare(b.name);
          case "distance":
            return (a.distance || Infinity) - (b.distance || Infinity);
          case "availability":
            return bookingFilters.availableOnly ? 0 : (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0);
          case "recommended":
          default:
            const scoreA = (a.average_rating || 0) * 0.4 + 
                          (a.total_reviews || 0) * 0.001 +
                          (profile?.favorite_cuisines?.includes(a.cuisine_type) ? 0.3 : 0) +
                          (favorites.has(a.id) ? 0.2 : 0) +
                          (a.distance ? Math.max(0, 1 - a.distance / 10) * 0.1 : 0);
            const scoreB = (b.average_rating || 0) * 0.4 + 
                          (b.total_reviews || 0) * 0.001 +
                          (profile?.favorite_cuisines?.includes(b.cuisine_type) ? 0.3 : 0) +
                          (favorites.has(b.id) ? 0.2 : 0) +
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
    }
  }, [searchQuery, generalFilters, bookingFilters, userLocation, profile?.favorite_cuisines, favorites, calculateDistance, checkRestaurantAvailability]);

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
    const coords = extractCoordinates(restaurant.location);
    if (!coords) {
      Alert.alert("Error", "Location data not available");
      return;
    }

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

  // Initialize
  useEffect(() => {
    getUserLocation();
    fetchFavorites();
  }, [getUserLocation, fetchFavorites]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // Generate date options for next 14 days
  const dateOptions = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  // Restaurant card component
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
                onPress={() => toggleFavorite(item.id)}
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
            {bookingFilters.availableOnly && (
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
                onPress={() => openDirections(item)}
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

  // Map component
  const RestaurantMapView = React.memo(() => (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {restaurants.map((restaurant) => {
          const coords = extractCoordinates(restaurant.location);
          if (!coords) return null;
          
          return (
            <Marker
              key={restaurant.id}
              coordinate={{
                latitude: coords.lat,
                longitude: coords.lng,
              }}
              title={restaurant.name}
              description={restaurant.cuisine_type}
            >
              <Callout onPress={() => handleRestaurantPress(restaurant.id)}>
                <View className="p-2 w-48">
                  <Text className="font-semibold">{restaurant.name}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {restaurant.cuisine_type}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    {(restaurant.average_rating || 0) > 0 && (
                      <View className="flex-row items-center gap-1">
                        <Star size={12} color="#f59e0b" fill="#f59e0b" />
                        <Text className="text-xs">
                          {restaurant.average_rating?.toFixed(1)}
                        </Text>
                      </View>
                    )}
                    <Text className="text-xs">
                      {"$".repeat(restaurant.price_range)}
                    </Text>
                  </View>
                  <Text className="text-xs text-primary mt-1">Tap for details</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>
    </View>
  ));

  // Date picker modal
  const DatePickerModal = () => (
    <Modal
      visible={showDatePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowDatePicker(false)}
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-background rounded-lg w-80 max-h-96">
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
        </View>
      </View>
    </Modal>
  );

  // Time picker modal
  const TimePickerModal = () => (
    <Modal
      visible={showTimePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowTimePicker(false)}
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-background rounded-lg w-80 max-h-96">
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
        </View>
      </View>
    </Modal>
  );

  // Party size picker modal
  const PartySizePickerModal = () => (
    <Modal
      visible={showPartySizePicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowPartySizePicker(false)}
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View className="bg-background rounded-lg w-80">
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
        </View>
      </View>
    </Modal>
  );

  // General filters modal
  const GeneralFiltersModal = () => (
    <Modal
      visible={showGeneralFilters}
      animationType="slide"
      presentationStyle="pageSheet"
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
            <RadioGroup
              value={generalFilters.sortBy}
              onValueChange={(value) =>
                setGeneralFilters(prev => ({ ...prev, sortBy: value as any }))
              }
            >
              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="recommended" />
                  <Text>Recommended</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="availability" />
                  <Text>Best Availability</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="rating" />
                  <Text>Highest Rated</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="distance" />
                  <Text>Nearest First</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="name" />
                  <Text>A-Z</Text>
                </View>
              </View>
            </RadioGroup>
          </View>
          
          {/* Cuisines */}
          <View className="p-4 border-b border-border">
            <Text className="font-semibold mb-3">Cuisines</Text>
            <View className="flex-row flex-wrap gap-2">
              {CUISINE_TYPES.map((cuisine) => (
                <Pressable
                  key={cuisine}
                  onPress={() => {
                    const isSelected = generalFilters.cuisines.includes(cuisine);
                    setGeneralFilters(prev => ({
                      ...prev,
                      cuisines: isSelected
                        ? prev.cuisines.filter((c) => c !== cuisine)
                        : [...prev.cuisines, cuisine],
                    }));
                  }}
                  className={`px-3 py-2 rounded-full border ${
                    generalFilters.cuisines.includes(cuisine)
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      generalFilters.cuisines.includes(cuisine)
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
                    const isSelected = generalFilters.priceRange.includes(price);
                    setGeneralFilters(prev => ({
                      ...prev,
                      priceRange: isSelected
                        ? prev.priceRange.filter((p) => p !== price)
                        : [...prev.priceRange, price],
                    }));
                  }}
                  className={`px-4 py-2 rounded-lg border ${
                    generalFilters.priceRange.includes(price)
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      generalFilters.priceRange.includes(price)
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
                <View key={feature.id} className="flex-row items-center gap-3">
                  <Checkbox
                    checked={generalFilters.features.includes(feature.id)}
                    onCheckedChange={(checked) => {
                      setGeneralFilters(prev => ({
                        ...prev,
                        features: checked
                          ? [...prev.features, feature.id]
                          : prev.features.filter((f) => f !== feature.id),
                      }));
                    }}
                  />
                  <Text>{feature.label}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Booking Policy */}
          <View className="p-4 border-b border-border">
            <Text className="font-semibold mb-3">Booking Policy</Text>
            <RadioGroup
              value={generalFilters.bookingPolicy}
              onValueChange={(value) =>
                setGeneralFilters(prev => ({ ...prev, bookingPolicy: value as any }))
              }
            >
              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="all" />
                  <Text>All</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="instant" />
                  <Text>Instant Book Only</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="request" />
                  <Text>Request to Book Only</Text>
                </View>
              </View>
            </RadioGroup>
          </View>
          
          {/* Minimum Rating */}
          <View className="p-4">
            <Text className="font-semibold mb-3">Minimum Rating</Text>
            <View className="flex-row gap-2">
              {[0, 3, 4, 4.5].map((rating) => (
                <Pressable
                  key={rating}
                  onPress={() => setGeneralFilters(prev => ({ ...prev, minRating: rating }))}
                  className={`px-3 py-2 rounded-lg border ${
                    generalFilters.minRating === rating
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      generalFilters.minRating === rating
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
            onPress={() => {
              setGeneralFilters({
                sortBy: "recommended",
                cuisines: [],
                features: [],
                priceRange: [1, 2, 3, 4],
                bookingPolicy: "all",
                ambianceTags: [],
                minRating: 0,
              });
            }}
          >
            <Text>Clear All</Text>
          </Button>
          <Button
            variant="default"
            className="flex-1"
            onPress={() => {
              setShowGeneralFilters(false);
              fetchRestaurants();
            }}
          >
            <Text>Apply Filters</Text>
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (generalFilters.sortBy !== "recommended") count++;
    count += generalFilters.cuisines.length;
    count += generalFilters.features.length;
    if (generalFilters.priceRange.length < 4) count++;
    if (generalFilters.bookingPolicy !== "all") count++;
    count += generalFilters.ambianceTags.length;
    if (generalFilters.minRating > 0) count++;
    if (bookingFilters.availableOnly) count++;
    return count;
  }, [generalFilters, bookingFilters]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRestaurants();
  }, [fetchRestaurants]);

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
            onSubmitEditing={fetchRestaurants}
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
            onPress={() => setBookingFilters(prev => ({ ...prev, availableOnly: !prev.availableOnly }))}
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
                onPress={() => {
                  setGeneralFilters({
                    sortBy: "recommended",
                    cuisines: [],
                    features: [],
                    priceRange: [1, 2, 3, 4],
                    bookingPolicy: "all",
                    ambianceTags: [],
                    minRating: 0,
                  });
                  setBookingFilters(prev => ({ ...prev, availableOnly: false }));
                  setSearchQuery("");
                }}
              >
                <Text>Clear all filters</Text>
              </Button>
            </View>
          }
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