// types/supabase.ts
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
            preferred_party_size: number;
            notification_preferences: {
              email: boolean;
              push: boolean;
              sms: boolean;
            };
            loyalty_points: number;
            membership_tier: 'bronze' | 'silver' | 'gold' | 'platinum';
            created_at: string;
            updated_at: string;
          };
          Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
          Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        };
        restaurants: {
          Row: {
            id: string;
            name: string;
            description: string | null;
            address: string;
            location: { lat: number; lng: number };
            main_image_url: string | null;
            image_urls: string[] | null;
            cuisine_type: string;
            tags: string[] | null;
            opening_time: string;
            closing_time: string;
            booking_policy: 'instant' | 'request';
            price_range: 1 | 2 | 3 | 4;
            average_rating: number;
            total_reviews: number;
            phone_number: string | null;
            whatsapp_number: string | null;
            instagram_handle: string | null;
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
            created_at: string;
            updated_at: string;
          };
          Insert: Omit<Database['public']['Tables']['restaurants']['Row'], 'id' | 'created_at' | 'updated_at' | 'average_rating' | 'total_reviews'>;
          Update: Partial<Database['public']['Tables']['restaurants']['Insert']>;
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
            confirmation_code: string;
            table_preferences: string[] | null;
            reminder_sent: boolean;
            checked_in_at: string | null;
            loyalty_points_earned: number;
            created_at: string;
            updated_at: string;
            restaurant?: Database['public']['Tables']['restaurants']['Row'];
            user?: Database['public']['Tables']['profiles']['Row'];
          };
          Insert: Omit<Database['public']['Tables']['bookings']['Row'], 'id' | 'created_at' | 'updated_at' | 'confirmation_code' | 'reminder_sent' | 'restaurant' | 'user'>;
          Update: Partial<Database['public']['Tables']['bookings']['Insert']>;
        };
        favorites: {
          Row: {
            id: string;
            user_id: string;
            restaurant_id: string;
            created_at: string;
          };
          Insert: Omit<Database['public']['Tables']['favorites']['Row'], 'id' | 'created_at'>;
          Update: Partial<Database['public']['Tables']['favorites']['Insert']>;
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
            updated_at: string;
          };
          Insert: Omit<Database['public']['Tables']['reviews']['Row'], 'id' | 'created_at' | 'updated_at'>;
          Update: Partial<Database['public']['Tables']['reviews']['Insert']>;
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
          Insert: Omit<Database['public']['Tables']['restaurant_availability']['Row'], 'id'>;
          Update: Partial<Database['public']['Tables']['restaurant_availability']['Insert']>;
        };
        waitlist: {
          Row: {
            id: string;
            user_id: string;
            restaurant_id: string;
            desired_date: string;
            desired_time_range: { start: string; end: string };
            party_size: number;
            status: 'active' | 'notified' | 'booked' | 'expired';
            created_at: string;
          };
          Insert: Omit<Database['public']['Tables']['waitlist']['Row'], 'id' | 'created_at' | 'status'>;
          Update: Partial<Database['public']['Tables']['waitlist']['Insert']>;
        };
        special_offers: {
          Row: {
            id: string;
            restaurant_id: string;
            title: string;
            description: string | null;
            discount_percentage: number | null;
            valid_from: string;
            valid_until: string;
            terms_conditions: string[] | null;
            minimum_party_size: number;
            applicable_days: number[] | null;
            created_at: string;
            restaurant?: Database['public']['Tables']['restaurants']['Row'];
          };
          Insert: Omit<Database['public']['Tables']['special_offers']['Row'], 'id' | 'created_at' | 'restaurant'>;
          Update: Partial<Database['public']['Tables']['special_offers']['Insert']>;
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
          Insert: Omit<Database['public']['Tables']['user_offers']['Row'], 'id' | 'claimed_at'>;
          Update: Partial<Database['public']['Tables']['user_offers']['Insert']>;
        };
        social_connections: {
          Row: {
            id: string;
            user_id: string;
            friend_id: string;
            status: 'pending' | 'accepted' | 'blocked';
            created_at: string;
          };
          Insert: Omit<Database['public']['Tables']['social_connections']['Row'], 'id' | 'created_at'>;
          Update: Partial<Database['public']['Tables']['social_connections']['Insert']>;
        };
        shared_bookings: {
          Row: {
            id: string;
            booking_id: string;
            shared_with_user_id: string;
            accepted: boolean;
            created_at: string;
          };
          Insert: Omit<Database['public']['Tables']['shared_bookings']['Row'], 'id' | 'created_at'>;
          Update: Partial<Database['public']['Tables']['shared_bookings']['Insert']>;
        };
      };
    };
  }