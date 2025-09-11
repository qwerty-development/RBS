// hooks/useRestaurants.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"] & {
  restaurant: Restaurant;
};

interface RestaurantWithCoordinates extends Restaurant {
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface UseRestaurantsOptions {
  location?: { latitude: number; longitude: number } | null;
  limit?: number;
  featured?: boolean;
  cuisineType?: string;
  minRating?: number;
}

export function useRestaurants(options: UseRestaurantsOptions = {}) {
  const { location, limit = 10, featured, cuisineType, minRating } = options;

  const [featuredRestaurants, setFeaturedRestaurants] = useState<
    RestaurantWithCoordinates[]
  >([]);
  const [recentlyBooked, setRecentlyBooked] = useState<
    RestaurantWithCoordinates[]
  >([]);
  const [specialOffers, setSpecialOffers] = useState<SpecialOffer[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<
    RestaurantWithCoordinates[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeaturedRestaurants = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc(
        "get_restaurants_with_coordinates",
        {
          p_limit: limit,
          p_featured: featured,
          p_cuisine_type: cuisineType,
          p_min_rating: minRating,
        },
      );

      if (error) throw error;

      // Transform data to include coordinates property
      const transformedData =
        (data as any[])?.map((restaurant: any) => ({
          ...restaurant,
          coordinates:
            restaurant.latitude && restaurant.longitude
              ? {
                  latitude: restaurant.latitude,
                  longitude: restaurant.longitude,
                }
              : undefined,
        })) || [];

      if (featured || cuisineType || minRating) {
        setAllRestaurants(transformedData);
      } else {
        setFeaturedRestaurants(transformedData);
      }
    } catch (err) {
      console.error("Error fetching restaurants:", err);
      setError("Failed to load restaurants");
    }
  }, [limit, featured, cuisineType, minRating]);

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
    allRestaurants, // Added this for direct restaurant queries
    loading,
    error,
    refetch,
    fetchRecentlyBooked,
  };
}
