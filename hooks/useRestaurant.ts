// hooks/useRestaurant.ts
import { useState, useCallback, useEffect, useMemo } from "react";
import { Alert, Share, Platform, Linking } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";
import { Database } from "@/types/supabase";
import { AvailabilityService, TimeSlot } from "@/lib/AvailabilityService";
import { MenuItem } from "@/types/menu";

// Core Types
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  // ... (restaurant properties)
};

type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string | null;
  };
};

// ... (other types)

interface UseRestaurantReturn {
  // ... (return properties)
  menu: MenuItem[];
}

export function useRestaurant(
  restaurantId: string | undefined
): UseRestaurantReturn {
  const router = useRouter();
  const { profile } = useAuth();

  // Core state
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // ... (helper functions)

  // Main data fetching
  const fetchRestaurantDetails = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    try {
      // ... (fetch restaurant details)

      // Fetch menu
      const { data: menuData, error: menuError } = await supabase
        .from("menu_items")
        .select("*, menu_categories(*)")
        .eq("restaurant_id", restaurantId)
        .order("order", { foreignTable: "menu_categories", ascending: true })
        .order("name", { ascending: true });

      if (menuError) {
        console.warn("Menu fetch error:", menuError);
      } else {
        setMenu(menuData || []);
      }
    } catch (error) {
      console.error("Error fetching restaurant details:", error);
      Alert.alert("Error", "Failed to load restaurant details");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, profile?.id, calculateReviewSummary]);

  // Real-time updates
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`restaurant:${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurants", filter: `id=eq.${restaurantId}` },
        () => fetchRestaurantDetails()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews", filter: `restaurant_id=eq.${restaurantId}` },
        () => fetchRestaurantDetails()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${restaurantId}` },
        () => fetchRestaurantDetails()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, fetchRestaurantDetails]);

  // ... (rest of the hook)

  return {
    // ... (return properties)
    menu,
  };
}