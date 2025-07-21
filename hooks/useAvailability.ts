// hooks/useAvailability.ts
import { useState, useEffect, useCallback } from "react";
import { AvailabilityService, TimeSlot } from "@/lib/AvailabilityService";
import { realtimeAvailability } from "@/lib/RealtimeAvailability";
import { calculateBookingWindow } from "@/lib/tableManagementUtils";
import { useAuth } from "@/context/supabase-provider";

interface UseAvailabilityOptions {
  restaurantId: string;
  date: Date;
  partySize: number;
  enableRealtime?: boolean;
}

export function useAvailability({
  restaurantId,
  date,
  partySize,
  enableRealtime = true,
}: UseAvailabilityOptions) {
  const { profile } = useAuth();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availabilityService = AvailabilityService.getInstance();

  // Fetch availability
  const fetchAvailability = useCallback(async () => {
    if (!restaurantId) return;

    setLoading(true);
    setError(null);

    try {
      const availableSlots = await availabilityService.getAvailableSlots(
        restaurantId,
        date,
        partySize,
        profile?.id
      );

      setSlots(availableSlots);
    } catch (err) {
      console.error("Error fetching availability:", err);
      setError("Failed to load available times");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, date, partySize, profile?.id, availabilityService]);

  // Initial fetch
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Real-time updates
  useEffect(() => {
    if (!enableRealtime || !restaurantId) return;

    const unsubscribe = realtimeAvailability.subscribeToRestaurant(
      restaurantId,
      () => {
        console.log("Availability update received, refreshing...");
        fetchAvailability();
      }
    );

    return unsubscribe;
  }, [restaurantId, enableRealtime, fetchAvailability]);

  return {
    slots,
    loading,
    error,
    refresh: fetchAvailability,
  };
}

// Hook for checking single slot availability (useful for booking confirmation)
export function useSlotAvailability(
  restaurantId: string,
  date: Date,
  time: string,
  partySize: number,
  tableIds: string[]
) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const checkAvailability = useCallback(async () => {
    if (!restaurantId || !time || tableIds.length === 0) return;

    setChecking(true);

    try {
      const availabilityService = AvailabilityService.getInstance();
      const { startTime, endTime } = await calculateBookingWindow(
        restaurantId,
        date,
        time,
        partySize
      );

      const available = await availabilityService.areTablesAvailable(
        tableIds,
        startTime,
        endTime
      );

      setIsAvailable(available);
    } catch (error) {
      console.error("Error checking slot availability:", error);
      setIsAvailable(false);
    } finally {
      setChecking(false);
    }
  }, [restaurantId, date, time, partySize, tableIds]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  return {
    isAvailable,
    checking,
    refresh: checkAvailability,
  };
}