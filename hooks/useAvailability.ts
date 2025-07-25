// hooks/useAvailability.ts (Optimized)
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  AvailabilityService,
  TimeSlotBasic,
  SlotTableOptions,
} from "@/lib/AvailabilityService";
import { realtimeAvailability } from "@/lib/RealtimeAvailability";
import { useAuth } from "@/context/supabase-provider";

interface UseAvailabilityOptions {
  restaurantId: string;
  date: Date;
  partySize: number;
  enableRealtime?: boolean;
  mode?: "time-first" | "full";
  preloadNext?: boolean;
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
  lastUpdate: number;
}

export function useAvailability({
  restaurantId,
  date,
  partySize,
  enableRealtime = true,
  mode = "time-first",
  preloadNext = true,
}: UseAvailabilityOptions) {
  const { profile } = useAuth();
  const [state, setState] = useState<AvailabilityState>({
    timeSlots: [],
    timeSlotsLoading: false,
    selectedSlotOptions: null,
    selectedTime: null,
    slotOptionsLoading: false,
    error: null,
    lastUpdate: 0,
  });

  // Refs for optimization
  const availabilityService = useMemo(
    () => AvailabilityService.getInstance(),
    [],
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastParamsRef = useRef<string>("");

  // Memoized params key for change detection
  const paramsKey = useMemo(
    () =>
      `${restaurantId}:${date.toISOString().split("T")[0]}:${partySize}:${profile?.id || "guest"}`,
    [restaurantId, date, partySize, profile?.id],
  );

  // Optimized fetch function with abort capability
  const fetchTimeSlots = useCallback(
    async (signal?: AbortSignal) => {
      if (!restaurantId) return;

      // Skip if params haven't changed
      if (
        paramsKey === lastParamsRef.current &&
        state.timeSlots.length > 0 &&
        !state.error
      ) {
        return;
      }

      setState((prev) => ({
        ...prev,
        timeSlotsLoading: true,
        error: null,
        selectedSlotOptions: null,
        selectedTime: null,
      }));

      try {
        const timeSlots = await availabilityService.getAvailableTimeSlots(
          restaurantId,
          date,
          partySize,
          profile?.id,
          preloadNext,
        );

        // Check if request was cancelled
        if (signal?.aborted) return;

        setState((prev) => ({
          ...prev,
          timeSlots,
          timeSlotsLoading: false,
          lastUpdate: Date.now(),
        }));

        lastParamsRef.current = paramsKey;
      } catch (err) {
        if (signal?.aborted) return;

        console.error("Error fetching time slots:", err);
        setState((prev) => ({
          ...prev,
          error: "Failed to load available times",
          timeSlots: [],
          timeSlotsLoading: false,
        }));
      }
    },
    [
      restaurantId,
      date,
      partySize,
      profile?.id,
      preloadNext,
      availabilityService,
      paramsKey,
      state.timeSlots.length,
      state.error,
    ],
  );

  // Optimized fetch slot options with debouncing
  const fetchSlotOptions = useCallback(
    async (time: string) => {
      if (!restaurantId || !time) return;

      // Cancel any existing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState((prev) => ({
        ...prev,
        slotOptionsLoading: true,
        selectedTime: time,
        error: null,
      }));

      try {
        // Small delay to avoid rapid fire requests
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (controller.signal.aborted) return;

        const slotOptions = await availabilityService.getTableOptionsForSlot(
          restaurantId,
          date,
          time,
          partySize,
        );

        if (controller.signal.aborted) return;

        setState((prev) => ({
          ...prev,
          selectedSlotOptions: slotOptions,
          slotOptionsLoading: false,
          lastUpdate: Date.now(),
        }));
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("Error fetching slot options:", err);
        setState((prev) => ({
          ...prev,
          error: "Failed to load seating experiences",
          selectedSlotOptions: null,
          slotOptionsLoading: false,
        }));
      }
    },
    [restaurantId, date, partySize, availabilityService],
  );

  // Optimized clear function
  const clearSelectedSlot = useCallback(() => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState((prev) => ({
      ...prev,
      selectedSlotOptions: null,
      selectedTime: null,
      slotOptionsLoading: false,
      error: prev.error && prev.error.includes("seating") ? null : prev.error,
    }));
  }, []);

  // Enhanced refresh with optimistic updates
  const refresh = useCallback(
    async (force = false) => {
      if (force) {
        // Clear cache for this restaurant
        availabilityService.clearCombinationCache(restaurantId);
        lastParamsRef.current = "";
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      await fetchTimeSlots(controller.signal);

      if (state.selectedTime && !controller.signal.aborted) {
        await fetchSlotOptions(state.selectedTime);
      }
    },
    [
      fetchTimeSlots,
      fetchSlotOptions,
      state.selectedTime,
      availabilityService,
      restaurantId,
    ],
  );

  // Initial fetch with optimization
  useEffect(() => {
    if (mode === "time-first") {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      fetchTimeSlots(controller.signal);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [mode, paramsKey]); // Use paramsKey instead of individual params

  // Real-time updates with throttling
  const realtimeUpdateRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enableRealtime || !restaurantId) return;

    let isMounted = true;
    let unsubscribeRealtime: (() => void) | null = null;

    const throttledUpdate = () => {
      // Check if component is still mounted
      if (!isMounted) return;

      // Clear existing timeout
      if (realtimeUpdateRef.current) {
        clearTimeout(realtimeUpdateRef.current);
        realtimeUpdateRef.current = null;
      }

      // Throttle updates to avoid excessive calls
      realtimeUpdateRef.current = setTimeout(() => {
        if (isMounted) {
          console.log("Availability update received, refreshing experiences...");
          refresh();
        }
      }, 2000); // 2 second throttle
    };

    const subscribeToRealtime = async () => {
      try {
        unsubscribeRealtime = realtimeAvailability.subscribeToRestaurant(
          restaurantId,
          throttledUpdate,
        );
      } catch (error) {
        console.error("Failed to subscribe to realtime updates:", error);
      }
    };

    subscribeToRealtime();

    return () => {
      isMounted = false;
      
      // Clean up realtime subscription
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
        unsubscribeRealtime = null;
      }
      
      // Clean up timeout
      if (realtimeUpdateRef.current) {
        clearTimeout(realtimeUpdateRef.current);
        realtimeUpdateRef.current = null;
      }
      
      console.log("🧹 Availability realtime subscription cleaned up");
    };
  }, [restaurantId, enableRealtime, refresh]);

  // Auto-clear selected slot when dependencies change
  useEffect(() => {
    if (state.selectedTime) {
      clearSelectedSlot();
    }
  }, [paramsKey]); // Use paramsKey for better dependency tracking

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (realtimeUpdateRef.current) {
        clearTimeout(realtimeUpdateRef.current);
      }
    };
  }, []);

  // Memoized computed values
  const computedValues = useMemo(
    () => ({
      hasTimeSlots: state.timeSlots.length > 0,
      hasSelectedSlot: !!state.selectedSlotOptions,
      isLoading: state.timeSlotsLoading || state.slotOptionsLoading,
      experienceCount: state.selectedSlotOptions?.options?.length || 0,
      hasMultipleExperiences:
        (state.selectedSlotOptions?.options?.length || 0) > 1,
      primaryExperience:
        state.selectedSlotOptions?.primaryOption?.experienceTitle,
      isEmpty: !state.timeSlotsLoading && state.timeSlots.length === 0,
      hasError: !!state.error,
      isStale: Date.now() - state.lastUpdate > 300000, // 5 minutes
    }),
    [state],
  );

  // Optimized slot finding
  const findSlot = useCallback(
    (time: string) => {
      return state.timeSlots.find((slot) => slot.time === time);
    },
    [state.timeSlots],
  );

  // Prefetch next logical selections
  const prefetchNext = useCallback(() => {
    if (!preloadNext || state.timeSlots.length === 0) return;

    // Prefetch the first few available slots in background
    setTimeout(() => {
      const slotsToPreload = state.timeSlots.slice(0, 3);
      slotsToPreload.forEach((slot, index) => {
        setTimeout(() => {
          availabilityService
            .getTableOptionsForSlot(restaurantId, date, slot.time, partySize)
            .catch(() => {
              /* Ignore errors in prefetch */
            });
        }, index * 500); // Stagger requests
      });
    }, 1000);
  }, [
    preloadNext,
    state.timeSlots,
    restaurantId,
    date,
    partySize,
    availabilityService,
  ]);

  // Trigger prefetch when time slots are loaded
  useEffect(() => {
    if (state.timeSlots.length > 0 && !state.timeSlotsLoading) {
      prefetchNext();
    }
  }, [state.timeSlots.length, state.timeSlotsLoading, prefetchNext]);

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
    lastUpdate: state.lastUpdate,

    // Actions
    fetchSlotOptions,
    clearSelectedSlot,
    refresh,
    findSlot,

    // Computed values (memoized)
    ...computedValues,
  };
}

// Backward compatibility hook with performance optimizations
export function useAvailabilityLegacy({
  restaurantId,
  date,
  partySize,
  enableRealtime = true,
}: Omit<UseAvailabilityOptions, "mode">) {
  const { profile } = useAuth();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availabilityService = useMemo(
    () => AvailabilityService.getInstance(),
    [],
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!restaurantId) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const availableSlots = await availabilityService.getAvailableSlots(
        restaurantId,
        date,
        partySize,
        profile?.id,
      );

      if (!controller.signal.aborted) {
        setSlots(availableSlots);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("Error fetching availability:", err);
        setError("Failed to load available times");
        setSlots([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [restaurantId, date, partySize, profile?.id, availabilityService]);

  useEffect(() => {
    fetchAvailability();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAvailability]);

  // Optimized real-time updates
  useEffect(() => {
    if (!enableRealtime || !restaurantId) return;

    const updateRef = { current: null as number | null };

    const throttledRefresh = () => {
      if (updateRef.current) {
        clearTimeout(updateRef.current);
      }
      updateRef.current = setTimeout(() => {
        console.log("Availability update received, refreshing...");
        fetchAvailability();
      }, 2000);
    };

    const unsubscribe = realtimeAvailability.subscribeToRestaurant(
      restaurantId,
      throttledRefresh,
    );

    return () => {
      unsubscribe();
      if (updateRef.current) {
        clearTimeout(updateRef.current);
      }
    };
  }, [restaurantId, enableRealtime, fetchAvailability]);

  return {
    slots,
    loading,
    error,
    refresh: fetchAvailability,
    isEmpty: !loading && slots.length === 0,
    hasSlots: slots.length > 0,
  };
}

// Specialized hook for quick availability checks (for lists, etc.)
export function useQuickAvailability(
  restaurantId: string,
  date: Date,
  partySize: number,
  enabled: boolean = true,
) {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const availabilityService = useMemo(
    () => AvailabilityService.getInstance(),
    [],
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkAvailability = useCallback(async () => {
    if (!enabled || !restaurantId) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setChecking(true);

    try {
      const timeSlots = await availabilityService.getAvailableTimeSlots(
        restaurantId,
        date,
        partySize,
        undefined,
        false, // Don't preload for quick checks
      );

      if (!controller.signal.aborted) {
        setIsAvailable(timeSlots.length > 0);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Error checking quick availability:", error);
        setIsAvailable(false);
      }
    } finally {
      if (!controller.signal.aborted) {
        setChecking(false);
      }
    }
  }, [enabled, restaurantId, date, partySize, availabilityService]);

  useEffect(() => {
    checkAvailability();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [checkAvailability]);

  return {
    isAvailable,
    checking,
    refresh: checkAvailability,
  };
}

// Hook for preloading availability data
export function useAvailabilityPreloader() {
  const availabilityService = useMemo(
    () => AvailabilityService.getInstance(),
    [],
  );

  const preloadRestaurant = useCallback(
    (restaurantId: string, partySizes: number[] = [2, 4]) => {
      availabilityService.preloadPopularSlots(restaurantId, partySizes);
    },
    [availabilityService],
  );

  return { preloadRestaurant };
}
