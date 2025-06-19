// app/(protected)/cuisine/[cuisineId].tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Modal,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  MapPin,
  Star,
  Filter,
  SlidersHorizontal,
  Clock,
  Utensils,
} from "lucide-react-native";

import { Text } from "@/components/ui/text";
import { H1, H2, H3, P, Muted } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/image";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import type { Restaurant } from "@/types/search";

// Type Definitions
type DatabaseRestaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type CuisineScreenParams = {
  cuisineId: string;
  cuisineName?: string;
};

type FilterOptions = {
  priceRange: number[];
  rating: number;
  distance: number;
  sortBy: "rating" | "distance" | "name" | "price";
  openNow: boolean;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SORT_OPTIONS = [
  { value: "rating", label: "Highest Rated" },
  { value: "distance", label: "Nearest" },
  { value: "name", label: "Name (A-Z)" },
  { value: "price", label: "Price (Low to High)" },
] as const;

export default function CuisineScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { cuisineId, cuisineName } =
    useLocalSearchParams<CuisineScreenParams>();

  // State Management
  const [restaurants, setRestaurants] = useState<DatabaseRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({
    priceRange: [1, 2, 3, 4],
    rating: 0,
    distance: 50,
    sortBy: "rating",
    openNow: false,
  });

  // FIXED: Updated query based on actual database schema
  const fetchCuisineRestaurants = useCallback(async () => {
    try {
      setLoading(true);

      console.log("Fetching restaurants for cuisine:", cuisineId);

      // Build base query using actual schema columns
      let query = supabase.from("restaurants").select("*"); // No joins needed, no is_active column

      // Try multiple approaches to find restaurants by cuisine
      let restaurantData: Restaurant[] = [];

      // Method 1: Exact match on cuisine_type
      const { data: exactData, error: exactError } = await query.eq(
        "cuisine_type",
        cuisineId
      );

      if (exactError) {
        console.error("Error with exact cuisine_type match:", exactError);
      } else if (exactData && exactData.length > 0) {
        restaurantData = exactData;
        console.log(
          `Found ${restaurantData.length} restaurants with exact cuisine match`
        );
      }

      // Method 2: If no exact match, try case-insensitive search
      if (restaurantData.length === 0) {
        const { data: iLikeData, error: iLikeError } = await supabase
          .from("restaurants")
          .select("*")
          .ilike("cuisine_type", `%${cuisineId}%`);

        if (iLikeError) {
          console.error("Error with ilike search:", iLikeError);
        } else if (iLikeData && iLikeData.length > 0) {
          restaurantData = iLikeData;
          console.log(
            `Found ${restaurantData.length} restaurants with case-insensitive match`
          );
        }
      }

      // Method 3: If still no results, search in tags array
      if (restaurantData.length === 0) {
        const { data: tagsData, error: tagsError } = await supabase
          .from("restaurants")
          .select("*")
          .contains("tags", [cuisineId]);

        if (tagsError) {
          console.error("Error searching tags:", tagsError);
        } else if (tagsData && tagsData.length > 0) {
          restaurantData = tagsData;
          console.log(`Found ${restaurantData.length} restaurants in tags`);
        }
      }

      // Method 4: Last resort - search for any tag that contains the cuisine
      if (restaurantData.length === 0) {
        const { data: allData, error: allError } = await supabase
          .from("restaurants")
          .select("*");

        if (allError) {
          console.error("Error fetching all restaurants:", allError);
        } else if (allData) {
          // Filter in JavaScript for tags that include the cuisine
          restaurantData = allData.filter(
            (restaurant) =>
              restaurant.tags &&
              restaurant.tags.some((tag) =>
                tag.toLowerCase().includes(cuisineId.toLowerCase())
              )
          );
          console.log(
            `Found ${restaurantData.length} restaurants with tag containing cuisine`
          );
        }
      }

      // Apply additional filters
      let processedRestaurants = restaurantData;

      // Rating filter
      if (filters.rating > 0) {
        processedRestaurants = processedRestaurants.filter(
          (restaurant) => (restaurant.average_rating || 0) >= filters.rating
        );
      }

      // Price range filter
      if (filters.priceRange.length < 4) {
        processedRestaurants = processedRestaurants.filter((restaurant) =>
          filters.priceRange.includes(restaurant.price_range)
        );
      }

      // Apply client-side filtering for open now using opening_time and closing_time
      if (filters.openNow) {
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes

        processedRestaurants = processedRestaurants.filter((restaurant) => {
          if (!restaurant.opening_time || !restaurant.closing_time) return true;

          // Convert time strings to minutes
          const [openHour, openMin] = restaurant.opening_time
            .split(":")
            .map(Number);
          const [closeHour, closeMin] = restaurant.closing_time
            .split(":")
            .map(Number);

          const openTime = openHour * 60 + openMin;
          const closeTime = closeHour * 60 + closeMin;

          // Handle overnight hours (e.g., open until 2 AM)
          if (closeTime < openTime) {
            return currentTime >= openTime || currentTime <= closeTime;
          }

          return currentTime >= openTime && currentTime <= closeTime;
        });
      }

      // Sort restaurants
      processedRestaurants.sort(getSortComparator(filters.sortBy));

      console.log(
        `Final result: ${processedRestaurants.length} restaurants for cuisine: ${cuisineId}`
      );
      setRestaurants(processedRestaurants as DatabaseRestaurant[]);
    } catch (error) {
      console.error("Error in fetchCuisineRestaurants:", error);
      setRestaurants([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cuisineId, filters]);

  // Utility Functions
  const getSortComparator = (sortBy: FilterOptions["sortBy"]) => {
    return (a: Restaurant, b: Restaurant) => {
      switch (sortBy) {
        case "rating":
          return (b.average_rating || 0) - (a.average_rating || 0);
        case "name":
          return a.name.localeCompare(b.name);
        case "price":
          return a.price_range - b.price_range;
        case "distance":
          // Placeholder - implement distance calculation if needed
          return 0;
        default:
          return 0;
      }
    };
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCuisineRestaurants();
  }, [fetchCuisineRestaurants]);

  const handleRestaurantPress = useCallback(
    (restaurant: Restaurant) => {
      router.push(`/(protected)/restaurant/${restaurant.id}`);
    },
    [router]
  );

  const handleToggleFavorite = useCallback(async (restaurantId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(restaurantId)) {
        newFavorites.delete(restaurantId);
      } else {
        newFavorites.add(restaurantId);
      }
      return newFavorites;
    });
  }, []);

  const handleDirections = useCallback(async (restaurant: any) => {
    // Simple directions implementation that works with the restaurant data
    // Default coordinates (Beirut) if no location available
    let lat = 33.8938;
    let lng = 35.5018;

    // Try to extract location from various possible formats
    if (restaurant.location) {
      if (
        typeof restaurant.location === "object" &&
        restaurant.location.coordinates
      ) {
        [lng, lat] = restaurant.location.coordinates;
      } else if (typeof restaurant.location === "string") {
        const match = restaurant.location.match(/POINT\(([^)]+)\)/);
        if (match) {
          [lng, lat] = match[1].split(" ").map(Number);
        }
      }
    }

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${lat},${lng}`;
    const label = encodeURIComponent(restaurant.name);
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`,
    });

    if (url) {
      try {
        await Linking.openURL(url);
      } catch (error) {
        console.error("Error opening maps:", error);
        Alert.alert("Error", "Unable to open maps application");
      }
    }
  }, []);

  const applyFilters = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
    setShowFilters(false);
  }, []);

  // Effects
  useEffect(() => {
    if (cuisineId) {
      fetchCuisineRestaurants();
    }
  }, [fetchCuisineRestaurants]);

  // Filter Statistics
  const stats = useMemo(() => {
    return {
      total: restaurants.length,
      avgRating:
        restaurants.length > 0
          ? restaurants.reduce((sum, r) => sum + (r.average_rating || 0), 0) /
            restaurants.length
          : 0,
      priceRange:
        restaurants.length > 0
          ? Math.round(
              restaurants.reduce((sum, r) => sum + r.price_range, 0) /
                restaurants.length
            )
          : 0,
    };
  }, [restaurants]);

  // Loading State
  if (loading && !refreshing) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
          <Muted className="mt-4">Loading {cuisineName} restaurants...</Muted>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft
              size={20}
              color={colorScheme === "dark" ? "#fff" : "#000"}
            />
          </Pressable>
          <View>
            <H1 className="text-lg">{cuisineName || cuisineId}</H1>
            <Muted>{stats.total} restaurants found</Muted>
          </View>
        </View>

        <Pressable
          onPress={() => setShowFilters(true)}
          className="w-10 h-10 items-center justify-center rounded-full bg-muted"
        >
          <SlidersHorizontal
            size={20}
            color={colorScheme === "dark" ? "#fff" : "#000"}
          />
        </Pressable>
      </View>

      {/* Stats Bar */}
      {restaurants.length > 0 && (
        <View className="flex-row items-center justify-between px-4 py-3 bg-muted/30">
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1">
              <Star size={16} color="#f59e0b" fill="#f59e0b" />
              <Text className="text-sm font-medium">
                {stats.avgRating.toFixed(1)}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-medium">
                {"$".repeat(stats.priceRange)} avg
              </Text>
            </View>
            {filters.openNow && (
              <View className="flex-row items-center gap-1">
                <Clock size={16} color="#10b981" />
                <Text className="text-sm text-green-600 font-medium">
                  Open Now
                </Text>
              </View>
            )}
          </View>

          <Text className="text-sm text-muted-foreground">
            Sorted by{" "}
            {SORT_OPTIONS.find((opt) => opt.value === filters.sortBy)?.label}
          </Text>
        </View>
      )}

      {/* Restaurant List */}
      <FlatList
        data={restaurants}
        renderItem={({ item }) => (
          <RestaurantSearchCard
            item={item}
            bookingFilters={{
              date: new Date(),
              time: "19:00",
              partySize: 2,
              availableOnly: filters.openNow,
            }}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onDirections={handleDirections}
            onPress={() => handleRestaurantPress(item)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16 }}
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
            <Utensils size={48} color="#666" />
            <H3 className="mt-4 text-center">No restaurants found</H3>
            <Muted className="mt-2 text-center px-4">
              {loading
                ? "Loading restaurants..."
                : `No ${cuisineName || cuisineId} restaurants found. Try adjusting your filters or check back later.`}
            </Muted>
            {!loading && (
              <Button
                variant="outline"
                onPress={() =>
                  setFilters({
                    priceRange: [1, 2, 3, 4],
                    rating: 0,
                    distance: 50,
                    sortBy: "rating",
                    openNow: false,
                  })
                }
                className="mt-4"
              >
                <Text>Clear Filters</Text>
              </Button>
            )}
          </View>
        }
      />

      {/* Bottom Sheet Filter Modal */}
      <Modal
        visible={showFilters}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <FilterBottomSheet
          filters={filters}
          onApply={applyFilters}
          onClose={() => setShowFilters(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

// Bottom Sheet Filter Component
function FilterBottomSheet({
  filters,
  onApply,
  onClose,
}: {
  filters: FilterOptions;
  onApply: (filters: FilterOptions) => void;
  onClose: () => void;
}) {
  const [tempFilters, setTempFilters] = useState(filters);

  return (
    <View className="flex-1 justify-end">
      {/* Backdrop */}
      <Pressable className="flex-1 bg-black/50" onPress={onClose} />

      {/* Bottom Sheet Content */}
      <View
        style={{
          height: SCREEN_HEIGHT * 0.75,
          backgroundColor: "white",
        }}
        className="bg-background rounded-t-3xl"
      >
        <SafeAreaView className="flex-1">
          {/* Handle Bar */}
          <View className="items-center py-3">
            <View className="w-10 h-1 bg-muted rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <Button variant="ghost" onPress={onClose}>
              <Text>Cancel</Text>
            </Button>
            <H3>Filters</H3>
            <Button onPress={() => onApply(tempFilters)} variant="default">
              <Text>Apply</Text>
            </Button>
          </View>

          <ScrollView className="flex-1 px-4 py-6">
            {/* Sort By */}
            <View className="mb-6">
              <H3 className="mb-3">Sort By</H3>
              {SORT_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() =>
                    setTempFilters((prev) => ({
                      ...prev,
                      sortBy: option.value,
                    }))
                  }
                  className="flex-row items-center justify-between py-3"
                >
                  <Text>{option.label}</Text>
                  <View
                    className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      tempFilters.sortBy === option.value
                        ? "border-primary"
                        : "border-muted"
                    }`}
                  >
                    {tempFilters.sortBy === option.value && (
                      <View className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </View>
                </Pressable>
              ))}
            </View>

            {/* Price Range */}
            <View className="mb-6">
              <H3 className="mb-3">Price Range</H3>
              <View className="flex-row gap-2">
                {[1, 2, 3, 4].map((price) => (
                  <Pressable
                    key={price}
                    onPress={() => {
                      const isSelected = tempFilters.priceRange.includes(price);
                      setTempFilters((prev) => ({
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

            {/* Rating Filter */}
            <View className="mb-6">
              <H3 className="mb-3">Minimum Rating</H3>
              <View className="flex-row gap-2">
                {[0, 3, 4, 4.5].map((rating) => (
                  <Pressable
                    key={rating}
                    onPress={() =>
                      setTempFilters((prev) => ({ ...prev, rating }))
                    }
                    className={`px-4 py-2 rounded-lg border ${
                      tempFilters.rating === rating
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        tempFilters.rating === rating
                          ? "text-primary-foreground"
                          : "text-foreground"
                      }
                    >
                      {rating === 0 ? "Any" : `${rating}+ ⭐`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Open Now Toggle */}
            <View className="flex-row items-center justify-between">
              <H3>Open Now</H3>
              <Pressable
                onPress={() =>
                  setTempFilters((prev) => ({
                    ...prev,
                    openNow: !prev.openNow,
                  }))
                }
                className={`w-12 h-6 rounded-full p-1 ${
                  tempFilters.openNow ? "bg-primary" : "bg-muted"
                }`}
              >
                <View
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    tempFilters.openNow ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </View>
  );
}
