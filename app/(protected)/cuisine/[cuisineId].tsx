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
import { RestaurantCard } from "@/components/home/RestaurantCard";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

// Type Definitions
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type CuisineCategory = {
  id: string;
  name: string;
  image: any;
  description?: string;
  color?: string;
};

interface CuisineScreenParams {
  cuisineId: string;
  cuisineName?: string;
}

interface FilterOptions {
  priceRange: number[];
  rating: number;
  distance: number;
  sortBy: "rating" | "distance" | "name" | "price";
  openNow: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const SORT_OPTIONS = [
  { value: "rating", label: "Highest Rated" },
  { value: "distance", label: "Nearest" },
  { value: "name", label: "Name (A-Z)" },
  { value: "price", label: "Price (Low to High)" },
] as const;

export default function CuisineScreen() {
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { cuisineId, cuisineName } = useLocalSearchParams<CuisineScreenParams>();

  // State Management
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    priceRange: [1, 2, 3, 4],
    rating: 0,
    distance: 50,
    sortBy: "rating",
    openNow: false,
  });

  // Cuisine Data Loading
  const fetchCuisineRestaurants = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("restaurants")
        .select(`
          *,
          operating_hours (*)
        `)
        .eq("cuisine_type", cuisineId)
        .eq("is_active", true);

      // Apply filters
      if (filters.rating > 0) {
        query = query.gte("average_rating", filters.rating);
      }

      if (filters.priceRange.length < 4) {
        query = query.in("price_range", filters.priceRange);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching cuisine restaurants:", error);
        return;
      }

      let processedRestaurants = data || [];

      // Apply client-side filtering for open now
      if (filters.openNow) {
        processedRestaurants = processedRestaurants.filter(isRestaurantOpen);
      }

      // Sort restaurants
      processedRestaurants.sort(getSortComparator(filters.sortBy));

      setRestaurants(processedRestaurants);
    } catch (error) {
      console.error("Error in fetchCuisineRestaurants:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cuisineId, filters]);

  // Utility Functions
  const isRestaurantOpen = (restaurant: Restaurant): boolean => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 100 + now.getMinutes();

    // Simplified check - you'll need to implement based on your operating_hours structure
    return true; // Placeholder implementation
  };

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
          // Placeholder - implement distance calculation
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

  const handleRestaurantPress = useCallback((restaurant: Restaurant) => {
    router.push(`/(protected)/restaurant/${restaurant.id}`);
  }, [router]);

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
      avgRating: restaurants.length > 0 
        ? restaurants.reduce((sum, r) => sum + (r.average_rating || 0), 0) / restaurants.length
        : 0,
      priceRange: restaurants.length > 0 
        ? Math.round(restaurants.reduce((sum, r) => sum + r.price_range, 0) / restaurants.length)
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
            <ArrowLeft size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
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
          <SlidersHorizontal size={20} color={colorScheme === "dark" ? "#fff" : "#000"} />
        </Pressable>
      </View>

      {/* Stats Bar */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-muted/30">
        <View className="flex-row items-center gap-4">
          <View className="flex-row items-center gap-1">
            <Star size={16} color="#f59e0b" fill="#f59e0b" />
            <Text className="text-sm font-medium">{stats.avgRating.toFixed(1)}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm font-medium">
              {"$".repeat(stats.priceRange)} avg
            </Text>
          </View>
          {filters.openNow && (
            <View className="flex-row items-center gap-1">
              <Clock size={16} color="#10b981" />
              <Text className="text-sm text-green-600 font-medium">Open Now</Text>
            </View>
          )}
        </View>
        
        <Text className="text-sm text-muted-foreground">
          Sorted by {SORT_OPTIONS.find(opt => opt.value === filters.sortBy)?.label}
        </Text>
      </View>

      {/* Restaurant List */}
      <FlatList
        data={restaurants}
        renderItem={({ item }) => (
          <View className="px-4 mb-3">
            <RestaurantCard
              item={item}
              variant="detailed"
              onPress={handleRestaurantPress}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingVertical: 16 }}
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
            <Muted className="mt-2 text-center">
              Try adjusting your filters or check back later
            </Muted>
            <Button
              variant="outline"
              onPress={() => setFilters({
                priceRange: [1, 2, 3, 4],
                rating: 0,
                distance: 50,
                sortBy: "rating",
                openNow: false,
              })}
              className="mt-4"
            >
              <Text>Clear Filters</Text>
            </Button>
          </View>
        }
      />

      {/* Filter Modal - Implementation would go here */}
      {showFilters && (
        <FilterModal
          filters={filters}
          onApply={applyFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </SafeAreaView>
  );
}

// Filter Modal Component (Simplified)
function FilterModal({
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
    <View className="absolute inset-0 bg-background z-50">
      <SafeAreaView className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Button variant="ghost" onPress={onClose}>
            <Text>Cancel</Text>
          </Button>
          <H3>Filters</H3>
          <Button
            onPress={() => onApply(tempFilters)}
            variant="default"
          >
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
                onPress={() => setTempFilters(prev => ({ ...prev, sortBy: option.value }))}
                className="flex-row items-center justify-between py-3"
              >
                <Text>{option.label}</Text>
                <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  tempFilters.sortBy === option.value ? "border-primary" : "border-muted"
                }`}>
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
                    setTempFilters(prev => ({
                      ...prev,
                      priceRange: isSelected
                        ? prev.priceRange.filter(p => p !== price)
                        : [...prev.priceRange, price]
                    }));
                  }}
                  className={`px-4 py-2 rounded-lg border ${
                    tempFilters.priceRange.includes(price)
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text className={
                    tempFilters.priceRange.includes(price)
                      ? "text-primary-foreground"
                      : "text-foreground"
                  }>
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
                  onPress={() => setTempFilters(prev => ({ ...prev, rating }))}
                  className={`px-4 py-2 rounded-lg border ${
                    tempFilters.rating === rating
                      ? "bg-primary border-primary"
                      : "bg-background border-border"
                  }`}
                >
                  <Text className={
                    tempFilters.rating === rating
                      ? "text-primary-foreground"
                      : "text-foreground"
                  }>
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
              onPress={() => setTempFilters(prev => ({ ...prev, openNow: !prev.openNow }))}
              className={`w-12 h-6 rounded-full p-1 ${
                tempFilters.openNow ? "bg-primary" : "bg-muted"
              }`}
            >
              <View className={`w-4 h-4 rounded-full bg-white transition-transform ${
                tempFilters.openNow ? "translate-x-6" : "translate-x-0"
              }`} />
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}