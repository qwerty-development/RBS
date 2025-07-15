// hooks/useRestaurants.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant: Restaurant;
};

interface UseRestaurantsOptions {
  location?: { latitude: number; longitude: number } | null;
  limit?: number;
}

export function useRestaurants(options: UseRestaurantsOptions = {}) {
  const { location, limit = 10 } = options;

  const [featuredRestaurants, setFeaturedRestaurants] = useState<Restaurant[]>(
    [],
  );
  const [recentlyBooked, setRecentlyBooked] = useState<Restaurant[]>([]);
  const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeaturedRestaurants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("featured", true)
        .gte("average_rating", 4.0)
        .order("average_rating", { ascending: false })
        .limit(limit);

      if (error) throw error;
      setFeaturedRestaurants(data || []);
    } catch (err) {
      console.error("Error fetching featured restaurants:", err);
      setError("Failed to load featured restaurants");
    }
  }, [limit]);

  const fetchRecentlyBooked = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("restaurant:restaurants(*)")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("booking_time", { ascending: false })
        .limit(5);

      if (error) throw error;

      // Extract unique restaurants
      const uniqueRestaurants = new Map();
      data?.forEach((booking) => {
        if (booking.restaurant) {
          uniqueRestaurants.set(booking.restaurant.id, booking.restaurant);
        }
      });

      setRecentlyBooked(Array.from(uniqueRestaurants.values()).slice(0, 4));
    } catch (err) {
      console.error("Error fetching recently booked:", err);
    }
  }, []);

  const fetchSpecialOffers = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("special_offers")
        .select(
          `
          *,
          restaurant:restaurants(*)
        `,
        )
        .lte("valid_from", now)
        .gte("valid_until", now)
        .order("discount_percentage", { ascending: false })
        .limit(5);

      if (error) throw error;
      setSpecialOffers(data || []);
    } catch (err) {
      console.error("Error fetching special offers:", err);
    }
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    await Promise.all([
      fetchFeaturedRestaurants(),
      fetchSpecialOffers(),
      // fetchRecentlyBooked would need user ID
    ]);

    setLoading(false);
  }, [fetchFeaturedRestaurants, fetchSpecialOffers]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    featuredRestaurants,
    recentlyBooked,
    specialOffers,
    loading,
    error,
    refetch,
    fetchRecentlyBooked,
  };
}
