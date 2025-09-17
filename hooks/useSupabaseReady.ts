import { useEffect, useState } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useStoreHydration } from "@/hooks/useStoreHydration";

/**
 * Hook to ensure Supabase client and all dependencies are fully ready
 * This prevents race conditions during cold start where Supabase operations might fail
 */
export function useSupabaseReady() {
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const { initialized: authInitialized } = useAuth();
  const { isHydrated: storesHydrated } = useStoreHydration();

  useEffect(() => {
    const checkSupabaseReady = async () => {
      try {
        // Only proceed if auth and stores are ready
        if (!authInitialized || !storesHydrated) {
          setIsSupabaseReady(false);
          return;
        }

        // Test Supabase client with a simple query
        // This ensures the client is actually connected and working
        const { error } = await supabase
          .from("restaurants")
          .select("id")
          .limit(1);

        // Even if no data is found, we just want to ensure no connection errors
        // Common acceptable error codes:
        // - PGRST116: No rows found (fine, means query worked)
        // - 406: Not acceptable (fine, means API is responding)
        const isReady = !error ||
          error.code === "PGRST116" ||
          error.code === "406" ||
          error.message?.includes("No rows")

        if (__DEV__) {
          console.log("[useSupabaseReady] Supabase client test result:", {
            isReady,
            authInitialized,
            storesHydrated,
            error: error?.message,
          });
        }

        setIsSupabaseReady(isReady);
      } catch (error) {
        if (__DEV__) {
          console.log("[useSupabaseReady] Supabase client test failed:", error);
        }
        setIsSupabaseReady(false);
      }
    };

    checkSupabaseReady();
  }, [authInitialized, storesHydrated]);

  return {
    isSupabaseReady,
    authInitialized,
    storesHydrated,
    isFullyReady: isSupabaseReady && authInitialized && storesHydrated,
  };
}