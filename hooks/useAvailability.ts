// hooks/useAvailability.ts (Updated)
import { useState, useEffect, useCallback } from "react";
import { AvailabilityService, TimeSlotBasic, SlotTableOptions } from "@/lib/AvailabilityService";
import { realtimeAvailability } from "@/lib/RealtimeAvailability";
import { useAuth } from "@/context/supabase-provider";

interface UseAvailabilityOptions {
  restaurantId: string;
  date: Date;
  partySize: number;
  enableRealtime?: boolean;
  mode?: 'time-first' | 'full';
}

interface AvailabilityState {
  // Time slots (first step)
  timeSlots: TimeSlotBasic[];
  timeSlotsLoading: boolean;
  
  // Selected slot details (second step)
  selectedSlotOptions: SlotTableOptions | null;
  selectedTime: string | null;
  slotOptionsLoading: boolean;
  
  // General state
  error: string | null;
}

export function useAvailability({
  restaurantId,
  date,
  partySize,
  enableRealtime = true,
  mode = 'time-first'
}: UseAvailabilityOptions) {
  const { profile } = useAuth();
  const [state, setState] = useState<AvailabilityState>({
    timeSlots: [],
    timeSlotsLoading: false,
    selectedSlotOptions: null,
    selectedTime: null,
    slotOptionsLoading: false,
    error: null,
  });

  const availabilityService = AvailabilityService.getInstance();

  // Fetch available time slots (step 1)
  const fetchTimeSlots = useCallback(async () => {
    if (!restaurantId) return;

    setState(prev => ({ 
      ...prev, 
      timeSlotsLoading: true, 
      error: null,
      selectedSlotOptions: null,
      selectedTime: null
    }));

    try {
      const timeSlots = await availabilityService.getAvailableTimeSlots(
        restaurantId,
        date,
        partySize,
        profile?.id
      );

      setState(prev => ({ 
        ...prev, 
        timeSlots,
        timeSlotsLoading: false 
      }));
    } catch (err) {
      console.error("Error fetching time slots:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to load available times",
        timeSlots: [],
        timeSlotsLoading: false 
      }));
    }
  }, [restaurantId, date, partySize, profile?.id, availabilityService]);

  // Fetch table options for selected time (step 2)
  const fetchSlotOptions = useCallback(async (time: string) => {
    if (!restaurantId || !time) return;

    setState(prev => ({ 
      ...prev, 
      slotOptionsLoading: true, 
      selectedTime: time,
      error: null 
    }));

    try {
      const slotOptions = await availabilityService.getTableOptionsForSlot(
        restaurantId,
        date,
        time,
        partySize
      );

      setState(prev => ({ 
        ...prev, 
        selectedSlotOptions: slotOptions,
        slotOptionsLoading: false 
      }));
    } catch (err) {
      console.error("Error fetching slot options:", err);
      setState(prev => ({ 
        ...prev, 
        error: "Failed to load seating experiences",
        selectedSlotOptions: null,
        slotOptionsLoading: false 
      }));
    }
  }, [restaurantId, date, partySize, availabilityService]);

  // Clear selected slot
  const clearSelectedSlot = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      selectedSlotOptions: null,
      selectedTime: null,
      slotOptionsLoading: false 
    }));
  }, []);

  // Refresh everything
  const refresh = useCallback(async () => {
    await fetchTimeSlots();
    if (state.selectedTime) {
      await fetchSlotOptions(state.selectedTime);
    }
  }, [fetchTimeSlots, fetchSlotOptions, state.selectedTime]);

  // Initial fetch
  useEffect(() => {
    if (mode === 'time-first') {
      fetchTimeSlots();
    }
  }, [mode, fetchTimeSlots]);

  // Real-time updates
  useEffect(() => {
    if (!enableRealtime || !restaurantId) return;

    const unsubscribe = realtimeAvailability.subscribeToRestaurant(
      restaurantId,
      () => {
        console.log("Availability update received, refreshing experiences...");
        refresh();
      }
    );

    return unsubscribe;
  }, [restaurantId, enableRealtime, refresh]);

  // Auto-clear selected slot when dependencies change
  useEffect(() => {
    if (state.selectedTime) {
      clearSelectedSlot();
    }
  }, [date, partySize]);

  return {
    // Time slots (step 1)
    timeSlots: state.timeSlots,
    timeSlotsLoading: state.timeSlotsLoading,
    
    // Selected slot details (step 2)
    selectedSlotOptions: state.selectedSlotOptions,
    selectedTime: state.selectedTime,
    slotOptionsLoading: state.slotOptionsLoading,
    
    // General state
    error: state.error,
    
    // Actions
    fetchSlotOptions,
    clearSelectedSlot,
    refresh,
    
    // Convenience getters
    hasTimeSlots: state.timeSlots.length > 0,
    hasSelectedSlot: !!state.selectedSlotOptions,
    isLoading: state.timeSlotsLoading || state.slotOptionsLoading,
    
    // Experience-focused getters
    experienceCount: state.selectedSlotOptions?.options?.length || 0,
    hasMultipleExperiences: (state.selectedSlotOptions?.options?.length || 0) > 1,
    primaryExperience: state.selectedSlotOptions?.primaryOption?.experienceTitle,
  };
}

// Backward compatibility hook for existing code (updated for new interface)
export function useAvailabilityLegacy({
  restaurantId,
  date,
  partySize,
  enableRealtime = true,
}: Omit<UseAvailabilityOptions, 'mode'>) {
  const { profile } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availabilityService = AvailabilityService.getInstance();

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

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

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