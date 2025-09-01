export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      booking_invites: {
        Row: {
          booking_id: string
          created_at: string | null
          from_user_id: string
          id: string
          message: string | null
          responded_at: string | null
          status: string
          to_user_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          from_user_id: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          to_user_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          from_user_id?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_invites_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "active_dining_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_invites_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_invites_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_bookings_with_tables"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "booking_invites_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "friends_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_invites_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_invites_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "friends_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_invites_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          ambiance_rating: number | null
          booking_id: string | null
          comment: string | null
          created_at: string | null
          food_rating: number | null
          id: string
          is_anonymous: boolean | null
          photos: string[] | null
          rating: number
          recommend_to_friend: boolean | null
          restaurant_id: string
          service_rating: number | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
          value_rating: number | null
          visit_again: boolean | null
        }
        Insert: {
          ambiance_rating?: number | null
          booking_id?: string | null
          comment?: string | null
          created_at?: string | null
          food_rating?: number | null
          id?: string
          is_anonymous?: boolean | null
          photos?: string[] | null
          rating: number
          recommend_to_friend?: boolean | null
          restaurant_id: string
          service_rating?: number | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
          value_rating?: number | null
          visit_again?: boolean | null
        }
        Update: {
          ambiance_rating?: number | null
          booking_id?: string | null
          comment?: string | null
          created_at?: string | null
          food_rating?: number | null
          id?: string
          is_anonymous?: boolean | null
          photos?: string[] | null
          rating?: number
          recommend_to_friend?: boolean | null
          restaurant_id?: string
          service_rating?: number | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
          value_rating?: number | null
          visit_again?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "active_dining_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "v_bookings_with_tables"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_hours_summary"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_loyalty_analytics"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "v_bookings_with_tables"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friends_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      special_offers: {
        Row: {
          created_at: string | null
          description: string | null
          discount_percentage: number | null
          discount_value: number | null
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          max_uses_per_user: number | null
          minimum_party_size: number | null
          minimum_spend: number | null
          offer_type: string
          restaurant_id: string | null
          terms_conditions: string[] | null
          title: string
          total_uses: number | null
          updated_at: string | null
          usage_limit: number | null
          valid_from: string | null
          valid_until: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          max_uses_per_user?: number | null
          minimum_party_size?: number | null
          minimum_spend?: number | null
          offer_type: string
          restaurant_id?: string | null
          terms_conditions?: string[] | null
          title: string
          total_uses?: number | null
          updated_at?: string | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          discount_value?: number | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          max_uses_per_user?: number | null
          minimum_party_size?: number | null
          minimum_spend?: number | null
          offer_type?: string
          restaurant_id?: string | null
          terms_conditions?: string[] | null
          title?: string
          total_uses?: number | null
          updated_at?: string | null
          usage_limit?: number | null
          valid_from?: string | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_offers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_hours_summary"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "special_offers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_loyalty_analytics"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "special_offers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_offers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "v_bookings_with_tables"
            referencedColumns: ["restaurant_id"]
          },
        ]
      }
      waitlist: {
        Row: {
          converted_booking_id: string | null
          created_at: string | null
          desired_date: string
          desired_time_range: string
          expires_at: string | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          notification_expires_at: string | null
          notified_at: string | null
          party_size: number
          restaurant_id: string
          special_requests: string | null
          status: Database["public"]["Enums"]["waiting_status"]
          table_type: Database["public"]["Enums"]["table_type"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          converted_booking_id?: string | null
          created_at?: string | null
          desired_date: string
          desired_time_range: string
          expires_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          notification_expires_at?: string | null
          notified_at?: string | null
          party_size: number
          restaurant_id: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["waiting_status"]
          table_type?: Database["public"]["Enums"]["table_type"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          converted_booking_id?: string | null
          created_at?: string | null
          desired_date?: string
          desired_time_range?: string
          expires_at?: string | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          notification_expires_at?: string | null
          notified_at?: string | null
          party_size?: number
          restaurant_id?: string
          special_requests?: string | null
          status?: Database["public"]["Enums"]["waiting_status"]
          table_type?: Database["public"]["Enums"]["table_type"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_converted_booking_fkey"
            columns: ["converted_booking_id"]
            isOneToOne: false
            referencedRelation: "active_dining_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_converted_booking_fkey"
            columns: ["converted_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_converted_booking_fkey"
            columns: ["converted_booking_id"]
            isOneToOne: false
            referencedRelation: "v_bookings_with_tables"
            referencedColumns: ["booking_id"]
          },
          {
            foreignKeyName: "waitlist_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_hours_summary"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "waitlist_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_loyalty_analytics"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "waitlist_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "v_bookings_with_tables"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friends_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          id: string
          name: string
          description: string | null
          image_url: string | null
          address: string
          location: unknown
          phone: string | null
          email: string | null
          website: string | null
          cuisine_type: string[]
          price_range: number
          created_at: string | null
          updated_at: string | null
          rating: number | null
          review_count: number | null
          opening_hours: Json | null
          closing_hours: Json | null
          features: string[] | null
          payment_methods: string[] | null
          dress_code: string | null
          parking_available: boolean | null
          reservation_policy: string | null
          cancellation_policy: string | null
          max_party_size: number | null
          advance_booking_limit: number | null
          same_day_booking: boolean | null
          auto_accept_bookings: boolean | null
          require_deposit: boolean | null
          deposit_amount: number | null
          deposit_policy: string | null
          loyalty_program_enabled: boolean | null
          loyalty_points_rate: number | null
          minimum_rating_required: number | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          image_url?: string | null
          address: string
          location: unknown
          phone?: string | null
          email?: string | null
          website?: string | null
          cuisine_type: string[]
          price_range: number
          created_at?: string | null
          updated_at?: string | null
          rating?: number | null
          review_count?: number | null
          opening_hours?: Json | null
          closing_hours?: Json | null
          features?: string[] | null
          payment_methods?: string[] | null
          dress_code?: string | null
          parking_available?: boolean | null
          reservation_policy?: string | null
          cancellation_policy?: string | null
          max_party_size?: number | null
          advance_booking_limit?: number | null
          same_day_booking?: boolean | null
          auto_accept_bookings?: boolean | null
          require_deposit?: boolean | null
          deposit_amount?: number | null
          deposit_policy?: string | null
          loyalty_program_enabled?: boolean | null
          loyalty_points_rate?: number | null
          minimum_rating_required?: number | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          image_url?: string | null
          address?: string
          location?: unknown
          phone?: string | null
          email?: string | null
          website?: string | null
          cuisine_type?: string[]
          price_range?: number
          created_at?: string | null
          updated_at?: string | null
          rating?: number | null
          review_count?: number | null
          opening_hours?: Json | null
          closing_hours?: Json | null
          features?: string[] | null
          payment_methods?: string[] | null
          dress_code?: string | null
          parking_available?: boolean | null
          reservation_policy?: string | null
          cancellation_policy?: string | null
          max_party_size?: number | null
          advance_booking_limit?: number | null
          same_day_booking?: boolean | null
          auto_accept_bookings?: boolean | null
          require_deposit?: boolean | null
          deposit_amount?: number | null
          deposit_policy?: string | null
          loyalty_program_enabled?: boolean | null
          loyalty_points_rate?: number | null
          minimum_rating_required?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          dietary_restrictions: string[] | null
          preferences: Json | null
          loyalty_points: number | null
          membership_tier: string | null
          user_rating: number | null
          created_at: string | null
          updated_at: string | null
          last_seen: string | null
          is_active: boolean | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          dietary_restrictions?: string[] | null
          preferences?: Json | null
          loyalty_points?: number | null
          membership_tier?: string | null
          user_rating?: number | null
          created_at?: string | null
          updated_at?: string | null
          last_seen?: string | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          dietary_restrictions?: string[] | null
          preferences?: Json | null
          loyalty_points?: number | null
          membership_tier?: string | null
          user_rating?: number | null
          created_at?: string | null
          updated_at?: string | null
          last_seen?: string | null
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          acceptance_attempted_at: string | null
          acceptance_failed_reason: string | null
          actual_end_time: string | null
          applied_loyalty_rule_id: string | null
          applied_offer_id: string | null
          attendees: number | null
          auto_declined: boolean | null
          booking_time: string
          checked_in_at: string | null
          confirmation_code: string | null
          created_at: string | null
          dietary_notes: string[] | null
          expected_loyalty_points: number | null
          guest_email: string | null
          guest_name: string | null
          guest_phone: string | null
          id: string
          is_group_booking: boolean | null
          loyalty_points_earned: number | null
          meal_progress: Json | null
          occasion: string | null
          organizer_id: string | null
          party_size: number
          reminder_sent: boolean | null
          request_expires_at: string | null
          restaurant_id: string
          seated_at: string | null
          source: string
          special_requests: string | null
          status: string
          suggested_alternative_tables: string[] | null
          suggested_alternative_time: string | null
          table_preferences: string[] | null
          turn_time_minutes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          acceptance_attempted_at?: string | null
          acceptance_failed_reason?: string | null
          actual_end_time?: string | null
          applied_loyalty_rule_id?: string | null
          applied_offer_id?: string | null
          attendees?: number | null
          auto_declined?: boolean | null
          booking_time: string
          checked_in_at?: string | null
          confirmation_code?: string | null
          created_at?: string | null
          dietary_notes?: string[] | null
          expected_loyalty_points?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_group_booking?: boolean | null
          loyalty_points_earned?: number | null
          meal_progress?: Json | null
          occasion?: string | null
          organizer_id?: string | null
          party_size: number
          reminder_sent?: boolean | null
          request_expires_at?: string | null
          restaurant_id: string
          seated_at?: string | null
          source?: string
          special_requests?: string | null
          status: string
          suggested_alternative_tables?: string[] | null
          suggested_alternative_time?: string | null
          table_preferences?: string[] | null
          turn_time_minutes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          acceptance_attempted_at?: string | null
          acceptance_failed_reason?: string | null
          actual_end_time?: string | null
          applied_loyalty_rule_id?: string | null
          applied_offer_id?: string | null
          attendees?: number | null
          auto_declined?: boolean | null
          booking_time?: string
          checked_in_at?: string | null
          confirmation_code?: string | null
          created_at?: string | null
          dietary_notes?: string[] | null
          expected_loyalty_points?: number | null
          guest_email?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          is_group_booking?: boolean | null
          loyalty_points_earned?: number | null
          meal_progress?: Json | null
          occasion?: string | null
          organizer_id?: string | null
          party_size?: number
          reminder_sent?: boolean | null
          request_expires_at?: string | null
          restaurant_id?: string
          seated_at?: string | null
          source?: string
          special_requests?: string | null
          status?: string
          suggested_alternative_tables?: string[] | null
          suggested_alternative_time?: string | null
          table_preferences?: string[] | null
          turn_time_minutes?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_applied_loyalty_rule_id_fkey"
            columns: ["applied_loyalty_rule_id"]
            isOneToOne: false
            referencedRelation: "restaurant_loyalty_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_applied_offer_id_fkey"
            columns: ["applied_offer_id"]
            isOneToOne: false
            referencedRelation: "special_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "friends_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_hours_summary"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurant_loyalty_analytics"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "v_bookings_with_tables"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "friends_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
    }
    Functions: {
    }
    Enums: {
      notification_type:
        | "booking_confirmation"
        | "booking_reminder"
        | "waiting_list_available"
        | "promotional_offer"
        | "admin_message"
      table_type: "any" | "indoor" | "outdoor" | "bar" | "private"
      waiting_status: "active" | "notified" | "booked" | "expired" | "cancelled"
    }
    CompositeTypes: {
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      notification_type: [
        "booking_confirmation",
        "booking_reminder",
        "waiting_list_available",
        "promotional_offer",
        "admin_message",
      ],
      table_type: ["any", "indoor", "outdoor", "bar", "private"],
      waiting_status: ["active", "notified", "booked", "expired", "cancelled"],
    },
  },
} as const
