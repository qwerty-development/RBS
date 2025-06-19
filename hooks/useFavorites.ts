import { useState, useCallback, useRef } from "react";
import { Alert, Animated } from "react-native";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";

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
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Animation references
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const fetchFavorites = useCallback(async () => {
    if (!profile?.id) return;

    try {
      // Fetch favorites with restaurant details
      const { data: favoritesData, error: favoritesError } = await supabase
        .from("favorites")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `
        )
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (favoritesError) throw favoritesError;

      // Fetch booking statistics for each favorite
      const enrichedFavorites = await Promise.all(
        (favoritesData || []).map(async (favorite) => {
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
        })
      );

      setFavorites(enrichedFavorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      Alert.alert("Error", "Failed to load favorites");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

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
                // Delete from database
                const { error } = await supabase
                  .from("favorites")
                  .delete()
                  .eq("id", favoriteId);

                if (error) throw error;

                // Haptic feedback
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

                // Update local state
                setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));

                // Reset animations
                fadeAnim.setValue(1);
                scaleAnim.setValue(1);
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
        ]
      );
    },
    [fadeAnim, scaleAnim]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFavorites();
  }, [fetchFavorites]);

  return {
    favorites,
    loading,
    refreshing,
    removingId,
    fadeAnim,
    scaleAnim,
    fetchFavorites,
    removeFavorite,
    handleRefresh,
  };
};
