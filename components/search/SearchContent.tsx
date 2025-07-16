// components/search/SearchContent.tsx - Updated with scroll handling
import React from "react";
import { View, FlatList, RefreshControl } from "react-native";
import MapView, { Region, Marker } from "react-native-maps";

import { Restaurant, BookingFilters, ViewMode } from "@/types/search";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { Text } from "@/components/ui/text";
import { ActivityIndicator } from "react-native";

interface SearchContentProps {
  viewMode: ViewMode;
  restaurants: Restaurant[];
  favorites: Set<string>;
  loading: boolean;
  refreshing: boolean;
  bookingFilters: BookingFilters;
  colorScheme: "light" | "dark";
  mapRegion: Region;
  onToggleFavorite: (restaurantId: string) => Promise<void>;
  onDirections: (restaurant: Restaurant) => Promise<void>;
  onRestaurantPress: (restaurantId: string) => void;
  onRefresh: () => void;
  onClearFilters: () => void;
  onMapRegionChange: (region: Region) => void;
  onScroll?: (event: any) => void; // New prop for scroll handling
}

export const SearchContent = ({
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
  onScroll,
}: SearchContentProps) => {
  // Render restaurant item for list view
  const renderRestaurantItem = ({ item }: { item: Restaurant }) => (
    <RestaurantSearchCard
      restaurant={item}
      isFavorite={favorites.has(item.id)}
      onPress={() => onRestaurantPress(item.id)}
      onToggleFavorite={() => onToggleFavorite(item.id)}
      onOpenDirections={() => onDirections(item)}
    />
  );

  // Loading state
  if (loading && restaurants.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={colorScheme === "dark" ? "#fff" : "#000"} />
        <Text className="mt-4 text-muted-foreground">Loading restaurants...</Text>
      </View>
    );
  }

  // Empty state
  if (!loading && restaurants.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-8">
        <Text className="text-lg font-semibold mb-2">No restaurants found</Text>
        <Text className="text-muted-foreground text-center mb-4">
          Try adjusting your search criteria or filters
        </Text>
      </View>
    );
  }

  // Map view
  if (viewMode === "map") {
    return (
      <View className="flex-1">
        <MapView
          style={{ flex: 1 }}
          region={mapRegion}
          onRegionChangeComplete={onMapRegionChange}
          showsUserLocation={true}
          showsMyLocationButton={true}
          mapType="standard"
        >
          {restaurants.map((restaurant) => {
            const latitude = restaurant.coordinates?.latitude || 
                           restaurant.staticCoordinates?.lat || 
                           33.8938; // Default Beirut latitude
            const longitude = restaurant.coordinates?.longitude || 
                            restaurant.staticCoordinates?.lng || 
                            35.5018; // Default Beirut longitude

            return (
              <Marker
                key={restaurant.id}
                coordinate={{ latitude, longitude }}
                onPress={() => onRestaurantPress(restaurant.id)}
                title={restaurant.name}
                description={restaurant.cuisine_type}
              />
            );
          })}
        </MapView>
      </View>
    );
  }

  // List view with scroll handling
  return (
    <View className="flex-1">
      <FlatList
        data={restaurants}
        renderItem={renderRestaurantItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: 8, // Reduced top padding for better push effect
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colorScheme === "dark" ? "#fff" : "#000"}
          />
        }
        onScroll={onScroll} // Pass scroll event to parent
        scrollEventThrottle={16} // Throttle scroll events for better performance
        getItemLayout={(data, index) => ({
          length: 120, // Approximate height of RestaurantSearchCard
          offset: 120 * index,
          index,
        })}
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={10}
      />
    </View>
  );
};