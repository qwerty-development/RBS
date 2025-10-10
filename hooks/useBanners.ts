// hooks/useBanners.ts
import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/config/supabase";
import { EnrichedBanner } from "@/types/banners";
import { Database } from "@/types/supabase-generated";

type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
type SpecialOffer = Database["public"]["Tables"]["special_offers"]["Row"];

export function useBanners() {
  const [banners, setBanners] = useState<EnrichedBanner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enrich banner with related data and clickable info
  const enrichBanner = useCallback(
    async (
      banner: Database["public"]["Tables"]["banners"]["Row"],
    ): Promise<EnrichedBanner> => {
      let restaurant: Restaurant | null = null;
      let specialOffer: (SpecialOffer & { restaurant: Restaurant }) | null =
        null;
      let clickType: "restaurant" | "offer" | "none" = "none";
      let isClickable = false;

      // Fetch restaurant if restaurant_id exists
      if (banner.restaurant_id) {
        const { data: restaurantData } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", banner.restaurant_id)
          .eq("status", "active")
          .single();

        restaurant = restaurantData;
        if (restaurant) {
          clickType = "restaurant";
          isClickable = true;
        }
      }
      // Fetch special offer with restaurant if special_offer_id exists
      else if (banner.special_offer_id) {
        const { data: offerData } = await supabase
          .from("special_offers")
          .select(
            `
            *,
            restaurant:restaurants(*)
          `,
          )
          .eq("id", banner.special_offer_id)
          .single();

        if (offerData) {
          specialOffer = offerData as SpecialOffer & { restaurant: Restaurant };
          clickType = "offer";
          isClickable = true;
        }
      }

      return {
        ...banner,
        restaurant,
        special_offer: specialOffer,
        isClickable,
        clickType,
      };
    },
    [],
  );

  // Fetch all active banners
  const fetchBanners = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();

      // Fetch active banners
      const { data: bannersData, error: bannersError } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .or(`valid_from.is.null,valid_from.lte.${now}`)
        .or(`valid_until.is.null,valid_until.gte.${now}`)
        .order("display_order", { ascending: true });

      if (bannersError) throw bannersError;

      if (!bannersData || bannersData.length === 0) {
        setBanners([]);
        return;
      }

      // Enrich each banner with related data
      const enrichedBanners = await Promise.all(
        bannersData.map((banner) => enrichBanner(banner)),
      );

      setBanners(enrichedBanners);
    } catch (err: any) {
      console.error("Error fetching banners:", err);
      setError(err.message || "Failed to load banners");
      setBanners([]);
    } finally {
      setLoading(false);
    }
  }, [enrichBanner]);

  // Load banners on mount
  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  return {
    banners,
    loading,
    error,
    refetch: fetchBanners,
  };
}
