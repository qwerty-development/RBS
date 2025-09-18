// hooks/useRestaurantSections.ts
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { Database } from "@/types/supabase";

// Types
type RestaurantSection =
  Database["public"]["Tables"]["restaurant_sections"]["Row"];

interface UseRestaurantSectionsReturn {
  sections: RestaurantSection[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRestaurantSections(
  restaurantId: string | undefined,
): UseRestaurantSectionsReturn {
  const [sections, setSections] = useState<RestaurantSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSections = async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("restaurant_sections")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (fetchError) {
        console.error("Error fetching restaurant sections:", fetchError);
        setError("Failed to load restaurant sections");
        return;
      }

      setSections(data || []);
    } catch (err) {
      console.error("Unexpected error fetching restaurant sections:", err);
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    await fetchSections();
  };

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    fetchSections();
  }, [restaurantId]); // Simplified dependency

  return {
    sections,
    loading,
    error,
    refresh,
  };
}
