import { Database } from "./supabase";

export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"] & {
  dietary_options?: string[];
  ambiance_tags?: string[];
  parking_available?: boolean;
  valet_parking?: boolean;
  outdoor_seating?: boolean;
  shisha_available?: boolean;
  live_music_schedule?: Record<string, boolean>;
  happy_hour_times?: { start: string; end: string };
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
  instagram_handle?: string;
  website_url?: string;
  whatsapp_number?: string;
  average_rating?: number;
  total_reviews?: number;
  review_summary?: {
    total_reviews: number;
    average_rating: number;
    rating_distribution: Record<string, number>;
    detailed_ratings: {
      food_avg: number;
      service_avg: number;
      ambiance_avg: number;
      value_avg: number;
    };
    recommendation_percentage: number;
  };
};

export type Review = Database["public"]["Tables"]["reviews"]["Row"] & {
  user: {
    full_name: string;
    avatar_url?: string;
  };
  food_rating?: number;
  service_rating?: number;
  ambiance_rating?: number;
  value_rating?: number;
  recommend_to_friend?: boolean;
  visit_again?: boolean;
  tags?: string[];
  photos?: string[];
};

export type SpecialOffer =
  Database["public"]["Tables"]["special_offers"]["Row"] & {
    restaurant: Restaurant;
    claimed?: boolean;
    used?: boolean;
    redemptionCode?: string;
    isExpired?: boolean;
    canUse?: boolean;
  };
