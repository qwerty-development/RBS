// types/restaurant.ts
export interface Restaurant {
  id: string
  name: string
  description: string | null
  address: string
  location: {
    lat: number
    lng: number
  }
  main_image_url: string | null
  image_urls: string[]
  cuisine_type: string
  tags: string[]
  opening_time: string // Legacy - kept for backward compatibility
  closing_time: string // Legacy - kept for backward compatibility
  booking_policy: 'instant' | 'request'
  booking_window_days: number
  cancellation_window_hours: number
  table_turnover_minutes: number
  max_party_size: number
  min_party_size: number
  price_range: number
  average_rating?: number
  total_reviews?: number
  phone_number?: string
  whatsapp_number?: string
  website_url?: string
  instagram_handle?: string
  parking_available: boolean
  valet_parking: boolean
  outdoor_seating: boolean
  shisha_available: boolean
  live_entertainment: boolean
  wifi_available: boolean
  dietary_options: string[]
  payment_methods: string[]
  dress_code?: string
  special_features: string[]
  created_at: string
  updated_at: string
  
  // Relations
  restaurant_hours?: RestaurantHours[]
  restaurant_special_hours?: SpecialHours[]
  restaurant_closures?: Closure[]
  restaurant_tables?: RestaurantTable[]
  reviews?: any[]
  special_offers?: any[]
}

export interface RestaurantHours {
  id: string
  restaurant_id: string
  day_of_week: string
  is_open: boolean
  open_time: string | null
  close_time: string | null
  created_at: string
  updated_at: string
}

export interface SpecialHours {
  id: string
  restaurant_id: string
  date: string
  is_closed: boolean
  open_time: string | null
  close_time: string | null
  reason: string | null
  created_at: string
  created_by: string
}

export interface Closure {
  id: string
  restaurant_id: string
  start_date: string
  end_date: string
  reason: string
  created_at: string
  created_by: string
}

export interface RestaurantTable {
  id: string
  restaurant_id: string
  table_number: string
  table_type: 'booth' | 'window' | 'patio' | 'standard' | 'bar' | 'private'
  capacity: number
  min_capacity: number
  max_capacity: number
  x_position: number
  y_position: number
  shape: 'rectangle' | 'circle' | 'square'
  width: number
  height: number
  is_active: boolean
  features: string[]
  is_combinable: boolean
  combinable_with: string[]
  priority_score: number
  created_at: string
}