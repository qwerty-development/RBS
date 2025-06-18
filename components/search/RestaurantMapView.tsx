import React, { useMemo, RefObject } from "react";
import { View } from "react-native";
import MapView, {
  Marker,
  Callout,
  Region,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { Star } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Image } from "@/components/image";

type Restaurant = {
  id: string;
  name: string;
  cuisine_type: string;
  main_image_url: string;
  price_range: number;
  average_rating?: number;
  staticCoordinates?: { lat: number; lng: number };
};

interface RestaurantMapViewProps {
  restaurants: Restaurant[];
  mapRegion: Region;
  mapRef?: RefObject<MapView>;
  onRegionChangeComplete: (region: Region) => void;
  onRestaurantPress: (restaurantId: string) => void;
}

export const RestaurantMapView = React.memo(
  ({
    restaurants,
    mapRegion,
    mapRef,
    onRegionChangeComplete,
    onRestaurantPress,
  }: RestaurantMapViewProps) => {
    // Memoize markers to prevent recreation on every render
    const markers = useMemo(() => {
      return restaurants
        .map((restaurant) => {
          if (!restaurant.staticCoordinates) return null;

          return (
            <Marker
              key={`marker-${restaurant.id}`}
              coordinate={{
                latitude: restaurant.staticCoordinates.lat,
                longitude: restaurant.staticCoordinates.lng,
              }}
              title={restaurant.name}
              description={restaurant.cuisine_type}
              onPress={() => onRestaurantPress(restaurant.id)}
            >
              {/* Custom marker with restaurant image */}
              <View className="items-center">
                <View className="bg-white rounded-full p-1 shadow-lg">
                  <Image
                    source={{ uri: restaurant.main_image_url }}
                    className="w-12 h-12 rounded-full"
                    contentFit="cover"
                  />
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
                    borderTopColor: "white",
                    marginTop: -1,
                  }}
                />
              </View>

              <Callout tooltip onPress={() => onRestaurantPress(restaurant.id)}>
                <View className="bg-white p-3 rounded-lg shadow-lg w-48">
                  <Text className="font-semibold text-black">
                    {restaurant.name}
                  </Text>
                  <Text className="text-sm text-gray-600 mb-2">
                    {restaurant.cuisine_type}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {(restaurant.average_rating || 0) > 0 && (
                      <View className="flex-row items-center gap-1">
                        <Star size={12} color="#f59e0b" fill="#f59e0b" />
                        <Text className="text-xs text-black">
                          {restaurant.average_rating?.toFixed(1)}
                        </Text>
                      </View>
                    )}
                    <Text className="text-xs text-black">
                      {"$".repeat(restaurant.price_range)}
                    </Text>
                  </View>
                  <Text className="text-xs text-blue-600 mt-2 font-medium">
                    Tap for details
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })
        .filter(Boolean);
    }, [restaurants, onRestaurantPress]);

    return (
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          provider={PROVIDER_GOOGLE}
          region={mapRegion}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton
          moveOnMarkerPress={false}
          showsCompass={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {markers}
        </MapView>
      </View>
    );
  }
);
