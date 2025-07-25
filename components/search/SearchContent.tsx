// components/search/SearchContent.tsx - Updated with scroll handling
import React from "react";
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
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

  // List view with optimized scroll handling
  return (
    <View className="flex-1">
      <FlatList
        data={restaurants}
        renderItem={renderRestaurantItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: 4, // Minimal top padding for seamless feel
          paddingHorizontal: 16,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={getRefreshControlColor(colorScheme)}
          />
        }
        onScroll={onScroll} // Pass scroll event to parent
        scrollEventThrottle={8} // Higher frequency for smoother response
        getItemLayout={(data, index) => ({
          length: 120, // Approximate height of RestaurantSearchCard
          offset: 120 * index,
          index,
        })}
        removeClippedSubviews={true}
        initialNumToRender={8} // Reduced for better initial performance
        maxToRenderPerBatch={3} // Smaller batches for smoother scrolling
        windowSize={8} // Smaller window size
        updateCellsBatchingPeriod={30} // Faster batching for smoother experience
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 100,
        }}
      />
    </View>
  );
};
