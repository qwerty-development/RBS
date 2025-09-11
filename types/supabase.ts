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
      blocked_users: {
        Row: {
          blocked_at: string | null;
          blocked_id: string;
          blocker_id: string;
          id: string;
          reason: string | null;
        };
        Insert: {
          blocked_at?: string | null;
          blocked_id: string;
          blocker_id: string;
          id?: string;
          reason?: string | null;
        };
        Update: {
          blocked_at?: string | null;
          blocked_id?: string;
          blocker_id?: string;
          id?: string;
          reason?: string | null;
        };
      };
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
      };
      booking_tables: {
        Row: {
          booking_id: string;
          created_at: string | null;
          id: string;
          seats_occupied: number;
          table_id: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string | null;
          id?: string;
          seats_occupied?: number;
          table_id: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string | null;
          id?: string;
          seats_occupied?: number;
          table_id?: string;
        };
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
          is_shared_booking: boolean | null;
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
          is_shared_booking?: boolean | null;
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
          is_shared_booking?: boolean | null;
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
      };
      favorites: {
        Row: {
          created_at: string | null;
          id: string;
          restaurant_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          restaurant_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          restaurant_id?: string;
          user_id?: string;
        };
      };
      friend_requests: {
        Row: {
          created_at: string | null;
          from_user_id: string;
          id: string;
          message: string | null;
          status: string;
          to_user_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          from_user_id: string;
          id?: string;
          message?: string | null;
          status?: string;
          to_user_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          from_user_id?: string;
          id?: string;
          message?: string | null;
          status?: string;
          to_user_id?: string;
          updated_at?: string | null;
        };
      };
      friends: {
        Row: {
          friend_id: string;
          friendship_date: string | null;
          id: string;
          user_id: string;
        };
        Insert: {
          friend_id: string;
          friendship_date?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          friend_id?: string;
          friendship_date?: string | null;
          id?: string;
          user_id?: string;
        };
      };
      loyalty_activities: {
        Row: {
          activity_type: string;
          created_at: string | null;
          description: string | null;
          id: string;
          metadata: Json | null;
          points_earned: number;
          points_multiplier: number | null;
          related_booking_id: string | null;
          related_review_id: string | null;
          user_id: string;
        };
        Insert: {
          activity_type: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          points_earned: number;
          points_multiplier?: number | null;
          related_booking_id?: string | null;
          related_review_id?: string | null;
          user_id: string;
        };
        Update: {
          activity_type?: string;
          created_at?: string | null;
          description?: string | null;
          id?: string;
          metadata?: Json | null;
          points_earned?: number;
          points_multiplier?: number | null;
          related_booking_id?: string | null;
          related_review_id?: string | null;
          user_id?: string;
        };
      };
      notifications: {
        Row: {
          category: string | null;
          created_at: string | null;
          data: Json | null;
          deeplink: string | null;
          id: string;
          message: string;
          read: boolean | null;
          read_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          data?: Json | null;
          deeplink?: string | null;
          id?: string;
          message: string;
          read?: boolean | null;
          read_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          data?: Json | null;
          deeplink?: string | null;
          id?: string;
          message?: string;
          read?: boolean | null;
          read_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
      };
      playlist_items: {
        Row: {
          created_at: string | null;
          id: string;
          notes: string | null;
          playlist_id: string;
          position: number;
          restaurant_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          playlist_id: string;
          position?: number;
          restaurant_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          playlist_id?: string;
          position?: number;
          restaurant_id?: string;
          updated_at?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string | null;
          phone_number: string | null;
          date_of_birth: string | null;
          dietary_preferences: string[] | null;
          loyalty_points: number;
          membership_tier: "bronze" | "silver" | "gold" | "platinum";
          total_bookings: number;
          cancelled_bookings: number;
          no_shows: number;
          user_rating: number;
          last_activity_date: string | null;
          push_notifications_enabled: boolean;
          email_notifications_enabled: boolean;
          location: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          phone_number?: string | null;
          date_of_birth?: string | null;
          dietary_preferences?: string[] | null;
          loyalty_points?: number;
          membership_tier?: "bronze" | "silver" | "gold" | "platinum";
          total_bookings?: number;
          cancelled_bookings?: number;
          no_shows?: number;
          user_rating?: number;
          last_activity_date?: string | null;
          push_notifications_enabled?: boolean;
          email_notifications_enabled?: boolean;
          location?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          phone_number?: string | null;
          date_of_birth?: string | null;
          dietary_preferences?: string[] | null;
          loyalty_points?: number;
          membership_tier?: "bronze" | "silver" | "gold" | "platinum";
          total_bookings?: number;
          cancelled_bookings?: number;
          no_shows?: number;
          user_rating?: number;
          last_activity_date?: string | null;
          push_notifications_enabled?: boolean;
          email_notifications_enabled?: boolean;
          location?: string | null;
        };
      };
      restaurant_playlists: {
        Row: {
          created_at: string | null;
          description: string | null;
          emoji: string | null;
          id: string;
          is_public: boolean;
          name: string;
          share_code: string | null;
          updated_at: string | null;
          user_id: string;
          view_count: number;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          emoji?: string | null;
          id?: string;
          is_public?: boolean;
          name: string;
          share_code?: string | null;
          updated_at?: string | null;
          user_id: string;
          view_count?: number;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          emoji?: string | null;
          id?: string;
          is_public?: boolean;
          name?: string;
          share_code?: string | null;
          updated_at?: string | null;
          user_id?: string;
          view_count?: number;
        };
      };
      restaurant_tables: {
        Row: {
          capacity: number;
          created_at: string | null;
          floor_plan_id: string | null;
          id: string;
          is_active: boolean;
          is_combinable: boolean;
          max_capacity: number;
          min_capacity: number;
          priority_score: number;
          restaurant_id: string;
          table_number: string;
          table_type: string;
          updated_at: string | null;
          x_position: number | null;
          y_position: number | null;
        };
        Insert: {
          capacity?: number;
          created_at?: string | null;
          floor_plan_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_combinable?: boolean;
          max_capacity?: number;
          min_capacity?: number;
          priority_score?: number;
          restaurant_id: string;
          table_number: string;
          table_type?: string;
          updated_at?: string | null;
          x_position?: number | null;
          y_position?: number | null;
        };
        Update: {
          capacity?: number;
          created_at?: string | null;
          floor_plan_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_combinable?: boolean;
          max_capacity?: number;
          min_capacity?: number;
          priority_score?: number;
          restaurant_id?: string;
          table_number?: string;
          table_type?: string;
          updated_at?: string | null;
          x_position?: number | null;
          y_position?: number | null;
        };
      };
      restaurants: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          name: string;
          description: string | null;
          cuisine_type: string[];
          price_range: "$" | "$$" | "$$$" | "$$$$";
          address: string;
          phone: string | null;
          email: string | null;
          website: string | null;
          hours: Json;
          rating: number | null;
          review_count: number;
          image_url: string | null;
          images: string[];
          features: string[];
          location: unknown | null;
          capacity: number;
          booking_lead_time: number;
          max_party_size: number;
          is_active: boolean;
          requires_approval: boolean;
          turn_time_minutes: number;
          accepts_reservations: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name: string;
          description?: string | null;
          cuisine_type?: string[];
          price_range?: "$" | "$$" | "$$$" | "$$$$";
          address: string;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          hours?: Json;
          rating?: number | null;
          review_count?: number;
          image_url?: string | null;
          images?: string[];
          features?: string[];
          location?: unknown | null;
          capacity?: number;
          booking_lead_time?: number;
          max_party_size?: number;
          is_active?: boolean;
          requires_approval?: boolean;
          turn_time_minutes?: number;
          accepts_reservations?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          name?: string;
          description?: string | null;
          cuisine_type?: string[];
          price_range?: "$" | "$$" | "$$$" | "$$$$";
          address?: string;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          hours?: Json;
          rating?: number | null;
          review_count?: number;
          image_url?: string | null;
          images?: string[];
          features?: string[];
          location?: unknown | null;
          capacity?: number;
          booking_lead_time?: number;
          max_party_size?: number;
          is_active?: boolean;
          requires_approval?: boolean;
          turn_time_minutes?: number;
          accepts_reservations?: boolean;
        };
      };
      reviews: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          restaurant_id: string;
          user_id: string;
          booking_id: string | null;
          rating: number;
          comment: string | null;
          images: string[];
          helpful_count: number;
          response_from_owner: string | null;
          is_verified: boolean;
          visit_date: string | null;
          tags: string[];
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          restaurant_id: string;
          user_id: string;
          booking_id?: string | null;
          rating: number;
          comment?: string | null;
          images?: string[];
          helpful_count?: number;
          response_from_owner?: string | null;
          is_verified?: boolean;
          visit_date?: string | null;
          tags?: string[];
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          restaurant_id?: string;
          user_id?: string;
          booking_id?: string | null;
          rating?: number;
          comment?: string | null;
          images?: string[];
          helpful_count?: number;
          response_from_owner?: string | null;
          is_verified?: boolean;
          visit_date?: string | null;
          tags?: string[];
        };
      };
      review_replies: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          review_id: string;
          user_id: string;
          comment: string;
          is_owner_reply: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          review_id: string;
          user_id: string;
          comment: string;
          is_owner_reply?: boolean;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          review_id?: string;
          user_id?: string;
          comment?: string;
          is_owner_reply?: boolean;
        };
      };
      waitlist: {
        Row: {
          converted_booking_id: string | null;
          created_at: string | null;
          desired_date: string;
          desired_time_range: string;
          expires_at: string | null;
          guest_email: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          id: string;
          notification_expires_at: string | null;
          notified_at: string | null;
          party_size: number;
          restaurant_id: string;
          special_requests: string | null;
          status: Database["public"]["Enums"]["waiting_status"];
          table_type: Database["public"]["Enums"]["table_type"];
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          converted_booking_id?: string | null;
          created_at?: string | null;
          desired_date: string;
          desired_time_range: string;
          expires_at?: string | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          notification_expires_at?: string | null;
          notified_at?: string | null;
          party_size: number;
          restaurant_id: string;
          special_requests?: string | null;
          status?: Database["public"]["Enums"]["waiting_status"];
          table_type?: Database["public"]["Enums"]["table_type"];
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          converted_booking_id?: string | null;
          created_at?: string | null;
          desired_date?: string;
          desired_time_range?: string;
          expires_at?: string | null;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          notification_expires_at?: string | null;
          notified_at?: string | null;
          party_size?: number;
          restaurant_id?: string;
          special_requests?: string | null;
          status?: Database["public"]["Enums"]["waiting_status"];
          table_type?: Database["public"]["Enums"]["table_type"];
          updated_at?: string | null;
          user_id?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      notification_type:
        | "booking_confirmation"
        | "booking_reminder"
        | "waiting_list_available"
        | "promotional_offer"
        | "admin_message";
      restaurant_tier: "basic" | "pro";
      table_type: "any" | "indoor" | "outdoor" | "bar" | "private";
      tier: "basic" | "pro";
      waiting_status:
        | "active"
        | "notified"
        | "booked"
        | "expired"
        | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never;
