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
} from "lucide-react-native";
import * as Location from "expo-location";
import * as Linking from "expo-linking";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, P, Muted } from "@/components/ui/typography";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Image } from "@/components/image";
import { supabase } from "@/config/supabase";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type ViewMode = "list" | "map";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Lebanese cuisines with proper categorization
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

const AMBIANCE_TAGS = [
  "romantic",
  "business",
  "family-friendly",
  "casual",
  "upscale",
  "trendy",
];

interface Filters {
  sortBy: "recommended" | "rating" | "distance" | "name";
  cuisines: string[];
  features: string[];
  priceRange: number[];
  bookingPolicy: "all" | "instant" | "request";
  ambianceTags: string[];
  minRating: number;
}

export default function SearchScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { colorScheme } = useColorScheme();
  
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  
  const [filters, setFilters] = useState<Filters>({
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
  
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);

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
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      setMapRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } catch (error) {
      console.error("Error getting location:", error);
    }
  }, []);

  // Calculate distance between two points
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Fetch and filter restaurants
  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    
    try {
      let query = supabase.from("restaurants").select("*");
      
      // Apply search query
      if (searchQuery) {
        query = query.or(
          `name.ilike.%${searchQuery}%,cuisine_type.ilike.%${searchQuery}%,tags.cs.{${searchQuery}}`
        );
      }
      
      // Apply cuisine filters
      if (filters.cuisines.length > 0) {
        query = query.in("cuisine_type", filters.cuisines);
      }
      
      // Apply price range filter
      if (filters.priceRange.length < 4) {
        query = query.in("price_range", filters.priceRange);
      }
      
      // Apply booking policy filter
      if (filters.bookingPolicy !== "all") {
        query = query.eq("booking_policy", filters.bookingPolicy);
      }
      
      // Apply minimum rating filter
      if (filters.minRating > 0) {
        query = query.gte("average_rating", filters.minRating);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      let filteredData = data || [];
      
      // Apply feature filters (client-side)
      if (filters.features.length > 0) {
        filteredData = filteredData.filter((restaurant) =>
          filters.features.every((feature) => {
            const featureField = FEATURES.find((f) => f.id === feature)?.field;
            return featureField && restaurant[featureField as keyof Restaurant];
          })
        );
      }
      
      // Apply ambiance tag filters (client-side)
      if (filters.ambianceTags.length > 0) {
        filteredData = filteredData.filter((restaurant) =>
          filters.ambianceTags.some((tag) =>
            restaurant.ambiance_tags?.includes(tag)
          )
        );
      }
      
      // Sort restaurants
      const sortedData = [...filteredData].sort((a, b) => {
        switch (filters.sortBy) {
          case "rating":
            return (b.average_rating || 0) - (a.average_rating || 0);
          case "name":
            return a.name.localeCompare(b.name);
          case "distance":
            if (!userLocation) return 0;
            const distA = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              a.location.lat,
              a.location.lng
            );
            const distB = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              b.location.lat,
              b.location.lng
            );
            return distA - distB;
          case "recommended":
          default:
            // Complex recommendation algorithm
            const scoreA = (a.average_rating || 0) * 0.4 + 
                          (a.total_reviews || 0) * 0.001 +
                          (profile?.favorite_cuisines?.includes(a.cuisine_type) ? 0.3 : 0) +
                          (favorites.has(a.id) ? 0.2 : 0);
            const scoreB = (b.average_rating || 0) * 0.4 + 
                          (b.total_reviews || 0) * 0.001 +
                          (profile?.favorite_cuisines?.includes(b.cuisine_type) ? 0.3 : 0) +
                          (favorites.has(b.id) ? 0.2 : 0);
            return scoreB - scoreA;
        }
      });
      
      setRestaurants(sortedData);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      Alert.alert("Error", "Failed to load restaurants");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, filters, userLocation, profile, favorites, calculateDistance]);

  // Initial load
  useEffect(() => {
    getUserLocation();
    fetchFavorites();
  }, [getUserLocation, fetchFavorites]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // Navigate to restaurant details
  const handleRestaurantPress = useCallback((restaurantId: string) => {
    router.push({
      pathname: "/restaurant/[id]",
      params: { id: restaurantId },
    });
  }, [router]);

  // Open directions
  const openDirections = useCallback(async (restaurant: Restaurant) => {
    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${restaurant.location.lat},${restaurant.location.lng}`;
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

  // Restaurant card component
  const RestaurantCard = ({ item }: { item: Restaurant }) => {
    const distance = userLocation
      ? calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.location.lat,
          item.location.lng
        )
      : null;
    
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
              <H3 className="flex-1">{item.name}</H3>
              <Pressable
                onPress={() => toggleFavorite(item.id)}
                className="p-1"
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
              {item.average_rating > 0 && (
                <View className="flex-row items-center gap-1">
                  <Star size={14} color="#f59e0b" fill="#f59e0b" />
                  <Text className="text-sm font-medium">
                    {item.average_rating.toFixed(1)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    ({item.total_reviews})
                  </Text>
                </View>
              )}
              
              <View className="flex-row items-center gap-1">
                <DollarSign size={14} color="#666" />
                <Text className="text-sm">{"$".repeat(item.price_range)}</Text>
              </View>
              
              {distance && (
                <View className="flex-row items-center gap-1">
                  <MapPin size={14} color="#666" />
                  <Text className="text-sm text-muted-foreground">
                    {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
                  </Text>
                </View>
              )}
            </View>
            
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
  };

  // Filter modal content
  const FilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilters(false)}
    >
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <View className="flex-row items-center justify-between p-4 border-b border-border">
          <H3>Filters</H3>
          <Pressable onPress={() => setShowFilters(false)}>
            <X size={24} color={colorScheme === "dark" ? "#fff" : "#000"} />
          </Pressable>
        </View>
        
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Sort By */}
          <View className="p-4 border-b border-border">
            <Text className="font-semibold mb-3">Sort By</Text>
            <RadioGroup
              value={filters.sortBy}
              onValueChange={(value) =>
                setFilters({ ...filters, sortBy: value as any })
              }
            >
              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  <RadioGroupItem value="recommended" />
                  <Text>Recommended</Text>
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
                    const isSelected = filters.cuisines.includes(cuisine);
                    setFilters({
                      ...filters,
                      cuisines: isSelected
                        ? filters.cuisines.filter((c) => c !== cuisine)
                        : [...filters.cuisines, cuisine],
                    });
                  }}
                  className={`px-3 py-2 rounded-full border ${
                    filters.cuisines.includes(cuisine)
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      filters.cuisines.includes(cuisine)
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
                    const isSelected = filters.priceRange.includes(price);
                    setFilters({
                      ...filters,
                      priceRange: isSelected
                        ? filters.priceRange.filter((p) => p !== price)
                        : [...filters.priceRange, price],
                    });
                  }}
                  className={`px-4 py-2 rounded-lg border ${
                    filters.priceRange.includes(price)
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      filters.priceRange.includes(price)
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
                    checked={filters.features.includes(feature.id)}
                    onCheckedChange={(checked) => {
                      setFilters({
                        ...filters,
                        features: checked
                          ? [...filters.features, feature.id]
                          : filters.features.filter((f) => f !== feature.id),
                      });
                    }}
                  />
                  <Text>{feature.label}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Ambiance */}
          <View className="p-4 border-b border-border">
            <Text className="font-semibold mb-3">Ambiance</Text>
            <View className="flex-row flex-wrap gap-2">
              {AMBIANCE_TAGS.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => {
                    const isSelected = filters.ambianceTags.includes(tag);
                    setFilters({
                      ...filters,
                      ambianceTags: isSelected
                        ? filters.ambianceTags.filter((t) => t !== tag)
                        : [...filters.ambianceTags, tag],
                    });
                  }}
                  className={`px-3 py-2 rounded-full border ${
                    filters.ambianceTags.includes(tag)
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      filters.ambianceTags.includes(tag)
                        ? "text-primary-foreground"
                        : "text-foreground"
                    }
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          
          {/* Booking Policy */}
          <View className="p-4 border-b border-border">
            <Text className="font-semibold mb-3">Booking Policy</Text>
            <RadioGroup
              value={filters.bookingPolicy}
              onValueChange={(value) =>
                setFilters({ ...filters, bookingPolicy: value as any })
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
                  onPress={() => setFilters({ ...filters, minRating: rating })}
                  className={`px-3 py-2 rounded-lg border ${
                    filters.minRating === rating
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text
                    className={
                      filters.minRating === rating
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
              setFilters({
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
              setShowFilters(false);
              fetchRestaurants();
            }}
          >
            <Text>Apply Filters</Text>
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );

  // Map view
  const MapView = () => (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        region={mapRegion}
        onRegionChangeComplete={setMapRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {restaurants.map((restaurant) => (
          <Marker
            key={restaurant.id}
            coordinate={{
              latitude: restaurant.location.lat,
              longitude: restaurant.location.lng,
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
                  {restaurant.average_rating > 0 && (
                    <View className="flex-row items-center gap-1">
                      <Star size={12} color="#f59e0b" fill="#f59e0b" />
                      <Text className="text-xs">
                        {restaurant.average_rating.toFixed(1)}
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
        ))}
      </MapView>
    </View>
  );

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sortBy !== "recommended") count++;
    count += filters.cuisines.length;
    count += filters.features.length;
    if (filters.priceRange.length < 4) count++;
    if (filters.bookingPolicy !== "all") count++;
    count += filters.ambianceTags.length;
    if (filters.minRating > 0) count++;
    return count;
  }, [filters]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="p-4 border-b border-border">
        {/* Search Bar */}
        <View className="flex-row items-center gap-3 bg-muted rounded-lg px-3 py-2 mb-3">
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
        
        {/* View Toggle and Filter */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row bg-muted rounded-lg p-1">
            <Pressable
              onPress={() => setViewMode("list")}
              className={`flex-row items-center gap-2 px-3 py-2 rounded-md ${
                viewMode === "list" ? "bg-background" : ""
              }`}
            >
              <List
                size={18}
                color={
                  viewMode === "list"
                    ? colorScheme === "dark"
                      ? "#fff"
                      : "#000"
                    : "#666"
                }
              />
              <Text
                className={viewMode === "list" ? "font-medium" : "text-muted-foreground"}
              >
                List
              </Text>
            </Pressable>
            
            <Pressable
              onPress={() => setViewMode("map")}
              className={`flex-row items-center gap-2 px-3 py-2 rounded-md ${
                viewMode === "map" ? "bg-background" : ""
              }`}
            >
              <Map
                size={18}
                color={
                  viewMode === "map"
                    ? colorScheme === "dark"
                      ? "#fff"
                      : "#000"
                    : "#666"
                }
              />
              <Text
                className={viewMode === "map" ? "font-medium" : "text-muted-foreground"}
              >
                Map
              </Text>
            </Pressable>
          </View>
          
          <Pressable
            onPress={() => setShowFilters(true)}
            className="flex-row items-center gap-2 bg-primary px-3 py-2 rounded-lg"
          >
            <Filter size={18} color="#fff" />
            <Text className="text-primary-foreground font-medium">Filter</Text>
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
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchRestaurants();
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Muted>No restaurants found</Muted>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onPress={() => {
                  setFilters({
                    sortBy: "recommended",
                    cuisines: [],
                    features: [],
                    priceRange: [1, 2, 3, 4],
                    bookingPolicy: "all",
                    ambianceTags: [],
                    minRating: 0,
                  });
                  setSearchQuery("");
                }}
              >
                <Text>Clear filters</Text>
              </Button>
            </View>
          }
        />
      ) : (
        <MapView />
      )}
      
      <FilterModal />
    </SafeAreaView>
  );
}