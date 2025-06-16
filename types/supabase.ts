// types/supabase.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone_number: string | null;
          avatar_url: string | null;
          allergies: string[] | null;
          favorite_cuisines: string[] | null;
          dietary_restrictions: string[] | null;
          preferred_party_size: number | null;
          notification_preferences: {
            email: boolean;
            push: boolean;
            sms: boolean;
          } | null;
          loyalty_points: number;
          membership_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
          push_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone_number?: string | null;
          avatar_url?: string | null;
          allergies?: string[] | null;
          favorite_cuisines?: string[] | null;
          dietary_restrictions?: string[] | null;
          preferred_party_size?: number | null;
          notification_preferences?: {
            email: boolean;
            push: boolean;
            sms: boolean;
          } | null;
          loyalty_points?: number;
          membership_tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
          push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone_number?: string | null;
          avatar_url?: string | null;
          allergies?: string[] | null;
          favorite_cuisines?: string[] | null;
          dietary_restrictions?: string[] | null;
          preferred_party_size?: number | null;
          notification_preferences?: {
            email: boolean;
            push: boolean;
            sms: boolean;
          } | null;
          loyalty_points?: number;
          membership_tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
          push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      restaurants: {
        Row: {
          id: string;
          name: string;
          description: string;
          address: string;
          location: {
            type: 'Point';
            coordinates: [number, number]; // [longitude, latitude]
          };
          main_image_url: string;
          image_urls: string[] | null;
          cuisine_type: string;
          tags: string[] | null;
          opening_time: string;
          closing_time: string;
          booking_policy: 'instant' | 'request';
          price_range: number; // 1-4
          average_rating: number;
          total_reviews: number;
          phone_number: string | null;
          whatsapp_number: string | null;
          instagram_handle: string | null;
          website_url: string | null;
          menu_url: string | null;
          dietary_options: string[] | null;
          ambiance_tags: string[] | null;
          parking_available: boolean;
          valet_parking: boolean;
          outdoor_seating: boolean;
          shisha_available: boolean;
          live_music_schedule: Record<string, boolean> | null;
          happy_hour_times: { start: string; end: string } | null;
          booking_window_days: number;
          cancellation_window_hours: number;
          table_turnover_minutes: number;
          featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          address: string;
          location: {
            type: 'Point';
            coordinates: [number, number];
          };
          main_image_url: string;
          image_urls?: string[] | null;
          cuisine_type: string;
          tags?: string[] | null;
          opening_time: string;
          closing_time: string;
          booking_policy: 'instant' | 'request';
          price_range: number;
          average_rating?: number;
          total_reviews?: number;
          phone_number?: string | null;
          whatsapp_number?: string | null;
          instagram_handle?: string | null;
          website_url?: string | null;
          menu_url?: string | null;
          dietary_options?: string[] | null;
          ambiance_tags?: string[] | null;
          parking_available?: boolean;
          valet_parking?: boolean;
          outdoor_seating?: boolean;
          shisha_available?: boolean;
          live_music_schedule?: Record<string, boolean> | null;
          happy_hour_times?: { start: string; end: string } | null;
          booking_window_days?: number;
          cancellation_window_hours?: number;
          table_turnover_minutes?: number;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          address?: string;
          location?: {
            type: 'Point';
            coordinates: [number, number];
          };
          main_image_url?: string;
          image_urls?: string[] | null;
          cuisine_type?: string;
          tags?: string[] | null;
          opening_time?: string;
          closing_time?: string;
          booking_policy?: 'instant' | 'request';
          price_range?: number;
          average_rating?: number;
          total_reviews?: number;
          phone_number?: string | null;
          whatsapp_number?: string | null;
          instagram_handle?: string | null;
          website_url?: string | null;
          menu_url?: string | null;
          dietary_options?: string[] | null;
          ambiance_tags?: string[] | null;
          parking_available?: boolean;
          valet_parking?: boolean;
          outdoor_seating?: boolean;
          shisha_available?: boolean;
          live_music_schedule?: Record<string, boolean> | null;
          happy_hour_times?: { start: string; end: string } | null;
          booking_window_days?: number;
          cancellation_window_hours?: number;
          table_turnover_minutes?: number;
          featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string;
          booking_time: string;
          party_size: number;
          status: 'pending' | 'confirmed' | 'cancelled_by_user' | 'declined_by_restaurant' | 'completed' | 'no_show';
          special_requests: string | null;
          occasion: string | null;
          dietary_notes: string[] | null;
          table_preferences: string[] | null;
          confirmation_code: string;
          reminder_sent: boolean;
          checked_in_at: string | null;
          loyalty_points_earned: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id: string;
          booking_time: string;
          party_size: number;
          status: 'pending' | 'confirmed' | 'cancelled_by_user' | 'declined_by_restaurant' | 'completed' | 'no_show';
          special_requests?: string | null;
          occasion?: string | null;
          dietary_notes?: string[] | null;
          table_preferences?: string[] | null;
          confirmation_code?: string;
          reminder_sent?: boolean;
          checked_in_at?: string | null;
          loyalty_points_earned?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string;
          booking_time?: string;
          party_size?: number;
          status?: 'pending' | 'confirmed' | 'cancelled_by_user' | 'declined_by_restaurant' | 'completed' | 'no_show';
          special_requests?: string | null;
          occasion?: string | null;
          dietary_notes?: string[] | null;
          table_preferences?: string[] | null;
          confirmation_code?: string;
          reminder_sent?: boolean;
          checked_in_at?: string | null;
          loyalty_points_earned?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string;
          created_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          booking_id: string;
          user_id: string;
          restaurant_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          user_id: string;
          restaurant_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          user_id?: string;
          restaurant_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
      };
      restaurant_availability: {
        Row: {
          id: string;
          restaurant_id: string;
          date: string;
          time_slot: string;
          total_capacity: number;
          available_capacity: number;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          date: string;
          time_slot: string;
          total_capacity: number;
          available_capacity: number;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          date?: string;
          time_slot?: string;
          total_capacity?: number;
          available_capacity?: number;
        };
      };
      waitlist: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string;
          desired_date: string;
          desired_time_range: string;
          party_size: number;
          status: 'active' | 'notified' | 'booked' | 'expired';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id: string;
          desired_date: string;
          desired_time_range: string;
          party_size: number;
          status?: 'active' | 'notified' | 'booked' | 'expired';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string;
          desired_date?: string;
          desired_time_range?: string;
          party_size?: number;
          status?: 'active' | 'notified' | 'booked' | 'expired';
          created_at?: string;
        };
      };
      social_connections: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: 'pending' | 'accepted' | 'blocked';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: 'pending' | 'accepted' | 'blocked';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_id?: string;
          status?: 'pending' | 'accepted' | 'blocked';
          created_at?: string;
        };
      };
      shared_bookings: {
        Row: {
          id: string;
          booking_id: string;
          shared_with_user_id: string;
          accepted: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          shared_with_user_id: string;
          accepted?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          shared_with_user_id?: string;
          accepted?: boolean;
          created_at?: string;
        };
      };
      special_offers: {
        Row: {
          id: string;
          restaurant_id: string;
          title: string;
          description: string | null;
          discount_percentage: number;
          valid_from: string;
          valid_until: string;
          terms_conditions: string[] | null;
          minimum_party_size: number;
          applicable_days: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          title: string;
          description?: string | null;
          discount_percentage: number;
          valid_from: string;
          valid_until: string;
          terms_conditions?: string[] | null;
          minimum_party_size?: number;
          applicable_days?: number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          title?: string;
          description?: string | null;
          discount_percentage?: number;
          valid_from?: string;
          valid_until?: string;
          terms_conditions?: string[] | null;
          minimum_party_size?: number;
          applicable_days?: number[] | null;
          created_at?: string;
        };
      };
      user_offers: {
        Row: {
          id: string;
          user_id: string;
          offer_id: string;
          booking_id: string | null;
          claimed_at: string;
          used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          offer_id: string;
          booking_id?: string | null;
          claimed_at?: string;
          used_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          offer_id?: string;
          booking_id?: string | null;
          claimed_at?: string;
          used_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      update_restaurant_availability: {
        Args: {
          p_restaurant_id: string;
          p_date: string;
          p_time_slot: string;
          p_party_size: number;
        };
        Returns: void;
      };
      award_loyalty_points: {
        Args: {
          p_user_id: string;
          p_points: number;
        };
        Returns: void;
      };
      calculate_tier: {
        Args: {
          p_points: number;
        };
        Returns: 'bronze' | 'silver' | 'gold' | 'platinum';
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}