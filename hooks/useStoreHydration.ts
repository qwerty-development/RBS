import { useEffect, useState } from "react";
import {
  useAuthStore,
  useAppStore,
  useRestaurantStore,
  useBookingStore,
} from "@/stores";

/**
 * Hook to track when Zustand persistent stores have been hydrated from AsyncStorage
 * This is crucial for preventing race conditions during cold start deep linking
 */
export function useStoreHydration() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hydratedStores, setHydratedStores] = useState({
    auth: false,
    app: false,
    restaurant: false,
    booking: false,
  });

  useEffect(() => {
    let hydrationCount = 0;
    const expectedStores = 4; // Auth, App, Restaurant, Booking
    let isInitialized = false;

    const checkHydration = () => {
      try {
        // Check if all stores have been hydrated using a more reliable method
        const authHydrated = useAuthStore.persist?.hasHydrated?.() ?? true;
        const appHydrated = useAppStore.persist?.hasHydrated?.() ?? true;
        const restaurantHydrated =
          useRestaurantStore.persist?.hasHydrated?.() ?? true;
        const bookingHydrated =
          useBookingStore.persist?.hasHydrated?.() ?? true;

        const newHydratedStores = {
          auth: authHydrated,
          app: appHydrated,
          restaurant: restaurantHydrated,
          booking: bookingHydrated,
        };

        setHydratedStores(newHydratedStores);

        const allHydrated = Object.values(newHydratedStores).every(Boolean);

        if (allHydrated && !isInitialized) {
          isInitialized = true;
          setIsHydrated(true);

          if (__DEV__) {
            console.log(
              "[StoreHydration] ✅ All stores hydrated successfully:",
              {
                allHydrated,
                stores: newHydratedStores,
              },
            );
          }
        }

        if (__DEV__ && !allHydrated) {
          console.log("[StoreHydration] 🔄 Waiting for hydration:", {
            allHydrated,
            stores: newHydratedStores,
          });
        }
      } catch (error) {
        if (__DEV__) {
          console.log("[StoreHydration] Error checking hydration:", error);
        }
      }
    };

    // Check immediately
    checkHydration();

    // Create a more aggressive polling mechanism for hydration detection
    const hydrationInterval = setInterval(() => {
      if (!isInitialized) {
        checkHydration();
      } else {
        clearInterval(hydrationInterval);
      }
    }, 100); // Check every 100ms

    // Set up hydration listeners for each store if available
    const unsubscribers: (() => void)[] = [];

    try {
      // More defensive listener setup
      const stores = [
        { store: useAuthStore, name: "Auth" },
        { store: useAppStore, name: "App" },
        { store: useRestaurantStore, name: "Restaurant" },
        { store: useBookingStore, name: "Booking" },
      ];

      stores.forEach(({ store, name }) => {
        try {
          if (store.persist?.onRehydrateStorage) {
            const unsubscribe = store.persist.onRehydrateStorage(() => () => {
              if (__DEV__)
                console.log(`[StoreHydration] ${name} store rehydrated`);
              hydrationCount++;
              setTimeout(checkHydration, 50); // Small delay to ensure state is updated
            });
            if (unsubscribe) unsubscribers.push(unsubscribe);
          }
        } catch (error) {
          if (__DEV__)
            console.log(
              `[StoreHydration] Error setting up ${name} listener:`,
              error,
            );
        }
      });
    } catch (error) {
      if (__DEV__)
        console.log("[StoreHydration] Error setting up listeners:", error);
    }

    // Fallback timer - be more aggressive for cold start scenarios
    const fallbackTimers = [
      setTimeout(() => {
        if (!isInitialized) {
          if (__DEV__) console.log("[StoreHydration] 🕐 1s fallback check");
          checkHydration();
        }
      }, 1000),

      setTimeout(() => {
        if (!isInitialized) {
          if (__DEV__)
            console.log(
              "[StoreHydration] 🕐 2s fallback - forcing hydration complete",
            );
          isInitialized = true;
          setIsHydrated(true);
        }
      }, 2000),
    ];

    return () => {
      clearInterval(hydrationInterval);
      fallbackTimers.forEach(clearTimeout);
      unsubscribers.forEach((unsub) => {
        try {
          unsub?.();
        } catch (error) {
          if (__DEV__)
            console.log("[StoreHydration] Error unsubscribing:", error);
        }
      });
    };
  }, []);

  return {
    isHydrated,
    hydratedStores,
  };
}
