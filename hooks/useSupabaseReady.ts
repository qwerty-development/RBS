// hooks/useSupabaseReady.ts
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useNetworkMonitor } from "@/hooks/useNetworkMonitor";

interface SupabaseReadyState {
  isReady: boolean;
  sessionRestored: boolean;
  authInitialized: boolean;
  error: string | null;
}

/**
 * Hook that tracks when Supabase client is fully ready for requests
 * This includes both auth initialization AND session restoration from storage
 */
export function useSupabaseReady(): SupabaseReadyState {
  const { initialized: authInitialized } = useAuth();
  const { isOnline } = useNetworkMonitor();
  const [sessionRestored, setSessionRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restorationAttempted = useRef(false);

  useEffect(() => {
    if (!authInitialized || restorationAttempted.current || !isOnline) {
      return;
    }

    restorationAttempted.current = true;

    const verifySessionRestoration = async () => {
      try {
        console.log("🔄 [SupabaseReady] Verifying session restoration...");

        // Give extra time for cold start session restoration
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Test if Supabase client can make an authenticated request
        const { error: testError } = await supabase.auth.getUser();

        if (testError && testError.message !== "Auth session missing!") {
          console.warn(
            "⚠️ [SupabaseReady] Session verification warning:",
            testError.message,
          );
          setError(testError.message);
        } else {
          console.log("✅ [SupabaseReady] Session restoration verified");
          setError(null);
        }

        setSessionRestored(true);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(
          "❌ [SupabaseReady] Session verification failed:",
          errorMsg,
        );
        setError(errorMsg);
        setSessionRestored(true); // Still mark as restored to prevent blocking
      }
    };

    // Add small delay for cold starts to allow SecureStore operations to complete
    const delay = restorationAttempted.current ? 50 : 200;
    const timer = setTimeout(verifySessionRestoration, delay);

    return () => clearTimeout(timer);
  }, [authInitialized, isOnline]);

  const isReady = authInitialized && sessionRestored && isOnline;

  // Reset restoration state if auth gets re-initialized
  useEffect(() => {
    if (!authInitialized && restorationAttempted.current) {
      console.log(
        "🔄 [SupabaseReady] Auth re-initializing, resetting restoration state",
      );
      restorationAttempted.current = false;
      setSessionRestored(false);
      setError(null);
    }
  }, [authInitialized]);

  return {
    isReady,
    sessionRestored,
    authInitialized,
    error,
  };
}
