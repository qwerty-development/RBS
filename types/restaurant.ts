// types/restaurant.ts
import { Database } from "./supabase";

// Create a type alias for the database restaurant type
type DatabaseRestaurant = Database["public"]["Tables"]["restaurants"]["Row"];

// Use the database restaurant type as the base and extend it with additional fields
export interface Restaurant extends DatabaseRestaurant {
  // Legacy/computed fields for backward compatibility
  main_image_url?: string | null; // Maps to image_url
  image_urls?: string[];
  tags?: string[];
  opening_time?: string; // Legacy field - use opening_hours instead
  closing_time?: string; // Legacy field - use closing_hours instead
  booking_policy?: "instant" | "request";
  booking_window_days?: number;
  cancellation_window_hours?: number;
  table_turnover_minutes?: number;
  min_party_size?: number;
  average_rating?: number;
  total_reviews?: number;
  phone_number?: string; // Maps to phone
  whatsapp_number?: string;
  website_url?: string; // Maps to website
  instagram_handle?: string;
  valet_parking?: boolean;
  outdoor_seating?: boolean;
  shisha_available?: boolean;
  live_entertainment?: boolean;
  wifi_available?: boolean;
  dietary_options?: string[];
  special_features?: string[];

  // Computed/location fields - override the database location type
  location: {
    lat: number;
    lng: number;
  } | unknown;
  staticCoordinates?: { lat: number; lng: number };
  coordinates?: { latitude: number; longitude: number };

  // Relations
  restaurant_hours?: RestaurantHours[];
  restaurant_special_hours?: SpecialHours[];
  restaurant_closures?: Closure[];
  restaurant_tables?: RestaurantTable[];
  reviews?: any[];
  special_offers?: any[];
}

export interface RestaurantHours {
  id: string;
  restaurant_id: string;
  day_of_week: string;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  created_at: string;
  updated_at: string;
}

// Helper interface for working with multiple shifts
export interface DayShifts {
  day: string;
  shifts: {
    open: string;
    close: string;
  }[];
  isOpen: boolean;
}

export interface SpecialHours {
  id: string;
  restaurant_id: string;
  date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  reason: string | null;
  created_at: string;
  created_by: string;
}

export interface Closure {
  id: string;
  restaurant_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
  created_by: string;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  table_type: "booth" | "window" | "patio" | "standard" | "bar" | "private";
  capacity: number;
  min_capacity: number;
  max_capacity: number;
  x_position: number;
  y_position: number;
  shape: "rectangle" | "circle" | "square";
  width: number;
  height: number;
  is_active: boolean;
  features: string[];
  is_combinable: boolean;
  combinable_with: string[];
  priority_score: number;
  created_at: string;
}
