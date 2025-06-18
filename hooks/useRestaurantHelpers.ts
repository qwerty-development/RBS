import { useCallback } from "react";
import { Platform, Linking, Alert } from "react-native";

interface LocationCoordinate {
  latitude: number;
  longitude: number;
}

interface Restaurant {
  name: string;
  opening_time: string;
  closing_time: string;
  location?: any;
  phone_number?: string | null;
  whatsapp_number?: string | null;
}

export const useRestaurantHelpers = () => {
  const extractLocationCoordinates = useCallback(
    (location: any): LocationCoordinate | null => {
      if (!location) {
        return null;
      }

      if (typeof location === "string" && location.startsWith("POINT(")) {
        const coords = location.match(/POINT\(([^)]+)\)/);
        if (coords && coords[1]) {
          const [lng, lat] = coords[1].split(" ").map(Number);
          return { latitude: lat, longitude: lng };
        }
      }

      if (location.type === "Point" && Array.isArray(location.coordinates)) {
        const [lng, lat] = location.coordinates;
        return { latitude: lat, longitude: lng };
      }

      if (Array.isArray(location) && location.length >= 2) {
        const [lng, lat] = location;
        return { latitude: lat, longitude: lng };
      }

      if (location.lat && location.lng) {
        return { latitude: location.lat, longitude: location.lng };
      }

      if (location.latitude && location.longitude) {
        return { latitude: location.latitude, longitude: location.longitude };
      }

      console.warn("Unable to parse location:", location);
      return null;
    },
    []
  );

  const isRestaurantOpen = useCallback((restaurant: Restaurant): boolean => {
    if (!restaurant) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMinute] = restaurant.opening_time
      .split(":")
      .map(Number);
    const [closeHour, closeMinute] = restaurant.closing_time
      .split(":")
      .map(Number);
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;

    return currentTime >= openTime && currentTime <= closeTime;
  }, []);

  const getDistanceText = useCallback((distance: number): string => {
    if (distance < 1) return `${(distance * 1000).toFixed(0)}m`;
    return `${distance.toFixed(1)}km`;
  }, []);

  const handleCall = useCallback((restaurant: Restaurant) => {
    if (!restaurant?.phone_number) return;
    Linking.openURL(`tel:${restaurant.phone_number}`);
  }, []);

  const handleWhatsApp = useCallback((restaurant: Restaurant) => {
    if (!restaurant?.whatsapp_number) return;
    const message = encodeURIComponent(
      `Hi! I'd like to inquire about making a reservation at ${restaurant.name}.`
    );
    Linking.openURL(
      `whatsapp://send?phone=${restaurant.whatsapp_number}&text=${message}`
    );
  }, []);

  const openDirections = useCallback(
    (restaurant: Restaurant) => {
      if (!restaurant?.location) {
        Alert.alert("Error", "Location data not available");
        return;
      }

      const coords = extractLocationCoordinates(restaurant.location);

      if (!coords) {
        Alert.alert("Error", "Unable to parse location coordinates");
        return;
      }

      const { latitude, longitude } = coords;

      const scheme = Platform.select({
        ios: "maps:0,0?q=",
        android: "geo:0,0?q=",
      });

      const latLng = `${latitude},${longitude}`;
      const label = encodeURIComponent(restaurant.name);
      const url = Platform.select({
        ios: `${scheme}${label}@${latLng}`,
        android: `${scheme}${latLng}(${label})`,
      });

      if (url) {
        Linking.openURL(url).catch((err) => {
          console.error("Error opening maps:", err);
          Alert.alert("Error", "Unable to open maps application");
        });
      }
    },
    [extractLocationCoordinates]
  );

  const generateTimeSlots = useCallback(
    (openTime: string, closeTime: string, intervalMinutes: number = 30) => {
      const slots: { time: string }[] = [];

      try {
        const [openHour, openMinute] = openTime.split(":").map(Number);
        const [closeHour, closeMinute] = closeTime.split(":").map(Number);

        let currentHour = openHour;
        let currentMinute = openMinute;

        let maxIterations = 50;
        let iterations = 0;

        while (
          (currentHour < closeHour ||
            (currentHour === closeHour && currentMinute < closeMinute)) &&
          iterations < maxIterations
        ) {
          slots.push({
            time: `${currentHour.toString().padStart(2, "0")}:${currentMinute
              .toString()
              .padStart(2, "0")}`,
          });

          currentMinute += intervalMinutes;
          while (currentMinute >= 60) {
            currentHour++;
            currentMinute -= 60;
          }

          iterations++;
        }

        console.log(
          `Generated ${slots.length} time slots from ${openTime} to ${closeTime}`
        );
        return slots;
      } catch (error) {
        console.error("Error generating time slots:", error);
        return [
          { time: "18:00" },
          { time: "18:30" },
          { time: "19:00" },
          { time: "19:30" },
          { time: "20:00" },
          { time: "20:30" },
          { time: "21:00" },
          { time: "21:30" },
        ];
      }
    },
    []
  );

  return {
    extractLocationCoordinates,
    isRestaurantOpen,
    getDistanceText,
    handleCall,
    handleWhatsApp,
    openDirections,
    generateTimeSlots,
  };
};
