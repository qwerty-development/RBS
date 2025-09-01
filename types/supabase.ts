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
      review_replies: {
        Row: {
          created_at: string | null
          id: string
          replied_by: string
          reply_message: string
          restaurant_id: string
          review_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          replied_by: string
          reply_message: string
          restaurant_id: string
          review_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          replied_by?: string
          reply_message?: string
          restaurant_id?: string
          review_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_replied_by_fkey"
            columns: ["replied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          }
        ]
      }
      reviews: {
        Row: {
          ambiance_rating: number | null
          booking_id: string
          comment: string | null
          created_at: string | null
          food_rating: number | null
          id: string
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
          booking_id: string
          comment?: string | null
          created_at?: string | null
          food_rating?: number | null
          id?: string
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
          booking_id?: string
          comment?: string | null
          created_at?: string | null
          food_rating?: number | null
          id?: string
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
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      restaurants: {
        Row: {
          id: string
          name: string
          image_url: string | null
          review_summary: {
            total_reviews: number
            average_rating: number
            detailed_ratings: {
              food_avg: number
              value_avg: number
              service_avg: number
              ambiance_avg: number
            }
            rating_distribution: Record<string, number>
            recommendation_percentage: number
          } | null
        }
        Insert: {
          id?: string
          name: string
          image_url?: string | null
          review_summary?: any
        }
        Update: {
          id?: string
          name?: string
          image_url?: string | null
          review_summary?: any
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          email: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          email?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          email?: string | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"]
