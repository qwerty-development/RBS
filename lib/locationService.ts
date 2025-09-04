// lib/locationService.ts - Enhanced version with minor improvements
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/config/supabase";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationData extends LocationCoordinates {
  city: string;
  district: string;
  country: string;
}

const STORAGE_KEY = "@user_location";
const DEFAULT_LOCATION: LocationData = {
  latitude: 33.8938,
  longitude: 35.5018,
  city: "Beirut",
  district: "Central District",
  country: "Lebanon",
};

// Lebanon geographical bounds for validation
const LEBANON_BOUNDS = {
  north: 34.691,
  south: 33.039,
  east: 36.625,
  west: 35.099,
};

export class LocationService {
  // Validate if coordinates are within Lebanon (optional validation)
  static isInLebanon(coords: LocationCoordinates): boolean {
    return (
      coords.latitude >= LEBANON_BOUNDS.south &&
      coords.latitude <= LEBANON_BOUNDS.north &&
      coords.longitude >= LEBANON_BOUNDS.west &&
      coords.longitude <= LEBANON_BOUNDS.east
    );
  }

  // Enhanced coordinate validation
  static isValidCoordinate(lat: number, lng: number): boolean {
    return (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      // Ensure they're not exactly 0,0 (likely invalid)
      !(lat === 0 && lng === 0)
    );
  }

  // Extract coordinates from PostGIS WKB or WKT format
  static extractCoordinates(location: any): LocationCoordinates | null {
    if (!location) {
      return null;
    }

    console.log("🔍 Extracting coordinates from:", typeof location, location);

    // Handle PostGIS WKT POINT format: "POINT(longitude latitude)"
    if (typeof location === "string" && location.includes("POINT")) {
      console.log("📍 Detected WKT POINT format");
      const match = location.match(/POINT\s*\(\s*([^)]+)\s*\)/i);
      if (match && match[1]) {
        const coords = match[1].trim().split(/\s+/);
        if (coords.length >= 2) {
          const lng = parseFloat(coords[0]);
          const lat = parseFloat(coords[1]);
          if (LocationService.isValidCoordinate(lat, lng)) {
            const result = { latitude: lat, longitude: lng };
            console.log("✅ Extracted WKT coordinates:", result);
            return result;
          }
        }
      }
    }

    // Handle PostGIS WKB hex format
    if (typeof location === "string" && location.match(/^0101000020/)) {
      console.log("📍 Detected WKB hex format");
      const coords = LocationService.parseWKB(location);
      if (coords) {
        console.log("✅ Extracted WKB coordinates:", coords);
        return coords;
      }
    }

    // Handle GeoJSON Point
    if (
      typeof location === "object" &&
      location?.type === "Point" &&
      Array.isArray(location.coordinates)
    ) {
      console.log("📍 Detected GeoJSON Point");
      const [lng, lat] = location.coordinates;
      if (LocationService.isValidCoordinate(lat, lng)) {
        const result = { latitude: lat, longitude: lng };
        console.log("✅ Extracted GeoJSON coordinates:", result);
        return result;
      }
    }

    // Handle direct coordinate objects
    if (typeof location === "object") {
      let lat, lng;

      // Try lat/lng format
      if (location.lat !== undefined && location.lng !== undefined) {
        lat = Number(location.lat);
        lng = Number(location.lng);
      }
      // Try latitude/longitude format
      else if (
        location.latitude !== undefined &&
        location.longitude !== undefined
      ) {
        lat = Number(location.latitude);
        lng = Number(location.longitude);
      }

      if (
        lat !== undefined &&
        lng !== undefined &&
        LocationService.isValidCoordinate(lat, lng)
      ) {
        const result = { latitude: lat, longitude: lng };
        console.log("✅ Extracted object coordinates:", result);
        return result;
      }
    }

    console.log("❌ Could not extract coordinates from location:", location);
    return null;
  }

  // Parse PostGIS WKB format with improved error handling
  static parseWKB(wkb: string): LocationCoordinates | null {
    try {
      const hex = wkb.replace(/^0x/i, "");

      if (hex.length < 42) {
        console.log("❌ WKB hex too short:", hex.length);
        return null;
      }

      // For POINT with SRID, coordinates start at position 18 (after header)
      const coordsHex = hex.substring(18);

      if (coordsHex.length < 32) {
        console.log("❌ Not enough coordinate data");
        return null;
      }

      // Extract X (longitude) and Y (latitude) - each is 16 hex chars (8 bytes)
      const xHex = coordsHex.substring(0, 16);
      const yHex = coordsHex.substring(16, 32);

      const longitude = LocationService.hexToFloat64LE(xHex);
      const latitude = LocationService.hexToFloat64LE(yHex);

      // Enhanced validation
      if (!LocationService.isValidCoordinate(latitude, longitude)) {
        console.log("❌ Invalid parsed coordinates:", { latitude, longitude });
        return null;
      }

      return { latitude, longitude };
    } catch (error) {
      console.error("❌ WKB parsing error:", error);
      return null;
    }
  }

  // Convert hex string to IEEE 754 double (little endian)
  static hexToFloat64LE(hex: string): number {
    if (hex.length !== 16) return NaN;

    try {
      const bytes = new ArrayBuffer(8);
      const view = new DataView(bytes);

      // Parse as little endian
      for (let i = 0; i < 8; i++) {
        const byte = parseInt(hex.substr(i * 2, 2), 16);
        view.setUint8(i, byte);
      }

      return view.getFloat64(0, true); // true = little endian
    } catch {
      return NaN;
    }
  }

  // Calculate distance using Haversine formula
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Get restaurants with distance - robust method with fallbacks and retry logic
  static async getRestaurantsWithDistance(
    userLocation: LocationCoordinates,
    maxDistance?: number,
    retryCount: number = 0,
  ): Promise<any[]> {
    console.log("🍽️ Getting restaurants with distance from:", userLocation);

    try {
      // First try: PostGIS ST_X and ST_Y functions
      console.log("🔄 Method 1: Using PostGIS ST_X/ST_Y functions");

      const { data: restaurants, error } = await supabase
        .from("restaurants")
        .select(
          `
          *,
          longitude:ST_X(location::geometry),
          latitude:ST_Y(location::geometry)
        `,
        )
        .order("featured", { ascending: false })
        .order("average_rating", { ascending: false });

      if (error) {
        console.warn("⚠️ PostGIS method failed:", error.message);

        // Retry once if it's a temporary error
        if (
          retryCount === 0 &&
          (error.message.includes("timeout") ||
            error.message.includes("connection"))
        ) {
          console.log("🔄 Retrying PostGIS method...");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
          return LocationService.getRestaurantsWithDistance(
            userLocation,
            maxDistance,
            1,
          );
        }

        return LocationService.fallbackMethod(userLocation, maxDistance);
      }

      console.log(
        `📊 Got ${restaurants?.length || 0} restaurants from PostGIS method`,
      );

      const processedRestaurants =
        restaurants?.map((restaurant, index) => {
          console.log(
            `🔍 Processing restaurant ${index + 1}: ${restaurant.name}`,
          );

          let coords: LocationCoordinates | null = null;

          // Use PostGIS extracted coordinates if valid
          if (
            restaurant.latitude &&
            restaurant.longitude &&
            LocationService.isValidCoordinate(
              restaurant.latitude,
              restaurant.longitude,
            )
          ) {
            coords = {
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
            };
            console.log("✅ Using PostGIS coordinates:", coords);
          } else {
            // Fallback to manual extraction
            console.log("📍 PostGIS failed, trying manual extraction...");
            coords = LocationService.extractCoordinates(restaurant.location);
            if (coords) {
              console.log("✅ Manual extraction successful:", coords);
            } else {
              console.log("❌ No coordinates found for:", restaurant.name);
            }
          }

          const distance = coords
            ? LocationService.calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                coords.latitude,
                coords.longitude,
              )
            : null;

          if (distance !== null) {
            console.log(
              `📏 Distance to ${restaurant.name}: ${distance.toFixed(2)}km`,
            );
          }

          // Clean up temporary fields
          const { latitude, longitude, ...cleanRestaurant } = restaurant;

          return {
            ...cleanRestaurant,
            distance,
            coordinates: coords,
          };
        }) || [];

      return LocationService.filterAndSortRestaurants(
        processedRestaurants,
        userLocation,
        maxDistance,
      );
    } catch (error) {
      console.error("❌ Error in main method:", error);

      // Retry once on unexpected errors
      if (retryCount === 0) {
        console.log("🔄 Retrying after unexpected error...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return LocationService.getRestaurantsWithDistance(
          userLocation,
          maxDistance,
          1,
        );
      }

      return LocationService.fallbackMethod(userLocation, maxDistance);
    }
  }

  // Fallback method using raw location field
  static async fallbackMethod(
    userLocation: LocationCoordinates,
    maxDistance?: number,
  ) {
    console.log("🔄 Using fallback method with raw location parsing");

    try {
      const { data: restaurants, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("featured", { ascending: false })
        .order("average_rating", { ascending: false });

      if (error) throw error;

      console.log(`📊 Fallback: Got ${restaurants?.length || 0} restaurants`);

      const processedRestaurants =
        restaurants?.map((restaurant, index) => {
          console.log(
            `🔍 Fallback processing restaurant ${index + 1}: ${restaurant.name}`,
          );

          const coords = LocationService.extractCoordinates(
            restaurant.location,
          );

          const distance = coords
            ? LocationService.calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                coords.latitude,
                coords.longitude,
              )
            : null;

          if (distance !== null) {
            console.log(
              `📏 Distance to ${restaurant.name}: ${distance.toFixed(2)}km`,
            );
          }

          return {
            ...restaurant,
            distance,
            coordinates: coords,
          };
        }) || [];

      return LocationService.filterAndSortRestaurants(
        processedRestaurants,
        userLocation,
        maxDistance,
      );
    } catch (error) {
      console.error("❌ Fallback method failed:", error);
      return [];
    }
  }

  // Filter and sort restaurants with enhanced logging
  static filterAndSortRestaurants(
    restaurants: any[],
    userLocation: LocationCoordinates,
    maxDistance?: number,
  ) {
    console.log(`🔍 Filtering and sorting ${restaurants.length} restaurants`);

    // Filter out restaurants without coordinates
    let validRestaurants = restaurants.filter((r) => r.coordinates !== null);
    console.log(
      `📍 ${validRestaurants.length} restaurants have valid coordinates`,
    );

    // Log some examples
    if (validRestaurants.length > 0) {
      console.log("📊 Sample valid restaurants:");
      validRestaurants.slice(0, 3).forEach((r, i) => {
        console.log(
          `  ${i + 1}. ${r.name} - ${r.distance?.toFixed(2)}km - coords: ${JSON.stringify(r.coordinates)}`,
        );
      });
    }

    // Apply distance filter if specified
    if (maxDistance && maxDistance > 0) {
      const beforeCount = validRestaurants.length;
      validRestaurants = validRestaurants.filter(
        (r) => r.distance !== null && r.distance <= maxDistance,
      );
      console.log(
        `📏 Distance filter (≤${maxDistance}km): ${beforeCount} → ${validRestaurants.length} restaurants`,
      );
    }

    // Sort by distance, with featured restaurants prioritized
    validRestaurants.sort((a, b) => {
      // Featured restaurants first
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;

      // Then by distance
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    console.log(
      `✅ Final result: ${validRestaurants.length} restaurants ready for display`,
    );
    return validRestaurants;
  }

  // Format distance for display
  static formatDistance(distance: number | null): string {
    if (distance === null || distance === undefined) return "Distance unknown";
    if (distance < 1) return `${Math.round(distance * 1000)}m away`;
    return `${distance.toFixed(1)}km away`;
  }

  // Enhanced location detection with better error handling
  static async getCurrentLocation(): Promise<LocationData> {
    try {
      // Check stored location first
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed.latitude &&
          parsed.longitude &&
          parsed.city &&
          parsed.district
        ) {
          console.log("📍 Using stored location:", parsed);
          return parsed;
        }
      }

      console.log("📍 Getting fresh location...");

      // Request permission with better error messages
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("❌ Location permission denied, using default location");
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(DEFAULT_LOCATION),
        );
        return DEFAULT_LOCATION;
      }

      // Get current position with timeout and accuracy settings
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      console.log("📍 Got GPS position:", {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      // Reverse geocode with timeout
      let locationData: LocationData;
      try {
        const geocodePromise = Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        // Add timeout to reverse geocoding
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Geocoding timeout")), 10000),
        );

        const [address] = (await Promise.race([
          geocodePromise,
          timeoutPromise,
        ])) as any;

        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          city: address.city || address.subregion || "Current Location",
          district:
            address.district ||
            address.street ||
            address.name ||
            "Current Area",
          country: address.country || "Lebanon",
        };

        console.log("📍 Reverse geocoded successfully:", locationData);
      } catch (geocodeError) {
        console.warn("⚠️ Reverse geocoding failed:", geocodeError);
        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          city: "Current Location",
          district: "GPS Location",
          country: "Lebanon",
        };
      }

      // Validate coordinates are reasonable for Lebanon area
      if (!LocationService.isInLebanon(locationData)) {
        console.warn("⚠️ Location outside Lebanon bounds, using default");
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(DEFAULT_LOCATION),
        );
        return DEFAULT_LOCATION;
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(locationData));
      console.log("✅ Successfully got and stored current location");
      return locationData;
    } catch (error) {
      console.error("❌ Error getting location:", error);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LOCATION));
      return DEFAULT_LOCATION;
    }
  }

  // Update stored location
  static async updateLocation(location: LocationData): Promise<void> {
    console.log("💾 Updating stored location:", location);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  }

  // Clear stored location
  static async clearLocation(): Promise<void> {
    console.log("🗑️ Clearing stored location");
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  // Get location display name
  static getLocationDisplayName(location: LocationData | null): string {
    if (!location) return "Select location";
    if (
      location.district &&
      location.city &&
      location.district !== location.city
    ) {
      return `${location.district}, ${location.city}`;
    }
    return location.city || "Current Location";
  }

  // Convert coordinates to PostGIS format
  static toPostGISFormat(lat: number, lng: number): string {
    return `POINT(${lng} ${lat})`;
  }
}
