// hooks/useRealtimeAvailability.ts
import { useEffect, useRef, useCallback } from "react";
import { realtimeAvailability } from "@/lib/RealtimeAvailability";

interface UseRealtimeAvailabilityOptions {
  enabled?: boolean;
  onUpdate?: () => void;
  debounceMs?: number;
}

/**
 * Manages real-time availability subscriptions with proper cleanup and error handling
 */
export function useRealtimeAvailability(
  restaurantId: string,
  options: UseRealtimeAvailabilityOptions = {},
) {
  const { enabled = true, onUpdate, debounceMs = 1000 } = options;

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const debouncedUpdate = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && onUpdate) {
        onUpdate();
      }
    }, debounceMs);
  }, [onUpdate, debounceMs]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled || !restaurantId || !onUpdate) {
      return;
    }

    // Clean up any existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    try {
      unsubscribeRef.current = realtimeAvailability.subscribeToRestaurant(
        restaurantId,
        debouncedUpdate,
      );
    } catch (error) {
      console.error("Failed to create real-time subscription:", error);
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [restaurantId, enabled, debouncedUpdate]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    subscriptionStatus:
      realtimeAvailability.getSubscriptionStatus(restaurantId),
  };
}
