// components/search/SearchContent.tsx - Updated with scroll handling
import React from "react";
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import MapView, { Region, Marker } from "react-native-maps";

import { Restaurant, BookingFilters, ViewMode } from "@/types/search";
import { RestaurantSearchCard } from "@/components/search/RestaurantSearchCard";
import { Text } from "@/components/ui/text";

import { Image } from "@/components/image";
import { Utensils } from "lucide-react-native";
import { getActivityIndicatorColor, getRefreshControlColor } from "@/lib/utils";

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
  // Loading state
  if (loading && restaurants.length === 0) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator
          size="large"
          color={getActivityIndicatorColor(colorScheme)}
        />
        <Text className="mt-4 text-muted-foreground">
          Loading restaurants...
        </Text>
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
            const latitude =
              restaurant.coordinates?.latitude ||
              restaurant.staticCoordinates?.lat ||
              33.8938; // Default Beirut latitude
            const longitude =
              restaurant.coordinates?.longitude ||
              restaurant.staticCoordinates?.lng ||
              35.5018; // Default Beirut longitude

            return (
              <Marker
                key={restaurant.id}
                coordinate={{ latitude, longitude }}
                onPress={() => onRestaurantPress(restaurant.id)}
                title={restaurant.name}
                description={restaurant.cuisine_type}
              >
                {/* Custom marker with restaurant image */}
                <View className="items-center">
                  <View className="bg-slate-200 rounded-full p-1 shadow-lg">
                    {restaurant.main_image_url ? (
                      <Image
                        source={{ uri: restaurant.main_image_url }}
                        className="w-12 h-12 rounded-full"
                        contentFit="cover"
                      />
                    ) : (
                      <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
                        <Utensils size={20} color="white" />
                      </View>
                    )}
                  </View>
                  {/* Small triangle pointer */}
                  <View
                    style={{
                      width: 0,
                      height: 0,
                      backgroundColor: "transparent",
                      borderStyle: "solid",
                      borderLeftWidth: 6,
                      borderRightWidth: 6,
                      borderBottomWidth: 0,
                      borderTopWidth: 8,
                      borderLeftColor: "transparent",
                      borderRightColor: "transparent",
                      borderTopColor: "#ef4444", // Tailwind red-500
                      marginTop: -1,
                    }}
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>
      </View>
    );
  }

  // List view with ScrollView for pull-to-refresh
  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={getRefreshControlColor(colorScheme)}
        />
      }
      onScroll={onScroll}
      scrollEventThrottle={8}
      contentContainerStyle={{
        paddingTop: 4,
        paddingHorizontal: 16,
        paddingBottom: 120,
      }}
    >
      {restaurants.map((restaurant) => (
        <RestaurantSearchCard
          key={restaurant.id}
          restaurant={restaurant}
          isFavorite={favorites.has(restaurant.id)}
          onPress={() => onRestaurantPress(restaurant.id)}
          onToggleFavorite={() => onToggleFavorite(restaurant.id)}
          onOpenDirections={() => onDirections(restaurant)}
        />
      ))}
    </ScrollView>
  );
};
