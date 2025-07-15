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
import { ArrowLeft, Search, Check, Plus, Heart } from "lucide-react-native";
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

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

type AddRestaurantsParams = {
  playlistId: string;
};

export default function AddRestaurantsScreen() {
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

  const { addRestaurant, isRestaurantInPlaylist } =
    usePlaylistItems(playlistId);
  const { favorites } = useFavorites();

  // Fetch restaurants (favorites + search)
  const fetchRestaurants = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("restaurants")
        .select("*")
        .order("average_rating", { ascending: false });

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

      const { data, error } = await query.limit(50);

      if (error) throw error;

      setRestaurants(data || []);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      Alert.alert("Error", "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, favorites]);

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

      return (
        <View className="mb-3 relative">
          <RestaurantSearchCard
            restaurant={item}
            onPress={() => {
              if (!isAlreadyInPlaylist) {
                toggleRestaurantSelection(item.id);
              }
            }}
            variant="compact"
            showActions={false}
            disabled={isAlreadyInPlaylist}
            className={
              isAlreadyInPlaylist
                ? "opacity-50"
                : isSelected
                  ? "border-2 border-primary"
                  : ""
            }
          />

          {/* Selection indicator */}
          <View className="absolute top-3 right-3">
            {isAlreadyInPlaylist ? (
              <View className="bg-gray-500 rounded-full p-1">
                <Check size={16} color="#fff" />
              </View>
            ) : isSelected ? (
              <View className="bg-primary rounded-full p-1">
                <Check size={16} color="#fff" />
              </View>
            ) : (
              <View className="bg-gray-200 dark:bg-gray-700 rounded-full p-1">
                <Plus
                  size={16}
                  color={colorScheme === "dark" ? "#fff" : "#000"}
                />
              </View>
            )}
          </View>

          {/* Favorite indicator */}
          {isFavorite && (
            <View className="absolute top-3 left-3">
              <Heart size={16} color="#dc2626" fill="#dc2626" />
            </View>
          )}
        </View>
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
      <View className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Pressable onPress={() => router.back()} className="p-2 -ml-2">
              <ArrowLeft
                size={24}
                color={colorScheme === "dark" ? "#fff" : "#000"}
              />
            </Pressable>

            <H3 className="ml-2">Add to Playlist</H3>
          </View>

          {selectedRestaurants.size > 0 && (
            <Button
              size="sm"
              onPress={handleAddRestaurants}
              disabled={addingRestaurants}
            >
              {addingRestaurants ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white">
                  Add ({selectedRestaurants.size})
                </Text>
              )}
            </Button>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View className="bg-white dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <View className="flex-row items-center bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-2">
          <Search size={20} color="#6b7280" />
          <TextInput
            placeholder="Search restaurants..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
            placeholderTextColor="#6b7280"
          />
        </View>
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
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
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
    </SafeAreaView>
  );
}
