// hooks/useRestaurants.ts - Updated with offline support
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { useNetwork } from "@/context/network-provider";
import { offlineStorage } from "@/utils/offlineStorage";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export function useRestaurants() {
  const { isOnline, isOffline } = useNetwork();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const fetchRestaurants = useCallback(async (forceOnline = false) => {
    try {
      setLoading(true);
      setError(null);

      // If offline and not forcing online, load from cache
      if (isOffline && !forceOnline) {
        console.log("📱 Loading restaurants from cache (offline)");
        const cachedRestaurants = await offlineStorage.getCachedRestaurants();
        
        if (cachedRestaurants) {
          setRestaurants(cachedRestaurants);
          setIsFromCache(true);
          return;
        } else {
          throw new Error("No cached restaurants available");
        }
      }

      // Check if cache is fresh enough (not stale)
      const isCacheStale = await offlineStorage.isCacheStale('restaurants');
      
      if (!isCacheStale && !forceOnline) {
        const cachedRestaurants = await offlineStorage.getCachedRestaurants();
        if (cachedRestaurants) {
          console.log("📱 Using fresh cached restaurants");
          setRestaurants(cachedRestaurants);
          setIsFromCache(true);
          setLoading(false);
          return;
        }
      }

      // Fetch from Supabase
      console.log("🌐 Fetching restaurants from server");
      const { data, error: fetchError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("is_active", true)
        .order("rating", { ascending: false });

      if (fetchError) throw fetchError;

      const restaurantsData = data || [];
      setRestaurants(restaurantsData);
      setIsFromCache(false);

      // Cache for offline use
      await offlineStorage.cacheRestaurants(restaurantsData);
      console.log("💾 Restaurants cached for offline use");

    } catch (err) {
      console.error("Error fetching restaurants:", err);
      setError(err as Error);

      // If error and offline, try cache as fallback
      if (isOffline) {
        const cachedRestaurants = await offlineStorage.getCachedRestaurants();
        if (cachedRestaurants) {
          setRestaurants(cachedRestaurants);
          setIsFromCache(true);
          setError(null); // Clear error if we have cache
          console.log("📱 Using cached restaurants after error");
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isOffline]);

  // Initial load
  useEffect(() => {
    fetchRestaurants();
  }, []);

  // Refresh when coming back online if using cached data
  useEffect(() => {
    if (isOnline && isFromCache) {
      console.log("🔄 Back online, refreshing restaurants");
      fetchRestaurants(true); // Force online refresh
    }
  }, [isOnline, isFromCache]);

  const refresh = useCallback(async () => {
    await fetchRestaurants(!isOffline); // Force online if possible
  }, [fetchRestaurants, isOffline]);

  return {
    restaurants,
    loading,
    error,
    isFromCache,
    isOnline,
    isOffline,
    refresh,
  };
}

// Hook for favorites with offline support
export function useFavorites(userId?: string) {
  const { isOnline, isOffline } = useNetwork();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!userId) return;

    try {
      // Try cache first if offline
      if (isOffline) {
        const cachedFavorites = await offlineStorage.getCachedFavorites();
        if (cachedFavorites) {
          const favoriteIds = new Set(cachedFavorites.map(f => f.restaurant_id));
          setFavorites(favoriteIds);
          setIsFromCache(true);
          return;
        }
      }

      // Fetch from server
      const { data, error } = await supabase
        .from("favorites")
        .select("restaurant_id")
        .eq("user_id", userId);

      if (error) throw error;

      const favoriteIds = new Set(data?.map(f => f.restaurant_id) || []);
      setFavorites(favoriteIds);
      setIsFromCache(false);

      // Cache for offline
      if (data) {
        await offlineStorage.cacheFavorites(data as any);
      }
    } catch (error) {
      console.error("Error fetching favorites:", error);
      
      // Fallback to cache
      const cachedFavorites = await offlineStorage.getCachedFavorites();
      if (cachedFavorites) {
        const favoriteIds = new Set(cachedFavorites.map(f => f.restaurant_id));
        setFavorites(favoriteIds);
        setIsFromCache(true);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, isOffline]);

  const toggleFavorite = useCallback(async (restaurantId: string) => {
    if (!userId) return;

    const isFavorite = favorites.has(restaurantId);
    
    // Optimistic update
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (isFavorite) {
        newFavorites.delete(restaurantId);
      } else {
        newFavorites.add(restaurantId);
      }
      return newFavorites;
    });

    try {
      if (isOffline) {
        // Queue for offline sync
        await offlineStorage.addToOfflineQueue({
          type: isFavorite ? 'REMOVE_FAVORITE' : 'ADD_FAVORITE',
          payload: {
            user_id: userId,
            restaurant_id: restaurantId,
          },
        });
        return;
      }

      // Online operation
      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("restaurant_id", restaurantId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: userId,
            restaurant_id: restaurantId,
          });
        
        if (error) throw error;
      }

      // Refresh favorites to sync
      await fetchFavorites();
    } catch (error) {
      console.error("Error toggling favorite:", error);
      
      // Revert optimistic update
      setFavorites(prev => {
        const newFavorites = new Set(prev);
        if (isFavorite) {
          newFavorites.add(restaurantId);
        } else {
          newFavorites.delete(restaurantId);
        }
        return newFavorites;
      });
    }
  }, [userId, favorites, isOffline, fetchFavorites]);

  useEffect(() => {
    if (userId) {
      fetchFavorites();
    }
  }, [userId, fetchFavorites]);

  return {
    favorites,
    loading,
    isFromCache,
    toggleFavorite,
    refresh: fetchFavorites,
  };
}