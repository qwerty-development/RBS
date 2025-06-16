// hooks/useRestaurant.ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";
import { useAuth } from "@/context/supabase-provider";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string;
  };
};

export function useRestaurant(restaurantId: string) {
  const { profile } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurantDetails = useCallback(async () => {
    try {
      // Fetch restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();
      
      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);
      
      // Check favorite status
      if (profile?.id) {
        const { data: favoriteData } = await supabase
          .from("favorites")
          .select("id")
          .eq("user_id", profile.id)
          .eq("restaurant_id", restaurantId)
          .single();
        
        setIsFavorite(!!favoriteData);
      }
      
      // Fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select(`
          *,
          user:profiles (
            full_name,
            avatar_url
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (reviewsError) throw reviewsError;
      setReviews(reviewsData || []);
      
    } catch (err) {
      console.error("Error fetching restaurant:", err);
      setError("Failed to load restaurant details");
    } finally {
      setLoading(false);
    }
  }, [restaurantId, profile?.id]);

  const toggleFavorite = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", profile.id)
          .eq("restaurant_id", restaurantId);
        
        if (error) throw error;
        setIsFavorite(false);
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: profile.id,
            restaurant_id: restaurantId,
          });
        
        if (error) throw error;
        setIsFavorite(true);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  }, [profile?.id, restaurantId, isFavorite]);

  useEffect(() => {
    fetchRestaurantDetails();
  }, [fetchRestaurantDetails]);

  return {
    restaurant,
    reviews,
    isFavorite,
    loading,
    error,
    toggleFavorite,
    refresh: fetchRestaurantDetails,
  };
}