// app/(protected)/playlist/add-restaurants.tsx
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Search,
  Check,
  Plus,
  Heart,
  SlidersHorizontal,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { SafeAreaView } from "@/components/safe-area-view";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { H3, Muted } from "@/components/ui/typography";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { useColorScheme } from "@/lib/useColorScheme";
import { useAuth } from "@/context/supabase-provider";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { usePlaylistItems } from "@/hooks/usePlaylistItems";
import { useFavorites } from "@/hooks/useFavorites";
import { AddRestaurantSkeleton } from "@/components/skeletons/AddRestaurantSkeleton";
import { OptimizedList } from "@/components/ui/optimized-list";
import { NavigationHeader } from "@/components/ui/navigation-header";
import { cn } from "@/lib/utils";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

type AddRestaurantsParams = {
  playlistId: string;
};

export default function AddRestaurantsScreen() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const { profile } = useAuth();
  const { playlistId } = useLocalSearchParams<AddRestaurantsParams>();

  const [searchQuery, setSearchQuery] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(
    new Set(),
  );
  const [addingRestaurants, setAddingRestaurants] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "name" | "distance">(
    "rating",
  );
  const [showSortOptions, setShowSortOptions] = useState(false);

  const { addRestaurant, isRestaurantInPlaylist } =
    usePlaylistItems(playlistId);
  const { favorites } = useFavorites();

  // Fetch restaurants (favorites + search)
  const fetchRestaurants = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase.from("restaurants").select("*");

      if (searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${searchQuery}%,cuisine_type.ilike.%${searchQuery}%`,
        );
      } else {
        // Show favorites first when no search
        const favoriteIds = favorites.map((f) => f.restaurant_id);
        if (favoriteIds.length > 0) {
          query = query.in("id", favoriteIds);
        }
      }

      // Apply sorting
      switch (sortBy) {
        case "rating":
          query = query.order("average_rating", { ascending: false });
          break;
        case "name":
          query = query.order("name", { ascending: true });
          break;
        case "distance":
          // For distance, we'll need to calculate it on the client side
          query = query.order("name", { ascending: true }); // fallback to name
          break;
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      setRestaurants(data || []);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      Alert.alert("Error", "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, favorites, sortBy]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // Toggle restaurant selection
  const toggleRestaurantSelection = useCallback((restaurantId: string) => {
    setSelectedRestaurants((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(restaurantId)) {
        newSet.delete(restaurantId);
      } else {
        newSet.add(restaurantId);
      }
      return newSet;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Add selected restaurants to playlist
  const handleAddRestaurants = useCallback(async () => {
    if (selectedRestaurants.size === 0) return;

    setAddingRestaurants(true);
    let successCount = 0;

    try {
      for (const restaurantId of selectedRestaurants) {
        const success = await addRestaurant(restaurantId);
        if (success) successCount++;
      }

      if (successCount > 0) {
        Alert.alert(
          "Success",
          `Added ${successCount} restaurant${successCount > 1 ? "s" : ""} to playlist`,
          [{ text: "OK", onPress: () => router.back() }],
        );
      }
    } catch (error) {
      console.error("Error adding restaurants:", error);
      Alert.alert("Error", "Failed to add some restaurants");
    } finally {
      setAddingRestaurants(false);
    }
  }, [selectedRestaurants, addRestaurant, router]);

  // Render restaurant item
  const renderRestaurantItem = useCallback(
    ({ item }: { item: Restaurant }) => {
      const isSelected = selectedRestaurants.has(item.id);
      const isAlreadyInPlaylist = isRestaurantInPlaylist(item.id);
      const isFavorite = favorites.some((f) => f.restaurant_id === item.id);

      const handlePress = () => {
        if (!isAlreadyInPlaylist) {
          toggleRestaurantSelection(item.id);
        }
      };

      return (
        <Pressable
          onPress={handlePress}
          disabled={isAlreadyInPlaylist}
          className={cn(
            "mb-3 relative rounded-lg overflow-hidden",
            isAlreadyInPlaylist && "opacity-50",
            isSelected
              ? "border-2 border-primary"
              : "border-2 border-transparent",
            "active:scale-[0.98] transition-all duration-200",
          )}
        >
          <RestaurantSearchCard
            restaurant={item}
            variant="compact"
            showActions={false}
            disabled
            className={cn("border-0 shadow-none", isSelected && "bg-primary/5")}
          />

          {/* Selection indicator */}
          <View className="absolute top-3 right-3">
            {isAlreadyInPlaylist ? (
              <View className="bg-gray-500 rounded-full p-1.5">
                <Check size={14} color="#fff" />
              </View>
            ) : isSelected ? (
              <View className="bg-primary rounded-full p-1.5">
                <Check size={14} color="#fff" />
              </View>
            ) : (
              <View className="bg-gray-200 dark:bg-gray-700 rounded-full p-1.5">
                <Plus
                  size={14}
                  color={colorScheme === "dark" ? "#fff" : "#000"}
                />
              </View>
            )}
          </View>

          {/* Favorite indicator */}
          {isFavorite && (
            <View className="absolute top-3 left-3">
              <Heart size={14} color="#dc2626" fill="#dc2626" />
            </View>
          )}
        </Pressable>
      );
    },
    [
      selectedRestaurants,
      isRestaurantInPlaylist,
      favorites,
      toggleRestaurantSelection,
      colorScheme,
    ],
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <NavigationHeader title="Add to Playlist" onBack={() => router.back()} />

      {/* Search Bar */}
      <View className="px-4 py-3 border-b border-border bg-background">
        <View className="flex-row items-center gap-3">
          {/* Search Input */}
          <View className="flex-1 flex-row items-center bg-muted rounded-lg px-3 py-2">
            <Search
              size={18}
              color={colorScheme === "dark" ? "#9ca3af" : "#6b7280"}
            />
            <TextInput
              placeholder="Search restaurants..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="flex-1 ml-2 text-base text-foreground"
              placeholderTextColor={
                colorScheme === "dark" ? "#9ca3af" : "#6b7280"
              }
            />
          </View>

          {/* Sort Button */}
          <Pressable
            onPress={() => setShowSortOptions(!showSortOptions)}
            className={cn(
              "p-2 rounded-lg border",
              showSortOptions
                ? "bg-primary border-primary"
                : "bg-background border-border",
            )}
          >
            <SlidersHorizontal
              size={18}
              color={
                showSortOptions
                  ? "#fff"
                  : colorScheme === "dark"
                    ? "#fff"
                    : "#000"
              }
            />
          </Pressable>
        </View>

        {/* Sort Options */}
        {showSortOptions && (
          <View className="mt-3 p-3 bg-card border border-border rounded-lg">
            <Text className="text-sm font-medium text-foreground mb-2">
              Sort by:
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setSortBy("rating");
                  setShowSortOptions(false);
                }}
                className={cn(
                  "px-3 py-2 rounded-lg border",
                  sortBy === "rating"
                    ? "bg-primary border-primary"
                    : "bg-background border-border",
                )}
              >
                <Text
                  className={cn(
                    "text-sm",
                    sortBy === "rating"
                      ? "text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  Rating
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSortBy("name");
                  setShowSortOptions(false);
                }}
                className={cn(
                  "px-3 py-2 rounded-lg border",
                  sortBy === "name"
                    ? "bg-primary border-primary"
                    : "bg-background border-border",
                )}
              >
                <Text
                  className={cn(
                    "text-sm",
                    sortBy === "name"
                      ? "text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  Name
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Restaurant List */}
      {loading ? (
        <AddRestaurantSkeleton />
      ) : restaurants.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Search size={48} color="#6b7280" className="mb-4" />
          <H3 className="text-center mb-2">No restaurants found</H3>
          <Muted className="text-center">
            Try searching with different keywords
          </Muted>
        </View>
      ) : (
        <OptimizedList
          data={restaurants}
          renderItem={renderRestaurantItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        />
      )}

      {/* Info Banner */}
      {!searchQuery && favorites.length > 0 && (
        <View className="absolute top-32 left-4 right-4 bg-blue-100 dark:bg-blue-900 rounded-lg p-3">
          <Text className="text-blue-700 dark:text-blue-300 text-sm">
            💡 Showing your favorite restaurants. Use search to find more!
          </Text>
        </View>
      )}

      {/* Bottom Action Bar */}
      <View className="p-4 border-t border-border bg-background">
        <Button
          onPress={handleAddRestaurants}
          disabled={addingRestaurants || selectedRestaurants.size === 0}
          className="w-full rounded-lg"
        >
          {addingRestaurants ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-white">
              Add{" "}
              {selectedRestaurants.size > 0
                ? `${selectedRestaurants.size} Restaurant${selectedRestaurants.size > 1 ? "s" : ""}`
                : "Restaurants"}
            </Text>
          )}
        </Button>
      </View>
    </SafeAreaView>
  );
}
