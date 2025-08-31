export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4";
  };
  public: {
    Tables: {
      booking_invites: {
        Row: {
          booking_id: string;
          created_at: string | null;
          from_user_id: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          status: string;
          to_user_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string | null;
          from_user_id: string;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          status?: string;
          to_user_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string | null;
          from_user_id?: string;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          status?: string;
          to_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_invites_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_invites_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_invites_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "booking_invites_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "friends_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_invites_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_invites_to_user_id_fkey";
            columns: ["to_user_id"];
            isOneToOne: false;
            referencedRelation: "friends_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_invites_to_user_id_fkey";
            columns: ["to_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_status_history: {
        Row: {
          booking_id: string;
          changed_at: string | null;
          changed_by: string | null;
          id: string;
          metadata: Json | null;
          new_status: string;
          old_status: string | null;
          reason: string | null;
        };
        Insert: {
          booking_id: string;
          changed_at?: string | null;
          changed_by?: string | null;
          id?: string;
          metadata?: Json | null;
          new_status: string;
          old_status?: string | null;
          reason?: string | null;
        };
        Update: {
          booking_id?: string;
          changed_at?: string | null;
          changed_by?: string | null;
          id?: string;
          metadata?: Json | null;
          new_status?: string;
          old_status?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_status_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "booking_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "friends_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_rating_config: {
        Row: {
          booking_policy: string;
          created_at: string | null;
          description: string;
          id: string;
          max_party_size: number | null;
          max_rating: number;
          min_rating: number;
          rating_tier: string;
        };
        Insert: {
          booking_policy: string;
          created_at?: string | null;
          description: string;
          id?: string;
          max_party_size?: number | null;
          max_rating: number;
          min_rating: number;
          rating_tier: string;
        };
        Update: {
          booking_policy?: string;
          created_at?: string | null;
          description?: string;
          id?: string;
          max_party_size?: number | null;
          max_rating?: number;
          min_rating?: number;
          rating_tier?: string;
        };
        Relationships: [];
      };
      user_rating_history: {
        Row: {
          booking_id: string | null;
          change_reason: string;
          created_at: string | null;
          id: string;
          new_rating: number;
          old_rating: number | null;
          user_id: string;
        };
        Insert: {
          booking_id?: string | null;
          change_reason: string;
          created_at?: string | null;
          id?: string;
          new_rating: number;
          old_rating?: number | null;
          user_id: string;
        };
        Update: {
          booking_id?: string | null;
          change_reason?: string;
          created_at?: string | null;
          id?: string;
          new_rating?: number;
          old_rating?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_rating_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "active_dining_bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rating_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rating_history_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["booking_id"];
          },
          {
            foreignKeyName: "user_rating_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "friends_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_rating_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_restaurant_blacklist: {
        Row: {
          blacklisted_at: string | null;
          blacklisted_by: string | null;
          expires_at: string | null;
          id: string;
          is_active: boolean | null;
          reason: string;
          restaurant_id: string;
          user_id: string;
        };
        Insert: {
          blacklisted_at?: string | null;
          blacklisted_by?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          reason: string;
          restaurant_id: string;
          user_id: string;
        };
        Update: {
          blacklisted_at?: string | null;
          blacklisted_by?: string | null;
          expires_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          reason?: string;
          restaurant_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_restaurant_blacklist_blacklisted_by_fkey";
            columns: ["blacklisted_by"];
            isOneToOne: false;
            referencedRelation: "friends_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_restaurant_blacklist_blacklisted_by_fkey";
            columns: ["blacklisted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_restaurant_blacklist_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "user_restaurant_blacklist_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "user_restaurant_blacklist_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_restaurant_blacklist_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "user_restaurant_blacklist_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "friends_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_restaurant_blacklist_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          acceptance_attempted_at: string | null;
          acceptance_failed_reason: string | null;
          actual_end_time: string | null;
          applied_loyalty_rule_id: string | null;
          applied_offer_id: string | null;
          attendees: number | null;
          auto_declined: boolean | null;
          booking_time: string;
          checked_in_at: string | null;
          confirmation_code: string | null;
          created_at: string | null;
          dietary_notes: string[] | null;
          expected_loyalty_points: number | null;
          guest_email: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          id: string;
          is_group_booking: boolean | null;
          loyalty_points_earned: number | null;
          meal_progress: Json | null;
          occasion: string | null;
          organizer_id: string | null;
          party_size: number;
          reminder_sent: boolean | null;
          request_expires_at: string | null;
          restaurant_id: string;
          seated_at: string | null;
          source: string;
          special_requests: string | null;
          status: string;
          suggested_alternative_tables: string[] | null;
          suggested_alternative_time: string | null;
          table_preferences: string[] | null;
          turn_time_minutes: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          acceptance_attempted_at?: string | null;
          acceptance_failed_reason?: string | null;
          actual_end_time?: string | null;
          applied_loyalty_rule_id?: string | null;
          applied_offer_id?: string | null;
          attendees?: number | null;
          auto_declined?: boolean | null;
          booking_time: string;
          checked_in_at?: string | null;
          confirmation_code?: string | null;
          created_at?: string | null;
          dietary_notes?: string[] | null;
          expected_loyalty_points?: number | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          is_group_booking?: boolean | null;
          loyalty_points_earned?: number | null;
          meal_progress?: Json | null;
          occasion?: string | null;
          organizer_id?: string | null;
          party_size: number;
          reminder_sent?: boolean | null;
          request_expires_at?: string | null;
          restaurant_id: string;
          seated_at?: string | null;
          source?: string;
          special_requests?: string | null;
          status: string;
          suggested_alternative_tables?: string[] | null;
          suggested_alternative_time?: string | null;
          table_preferences?: string[] | null;
          turn_time_minutes?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          acceptance_attempted_at?: string | null;
          acceptance_failed_reason?: string | null;
          actual_end_time?: string | null;
          applied_loyalty_rule_id?: string | null;
          applied_offer_id?: string | null;
          attendees?: number | null;
          auto_declined?: boolean | null;
          booking_time?: string;
          checked_in_at?: string | null;
          confirmation_code?: string | null;
          created_at?: string | null;
          dietary_notes?: string[] | null;
          expected_loyalty_points?: number | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          is_group_booking?: boolean | null;
          loyalty_points_earned?: number | null;
          meal_progress?: Json | null;
          occasion?: string | null;
          organizer_id?: string | null;
          party_size?: number;
          reminder_sent?: boolean | null;
          request_expires_at?: string | null;
          restaurant_id?: string;
          seated_at?: string | null;
          source?: string;
          special_requests?: string | null;
          status?: string;
          suggested_alternative_tables?: string[] | null;
          suggested_alternative_time?: string | null;
          table_preferences?: string[] | null;
          turn_time_minutes?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_applied_loyalty_rule_id_fkey";
            columns: ["applied_loyalty_rule_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_rules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_applied_offer_id_fkey";
            columns: ["applied_offer_id"];
            isOneToOne: false;
            referencedRelation: "special_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "friends_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_organizer_id_fkey";
            columns: ["organizer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_hours_summary";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurant_loyalty_analytics";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            isOneToOne: false;
            referencedRelation: "v_bookings_with_tables";
            referencedColumns: ["restaurant_id"];
          },
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "friends_view";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          created_at: string | null;
          updated_at: string | null;
          phone: string | null;
          date_of_birth: string | null;
          bio: string | null;
          location: Json | null;
          preferences: Json | null;
          membership_tier: string;
          total_loyalty_points: number;
          lifetime_bookings: number;
          user_rating: number;
          last_active_at: string | null;
          notification_settings: Json | null;
          is_active: boolean;
          guest_mode: boolean;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          bio?: string | null;
          location?: Json | null;
          preferences?: Json | null;
          membership_tier?: string;
          total_loyalty_points?: number;
          lifetime_bookings?: number;
          user_rating?: number;
          last_active_at?: string | null;
          notification_settings?: Json | null;
          is_active?: boolean;
          guest_mode?: boolean;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          phone?: string | null;
          date_of_birth?: string | null;
          bio?: string | null;
          location?: Json | null;
          preferences?: Json | null;
          membership_tier?: string;
          total_loyalty_points?: number;
          lifetime_bookings?: number;
          user_rating?: number;
          last_active_at?: string | null;
          notification_settings?: Json | null;
          is_active?: boolean;
          guest_mode?: boolean;
        };
        Relationships: [];
      };
      restaurants: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          address: string;
          location: unknown | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          cuisine_type: string[];
          price_range: string;
          rating: number;
          review_count: number;
          booking_policy: string;
          policies: Json | null;
          created_at: string | null;
          updated_at: string | null;
          is_active: boolean;
          turn_time_minutes: number;
          advance_booking_days: number;
          cancellation_policy: Json | null;
          dining_style: string[] | null;
          features: string[] | null;
          dress_code: string | null;
          age_restriction: string | null;
          operating_hours: Json | null;
          special_diets: string[] | null;
          payment_methods: string[] | null;
          social_media: Json | null;
          max_party_size: number;
          accepts_reservations: boolean;
          deposit_required: boolean;
          deposit_amount: number | null;
          availability_window: number;
          instant_booking_enabled: boolean;
          minimum_rating_required: number | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          address: string;
          location?: unknown | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          cuisine_type?: string[];
          price_range?: string;
          rating?: number;
          review_count?: number;
          booking_policy?: string;
          policies?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
          is_active?: boolean;
          turn_time_minutes?: number;
          advance_booking_days?: number;
          cancellation_policy?: Json | null;
          dining_style?: string[] | null;
          features?: string[] | null;
          dress_code?: string | null;
          age_restriction?: string | null;
          operating_hours?: Json | null;
          special_diets?: string[] | null;
          payment_methods?: string[] | null;
          social_media?: Json | null;
          max_party_size?: number;
          accepts_reservations?: boolean;
          deposit_required?: boolean;
          deposit_amount?: number | null;
          availability_window?: number;
          instant_booking_enabled?: boolean;
          minimum_rating_required?: number | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          address?: string;
          location?: unknown | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          cuisine_type?: string[];
          price_range?: string;
          rating?: number;
          review_count?: number;
          booking_policy?: string;
          policies?: Json | null;
          created_at?: string | null;
          updated_at?: string | null;
          is_active?: boolean;
          turn_time_minutes?: number;
          advance_booking_days?: number;
          cancellation_policy?: Json | null;
          dining_style?: string[] | null;
          features?: string[] | null;
          dress_code?: string | null;
          age_restriction?: string | null;
          operating_hours?: Json | null;
          special_diets?: string[] | null;
          payment_methods?: string[] | null;
          social_media?: Json | null;
          max_party_size?: number;
          accepts_reservations?: boolean;
          deposit_required?: boolean;
          deposit_amount?: number | null;
          availability_window?: number;
          instant_booking_enabled?: boolean;
          minimum_rating_required?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      friends_view: {
        Row: {
          avatar_url: string | null;
          email: string | null;
          full_name: string | null;
          id: string | null;
          membership_tier: string | null;
          user_rating: number | null;
        };
        Insert: {
          avatar_url?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string | null;
          membership_tier?: string | null;
          user_rating?: number | null;
        };
        Update: {
          avatar_url?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string | null;
          membership_tier?: string | null;
          user_rating?: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      calculate_user_rating: {
        Args: { user_id_param: string };
        Returns: number;
      };
      check_booking_eligibility: {
        Args: {
          party_size_param?: number;
          restaurant_id_param: string;
          user_id_param: string;
        };
        Returns: {
          can_book: boolean;
          forced_policy: string;
          restriction_reason: string;
          user_rating: number;
          user_tier: string;
        }[];
      };
      get_user_rating_tier: {
        Args: { user_rating_param: number };
        Returns: {
          booking_policy: string;
          description: string;
          max_party_size: number;
          tier: string;
        }[];
      };
      update_user_rating: {
        Args: {
          booking_id_param?: string;
          reason?: string;
          user_id_param: string;
        };
        Returns: number;
      };
      create_booking_with_tables: {
        Args: {
          p_applied_loyalty_rule_id?: string;
          p_applied_offer_id?: string;
          p_booking_policy?: string;
          p_booking_time: string;
          p_dietary_notes?: string[];
          p_expected_loyalty_points?: number;
          p_is_group_booking?: boolean;
          p_occasion?: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_special_requests?: string;
          p_table_ids?: string[];
          p_table_preferences?: string[];
          p_turn_time?: number;
          p_user_id: string;
        };
        Returns: Json;
      };
      get_available_tables: {
        Args: {
          p_end_time: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_start_time: string;
        };
        Returns: {
          capacity: number;
          is_combinable: boolean;
          max_capacity: number;
          min_capacity: number;
          priority_score: number;
          table_id: string;
          table_number: string;
          table_type: string;
        }[];
      };
      search_users: {
        Args: { search_query: string };
        Returns: {
          avatar_url: string;
          full_name: string;
          id: string;
          is_friend: boolean;
        }[];
      };
      toggle_favorite: {
        Args: { restaurant_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      notification_type:
        | "booking_confirmation"
        | "booking_reminder"
        | "waiting_list_available"
        | "promotional_offer"
        | "admin_message";
      table_type: "any" | "indoor" | "outdoor" | "bar" | "private";
      waiting_status:
        | "active"
        | "notified"
        | "booked"
        | "expired"
        | "cancelled";
    };
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null;
        geom: unknown | null;
      };
      valid_detail: {
        valid: boolean | null;
        reason: string | null;
        location: unknown | null;
      };
    };
  };
};

// Type aliases for easier usage
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
export type Functions<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T];

// Specific type exports for rating system
export type UserRatingConfig = Tables<"user_rating_config">;
export type UserRatingHistory = Tables<"user_rating_history">;
export type UserRestaurantBlacklist = Tables<"user_restaurant_blacklist">;
export type Profile = Tables<"profiles">;
export type Restaurant = Tables<"restaurants">;
export type Booking = Tables<"bookings">;

// Function return types
export type BookingEligibilityResult =
  Database["public"]["Functions"]["check_booking_eligibility"]["Returns"][0];
export type UserRatingTierResult =
  Database["public"]["Functions"]["get_user_rating_tier"]["Returns"][0];
export type CreateBookingResult =
  Database["public"]["Functions"]["create_booking_with_tables"]["Returns"];
