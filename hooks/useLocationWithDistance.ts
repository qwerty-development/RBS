// hooks/useLocationWithDistance.ts - Fixed with better debugging
import { useState, useEffect, useCallback } from "react";
import { LocationService, LocationData } from "@/lib/locationService";
import { EventEmitter } from "@/lib/eventEmitter";

// Create event emitter for location updates
const locationEventEmitter = new EventEmitter();

export function useLocationWithDistance() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getCurrentLocation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const locationData = await LocationService.getCurrentLocation();

      setLocation(locationData);
      // Emit location update event
      locationEventEmitter.emit("locationUpdated", locationData);
    } catch (err) {
      const errorMessage = "Failed to get location";
      console.error("❌ useLocationWithDistance error:", err);
      setError(errorMessage);

      // Set default location as fallback
      const defaultLocation = {
        latitude: 33.8938,
        longitude: 35.5018,
        city: "Beirut",
        district: "Central District",
        country: "Lebanon",
      };

      setLocation(defaultLocation);
      locationEventEmitter.emit("locationUpdated", defaultLocation);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateLocation = useCallback(async (newLocation: LocationData) => {
    setLocation(newLocation);
    await LocationService.updateLocation(newLocation);

    // Emit location update event
    locationEventEmitter.emit("locationUpdated", newLocation);
  }, []);

  const clearLocation = useCallback(async () => {
    await LocationService.clearLocation();
    await getCurrentLocation();
  }, [getCurrentLocation]);

  // Subscribe to location updates from other components
  useEffect(() => {
    const handleLocationUpdate = (newLocation: LocationData) => {
      setLocation(newLocation);
    };

    locationEventEmitter.on("locationUpdated", handleLocationUpdate);

    return () => {
      locationEventEmitter.off("locationUpdated", handleLocationUpdate);
    };
  }, []);

  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  // Debug current state
  useEffect(() => {}, [location, loading, error]);

  return {
    location,
    loading,
    error,
    refresh: getCurrentLocation,
    updateLocation,
    clearLocation,
    calculateDistance: LocationService.calculateDistance,
    formatDistance: LocationService.formatDistance,
    getDisplayName: () => LocationService.getLocationDisplayName(location),
  };
}
