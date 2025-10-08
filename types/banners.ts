// types/banners.ts
import { Database } from "./supabase-generated";

// Base banner type from database
export type Banner = Database["public"]["Tables"]["banners"]["Row"];

// Enriched banner with related data
export interface EnrichedBanner extends Banner {
  restaurant?: Database["public"]["Tables"]["restaurants"]["Row"] | null;
  special_offer?:
    | (Database["public"]["Tables"]["special_offers"]["Row"] & {
        restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
      })
    | null;
  isClickable: boolean;
  clickType: "restaurant" | "offer" | "none";
}

// Banner with restaurant joined
export interface BannerWithRestaurant extends Banner {
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
}

// Banner with offer joined
export interface BannerWithOffer extends Banner {
  special_offer: Database["public"]["Tables"]["special_offers"]["Row"] & {
    restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
  };
}
