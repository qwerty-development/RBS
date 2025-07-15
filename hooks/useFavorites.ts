// hooks/useFavorites.ts - Updated with offline support
import { useState, useCallback, useRef, useEffect } from "react";
import { Alert, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { useNetwork } from "@/context/network-provider";
import { Database } from "@/types/supabase";
import { offlineStorage } from "@/utils/offlineStorage";
import { offlineSync } from "@/services/offlineSync";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
export type Favorite = {
  id: string;
  restaurant_id: string;
  created_at: string;
  restaurant: Restaurant;
  last_booking?: string;
  total_bookings?: number;
};

export const useFavorites = () => {
  const { profile } = useAuth();
  const { isOnline, isOffline } = useNetwork();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Animation references
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const fetchFavorites = useCallback(async (forceOnline = false) => {
    if (!profile?.id) return;

    try {
      // If offline and not forcing online, try to load from cache
      if (isOffline && !forceOnline) {
        console.log("📱 Loading favorites from cache (offline)");
        const cachedFavorites = await offlineStorage.getCachedFavorites();
        
        if (cachedFavorites) {
          // Transform cached data to match expected format
          const favoritesWithRestaurants = cachedFavorites.map(fav => ({
            ...fav,
            restaurant: fav.restaurant || {} as Restaurant,
          }));
          setFavorites(favoritesWithRestaurants);
          setIsFromCache(true);
          return;
        } else {
          throw new Error("No cached favorites available");
        }
      }

      // Check if cache is fresh enough
      const isCacheStale = await offlineStorage.isCacheStale('favorites');
      
      if (!isCacheStale && !forceOnline) {
        const cachedFavorites = await offlineStorage.getCachedFavorites();
        if (cachedFavorites) {
          console.log("📱 Using fresh cached favorites");
          const favoritesWithRestaurants = cachedFavorites.map(fav => ({
            ...fav,
            restaurant: fav.restaurant || {} as Restaurant,
          }));
          setFavorites(favoritesWithRestaurants);
          setIsFromCache(true);
          return;
        }
      }

      // Online fetch
      console.log("🌐 Fetching favorites from server");
      
      // Fetch favorites with restaurant details
      const { data: favoritesData, error: favoritesError } = await supabase
        .from("favorites")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `,
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (favoritesError) throw favoritesError;

      // Fetch booking statistics for each favorite
      const enrichedFavorites = await Promise.all(
        (favoritesData || []).map(async (favorite) => {
          try {
            // Get last booking date
            const { data: lastBooking } = await supabase
              .from("bookings")
              .select("booking_time")
              .eq("user_id", profile.id)
              .eq("restaurant_id", favorite.restaurant_id)
              .eq("status", "completed")
              .order("booking_time", { ascending: false })
              .limit(1)
              .single();

            // Get total bookings count
            const { count } = await supabase
              .from("bookings")
              .select("*", { count: "exact", head: true })
              .eq("user_id", profile.id)
              .eq("restaurant_id", favorite.restaurant_id)
              .eq("status", "completed");

            return {
              ...favorite,
              last_booking: lastBooking?.booking_time,
              total_bookings: count || 0,
            };
          } catch (error) {
            console.warn("Error fetching booking stats for favorite:", error);
            return {
              ...favorite,
              last_booking: undefined,
              total_bookings: 0,
            };
          }
        }),
      );

      setFavorites(enrichedFavorites);
      setIsFromCache(false);

      // Cache for offline use
      await offlineStorage.cacheFavorites(enrichedFavorites as any);
      console.log("💾 Favorites cached for offline use");

    } catch (error) {
      console.error("Error fetching favorites:", error);
      
      // If error and offline, try cache as fallback
      if (isOffline) {
        const cachedFavorites = await offlineStorage.getCachedFavorites();
        if (cachedFavorites) {
          const favoritesWithRestaurants = cachedFavorites.map(fav => ({
            ...fav,
            restaurant: fav.restaurant || {} as Restaurant,
          }));
          setFavorites(favoritesWithRestaurants);
          setIsFromCache(true);
          console.log("📱 Using cached favorites after error");
          return;
        }
      }
      
      Alert.alert("Error", "Failed to load favorites");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, isOffline]);

  const removeFavorite = useCallback(
    async (favoriteId: string, restaurantName: string) => {
      Alert.alert(
        "Remove from Favorites",
        `Are you sure you want to remove ${restaurantName} from your favorites?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setRemovingId(favoriteId);

              // Animate removal
              Animated.parallel([
                Animated.timing(fadeAnim, {
                  toValue: 0,
                  duration: 300,
                  useNativeDriver: true,
                }),
                Animated.spring(scaleAnim, {
                  toValue: 0.8,
                  useNativeDriver: true,
                }),
              ]).start();

              try {
                // Optimistic update
                const originalFavorites = [...favorites];
                setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));

                // If offline, add to queue
                if (isOffline) {
                  const favoriteToRemove = originalFavorites.find(f => f.id === favoriteId);
                  if (favoriteToRemove) {
                    await offlineStorage.addToOfflineQueue({
                      type: 'REMOVE_FAVORITE',
                      payload: {
                        user_id: profile?.id,
                        restaurant_id: favoriteToRemove.restaurant_id,
                      },
                    });
                  }

                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert(
                    "Removed from Favorites",
                    "Your favorite will be removed when you're back online.",
                  );
                  return;
                }

                // Online removal
                const { error } = await supabase
                  .from("favorites")
                  .delete()
                  .eq("id", favoriteId);

                if (error) {
                  // Revert optimistic update on error
                  setFavorites(originalFavorites);
                  throw error;
                }

                // Haptic feedback
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                // Reset animations
                fadeAnim.setValue(1);
                scaleAnim.setValue(1);

                // Update cache
                const updatedFavorites = originalFavorites.filter(f => f.id !== favoriteId);
                await offlineStorage.cacheFavorites(updatedFavorites as any);

              } catch (error) {
                console.error("Error removing favorite:", error);
                Alert.alert("Error", "Failed to remove from favorites");

                // Reset animations on error
                Animated.parallel([
                  Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                  }),
                  Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                  }),
                ]).start();
              } finally {
                setRemovingId(null);
              }
            },
          },
        ],
      );
    },
    [fadeAnim, scaleAnim, favorites, isOffline, profile?.id],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFavorites(!isOffline); // Force online if possible
  }, [fetchFavorites, isOffline]);

  // Load initial data
  useEffect(() => {
    if (profile?.id) {
      fetchFavorites();
    }
  }, [profile?.id]);

  // Refresh when coming back online
  useEffect(() => {
    if (isOnline && isFromCache) {
      console.log("🔄 Back online, refreshing favorites");
      
      // Sync any offline actions
      offlineSync.syncOfflineActions().then(result => {
        if (result.synced > 0) {
          fetchFavorites(true); // Force online refresh
        }
      });
    }
  }, [isOnline, isFromCache, fetchFavorites]);

  return {
    favorites,
    loading,
    refreshing,
    removingId,
    fadeAnim,
    scaleAnim,
    isFromCache,
    isOnline,
    isOffline,
    fetchFavorites,
    removeFavorite,
    handleRefresh,
  };
};