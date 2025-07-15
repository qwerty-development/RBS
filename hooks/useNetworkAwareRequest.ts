import { useCallback, useState } from "react";
import { useNetwork } from "@/context/network-provider";
import { useOfflineSync } from "./useOfflineSync";

interface RequestOptions {
  timeout?: number;
  retries?: number;
  fallbackToOffline?: boolean;
  cacheResponse?: boolean;
  showOfflineMessage?: boolean;
}

export function useNetworkAwareRequest() {
  const { isOnline, networkState } = useNetwork();
  const { queueAction } = useOfflineSync();
  const [loading, setLoading] = useState(false);

  const makeRequest = useCallback(async <T>(
    requestFn: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T | null> => {
    const {
      timeout = 10000,
      retries = 2,
      fallbackToOffline = true,
      showOfflineMessage = true,
    } = options;

    setLoading(true);

    try {
      // Check if online
      if (!isOnline) {
        if (fallbackToOffline) {
          // Queue for later
          await queueAction("request", { requestFn: requestFn.toString(), options });
          
          if (showOfflineMessage) {
            console.log("[NetworkAwareRequest] Queued request for when online");
          }
          
          return null;
        } else {
          throw new Error("No internet connection");
        }
      }

      // Adjust timeout for slow connections
      const adjustedTimeout = networkState.isSlowConnection 
        ? timeout * 2 
        : timeout;

      let lastError: Error;
      
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Request timeout")), adjustedTimeout);
          });

          const result = await Promise.race([
            requestFn(),
            timeoutPromise,
          ]);

          return result;
        } catch (error) {
          lastError = error as Error;
          
          if (attempt < retries) {
            // Wait before retry, longer for slow connections
            const delay = networkState.isSlowConnection ? 2000 : 1000;
            await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
          }
        }
      }

      throw lastError!;
    } catch (error) {
      console.error("[NetworkAwareRequest] Request failed:", error);
      
      if (fallbackToOffline && isOnline) {
        // Network error, but we're supposedly online - queue for retry
        await queueAction("failed_request", { 
          requestFn: requestFn.toString(), 
          options,
          error: (error as Error).message,
        });
      }
      
      throw error;
    } finally {
      setLoading(false);
    }
  }, [isOnline, networkState, queueAction]);

  return {
    makeRequest,
    loading,
    isOnline,
    isSlowConnection: networkState.isSlowConnection,
  };
}