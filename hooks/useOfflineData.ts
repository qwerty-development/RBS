// hooks/useOfflineData.ts
import { useEffect, useState, useCallback } from 'react';
import { useNetwork } from '@/context/network-provider';
import { offlineStorage } from '@/utils/offlineStorage';
import { offlineSync } from '@/services/offlineSync';

interface UseOfflineDataOptions<T> {
  key: 'restaurants' | 'bookings' | 'favorites' | 'profile';
  fetchOnlineData: () => Promise<T>;
  cacheData: (data: T) => Promise<void>;
  getCachedData: () => Promise<T | null>;
  staleTime?: number; // Time in ms before cache is considered stale
}

export function useOfflineData<T>({
  key,
  fetchOnlineData,
  cacheData,
  getCachedData,
  staleTime = 30 * 60 * 1000, // 30 minutes default
}: UseOfflineDataOptions<T>) {
  const { isOnline, isOffline } = useNetwork();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(0);

  // Load data (either from cache or network)
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // If offline, always use cache
      if (isOffline && !forceRefresh) {
        console.log(`[OfflineData] Loading ${key} from cache (offline)`);
        const cachedData = await getCachedData();
        
        if (cachedData) {
          setData(cachedData);
          setIsFromCache(true);
        } else {
          throw new Error('No cached data available');
        }
        
        return;
      }

      // If online, check if cache is stale
      const isCacheStale = await offlineStorage.isCacheStale(key, staleTime);
      const shouldUseFreshData = forceRefresh || isCacheStale || !data;

      if (shouldUseFreshData && isOnline) {
        console.log(`[OfflineData] Fetching fresh ${key} data`);
        const freshData = await fetchOnlineData();
        
        setData(freshData);
        setIsFromCache(false);
        setLastFetch(Date.now());
        
        // Cache the fresh data
        await cacheData(freshData);
      } else {
        // Use cached data if available and not stale
        console.log(`[OfflineData] Using cached ${key} data`);
        const cachedData = await getCachedData();
        
        if (cachedData) {
          setData(cachedData);
          setIsFromCache(true);
        } else {
          // Fallback to fetching if no cache
          const freshData = await fetchOnlineData();
          setData(freshData);
          setIsFromCache(false);
          await cacheData(freshData);
        }
      }
    } catch (err) {
      console.error(`[OfflineData] Error loading ${key}:`, err);
      
      // If error and we have cached data, use it
      if (isOffline || !isOnline) {
        const cachedData = await getCachedData();
        if (cachedData) {
          setData(cachedData);
          setIsFromCache(true);
          setError(null); // Clear error if we have cache
          return;
        }
      }
      
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, isOnline, isOffline, fetchOnlineData, cacheData, getCachedData, staleTime]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync when coming back online
  useEffect(() => {
    if (isOnline && !loading) {
      // Check for pending offline actions
      if (offlineSync.hasPendingActions()) {
        console.log('[OfflineData] Syncing pending offline actions');
        offlineSync.sync();
      }

      // Refresh data if it was from cache
      if (isFromCache) {
        loadData(true);
      }
    }
  }, [isOnline, isFromCache, loading]);

  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  return {
    data,
    loading,
    error,
    isFromCache,
    refresh,
    isOnline,
    isOffline,
  };
}

// Specific hooks for different data types
export function useOfflineRestaurants(originalFetch: () => Promise<any>) {
  return useOfflineData({
    key: 'restaurants',
    fetchOnlineData: originalFetch,
    cacheData: offlineStorage.cacheRestaurants,
    getCachedData: offlineStorage.getCachedRestaurants,
  });
}

export function useOfflineBookings(originalFetch: () => Promise<any>) {
  return useOfflineData({
    key: 'bookings',
    fetchOnlineData: originalFetch,
    cacheData: offlineStorage.cacheBookings,
    getCachedData: offlineStorage.getCachedBookings,
  });
}

export function useOfflineFavorites(originalFetch: () => Promise<any>) {
  return useOfflineData({
    key: 'favorites',
    fetchOnlineData: originalFetch,
    cacheData: offlineStorage.cacheFavorites,
    getCachedData: offlineStorage.getCachedFavorites,
  });
}

export function useOfflineProfile(originalFetch: () => Promise<any>) {
  return useOfflineData({
    key: 'profile',
    fetchOnlineData: originalFetch,
    cacheData: offlineStorage.cacheUserProfile,
    getCachedData: offlineStorage.getCachedUserProfile,
    staleTime: 60 * 60 * 1000, // 1 hour for profile
  });
}