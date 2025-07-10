// components/search/SearchContent.tsx - Updated to use RestaurantMap
import React, { useRef } from "react";
import {
  View,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Region } from "react-native-maps";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Muted } from "@/components/ui/typography";
import { RestaurantSearchCard } from "./RestaurantSearchCard";
import SearchScreenSkeleton from "../skeletons/SearchScreenSkeleton";
import { RestaurantMap } from "../maps/RestaurantMap";
import { useLocationWithDistance } from "@/hooks/useLocationWithDistance";
import type { Restaurant, ViewMode, BookingFilters } from "@/types/search";

interface SearchContentProps {
  viewMode: ViewMode;
  restaurants: Restaurant[];
  favorites: Set<string>;
  loading: boolean;
  refreshing: boolean;
  bookingFilters: BookingFilters;
  colorScheme: "light" | "dark" | null | undefined;
  mapRegion: Region;
  onToggleFavorite: (restaurantId: string) => Promise<void>;
  onDirections: (restaurant: Restaurant) => Promise<void>;
  onRestaurantPress: (restaurantId: string) => void;
  onRefresh: () => void;
  onClearFilters: () => void;
  onMapRegionChange: (region: Region) => void;
}

export const SearchContent = React.memo(
  ({
    viewMode,
    restaurants,
    favorites,
    loading,
    refreshing,
    bookingFilters,
    colorScheme,
    mapRegion,
    onToggleFavorite,
    onDirections,
    onRestaurantPress,
    onRefresh,
    onClearFilters,
    onMapRegionChange,
  }: SearchContentProps) => {
    const listRef = useRef<FlatList>(null);
    const { location: userLocation } = useLocationWithDistance();



    if (viewMode === "list") {
      return (
        <FlatList
          ref={listRef}
          data={restaurants}
          renderItem={({ item }) => (
            <RestaurantSearchCard
              item={item}
              bookingFilters={bookingFilters}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
              onDirections={onDirections}
              onPress={() => onRestaurantPress(item.id)}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
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
                onPress={onClearFilters}
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
      );
    }
    if (loading && restaurants.length === 0) {
      return <SearchScreenSkeleton />;
    }
    return (
      <RestaurantMap
        restaurants={restaurants.map(restaurant => ({
          ...restaurant,
          // Ensure coordinates are in the right format for RestaurantMap
          coordinates: restaurant.staticCoordinates ? {
            latitude: restaurant.staticCoordinates.lat,
            longitude: restaurant.staticCoordinates.lng
          } : restaurant.coordinates || undefined
        }))}
        userLocation={userLocation}
        onRestaurantPress={onRestaurantPress}
        showUserLocation={true}
        initialRegion={mapRegion}
        style={{ flex: 1 }}
      />
    );
  }
);