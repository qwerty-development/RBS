# TableReserve (RBS) Database Schema

## Overview
This document contains the complete database schema for the TableReserve restaurant booking application, built with PostgreSQL and Supabase.

## Core Tables

### Bookings System

#### bookings
Main booking records table.
```sql
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  booking_time timestamp with time zone NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled_by_user'::text, 'declined_by_restaurant'::text, 'completed'::text, 'no_show'::text])),
  special_requests text,
  occasion text,
  dietary_notes ARRAY,
  confirmation_code text UNIQUE,
  table_preferences ARRAY,
  reminder_sent boolean DEFAULT false,
  checked_in_at timestamp with time zone,
  loyalty_points_earned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  applied_offer_id uuid,
  expected_loyalty_points integer DEFAULT 0,
  guest_name text,
  guest_email text,
  guest_phone text,
  is_group_booking boolean DEFAULT false,
  organizer_id uuid,
  attendees integer DEFAULT 1,
  turn_time_minutes integer NOT NULL DEFAULT 120,
  applied_loyalty_rule_id uuid,
  CONSTRAINT bookings_pkey PRIMARY KEY (id)
);
```

#### booking_tables
Links bookings to specific tables.
```sql
CREATE TABLE public.booking_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  table_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_tables_pkey PRIMARY KEY (id)
);
```

#### booking_status_history
Tracks status changes for bookings.
```sql
CREATE TABLE public.booking_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now(),
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT booking_status_history_pkey PRIMARY KEY (id)
);
```

#### booking_archive
Archived booking records for data retention.
```sql
CREATE TABLE public.booking_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  booking_time timestamp with time zone NOT NULL,
  party_size integer NOT NULL CHECK (party_size > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'cancelled_by_user'::text, 'declined_by_restaurant'::text, 'completed'::text, 'no_show'::text])),
  -- ... other fields same as bookings table
  archived_at timestamp with time zone DEFAULT now(),
  archived_by uuid,
  CONSTRAINT booking_archive_pkey PRIMARY KEY (id)
);
```

### Restaurant Management

#### restaurants
Core restaurant information.
```sql
CREATE TABLE public.restaurants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  address text NOT NULL,
  location USER-DEFINED NOT NULL,
  main_image_url text,
  image_urls ARRAY,
  cuisine_type text NOT NULL,
  tags ARRAY,
  opening_time time without time zone NOT NULL,
  closing_time time without time zone NOT NULL,
  booking_policy text CHECK (booking_policy = ANY (ARRAY['instant'::text, 'request'::text])),
  price_range integer CHECK (price_range >= 1 AND price_range <= 4),
  average_rating numeric DEFAULT 0,
  total_reviews integer DEFAULT 0,
  phone_number text,
  whatsapp_number text,
  instagram_handle text,
  menu_url text,
  dietary_options ARRAY,
  ambiance_tags ARRAY,
  parking_available boolean DEFAULT false,
  valet_parking boolean DEFAULT false,
  outdoor_seating boolean DEFAULT false,
  shisha_available boolean DEFAULT false,
  live_music_schedule jsonb,
  happy_hour_times jsonb,
  booking_window_days integer DEFAULT 30,
  cancellation_window_hours integer DEFAULT 24,
  table_turnover_minutes integer DEFAULT 120,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  featured boolean DEFAULT false,
  website_url text,
  review_summary jsonb DEFAULT '{"total_reviews": 0, "average_rating": 0, "detailed_ratings": {"food_avg": 0, "value_avg": 0, "service_avg": 0, "ambiance_avg": 0}, "rating_distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}, "recommendation_percentage": 0}'::jsonb,
  ai_featured boolean NOT NULL DEFAULT false,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text])),
  CONSTRAINT restaurants_pkey PRIMARY KEY (id)
);
```

#### restaurant_tables
Table layout and capacity information.
```sql
CREATE TABLE public.restaurant_tables (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  table_number text NOT NULL,
  table_type text NOT NULL CHECK (table_type = ANY (ARRAY['booth'::text, 'window'::text, 'patio'::text, 'standard'::text, 'bar'::text, 'private'::text])),
  capacity integer NOT NULL CHECK (capacity > 0),
  x_position double precision NOT NULL,
  y_position double precision NOT NULL,
  shape text DEFAULT 'rectangle'::text CHECK (shape = ANY (ARRAY['rectangle'::text, 'circle'::text, 'square'::text])),
  width double precision DEFAULT 10,
  height double precision DEFAULT 10,
  is_active boolean DEFAULT true,
  features ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  min_capacity integer NOT NULL,
  max_capacity integer NOT NULL,
  is_combinable boolean DEFAULT true,
  combinable_with ARRAY DEFAULT '{}'::uuid[],
  priority_score integer DEFAULT 0,
  CONSTRAINT restaurant_tables_pkey PRIMARY KEY (id)
);
```

#### restaurant_staff
Staff management for restaurants.
```sql
CREATE TABLE public.restaurant_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text, 'viewer'::text])),
  permissions ARRAY NOT NULL DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  hired_at timestamp with time zone DEFAULT now(),
  terminated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  last_login_at timestamp with time zone,
  CONSTRAINT restaurant_staff_pkey PRIMARY KEY (id)
);
```

### User Management

#### profiles
User profile information.
```sql
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  phone_number text,
  avatar_url text,
  allergies ARRAY,
  favorite_cuisines ARRAY,
  dietary_restrictions ARRAY,
  preferred_party_size integer DEFAULT 2,
  notification_preferences jsonb DEFAULT '{"sms": false, "push": true, "email": true}'::jsonb,
  loyalty_points integer DEFAULT 0,
  membership_tier text DEFAULT 'bronze'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  privacy_settings jsonb DEFAULT jsonb_build_object('profile_visibility', 'public', 'activity_sharing', true, 'location_sharing', false, 'friend_requests_allowed', true),
  user_rating numeric DEFAULT 5.0 CHECK (user_rating >= 1.0 AND user_rating <= 5.0),
  total_bookings integer DEFAULT 0,
  completed_bookings integer DEFAULT 0,
  cancelled_bookings integer DEFAULT 0,
  no_show_bookings integer DEFAULT 0,
  rating_last_updated timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);
```

### Loyalty System

#### restaurant_loyalty_balance
Restaurant's loyalty point pool.
```sql
CREATE TABLE public.restaurant_loyalty_balance (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL UNIQUE,
  total_purchased integer NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
  current_balance integer NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
  last_purchase_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_loyalty_balance_pkey PRIMARY KEY (id)
);
```

#### restaurant_loyalty_rules
Rules for awarding loyalty points.
```sql
CREATE TABLE public.restaurant_loyalty_rules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  restaurant_id uuid NOT NULL,
  rule_name text NOT NULL,
  points_to_award integer NOT NULL CHECK (points_to_award > 0),
  is_active boolean DEFAULT true,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  applicable_days ARRAY DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],
  start_time_minutes integer CHECK (start_time_minutes >= 0 AND start_time_minutes < 1440),
  end_time_minutes integer CHECK (end_time_minutes >= 0 AND end_time_minutes <= 1440),
  minimum_party_size integer DEFAULT 1,
  maximum_party_size integer,
  max_uses_total integer,
  current_uses integer DEFAULT 0,
  max_uses_per_user integer,
  priority integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurant_loyalty_rules_pkey PRIMARY KEY (id)
);
```

#### loyalty_activities
User loyalty point activity tracking.
```sql
CREATE TABLE public.loyalty_activities (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL CHECK (activity_type = ANY (ARRAY['booking_completed'::text, 'review_written'::text, 'photo_uploaded'::text, 'referral_success'::text, 'birthday_bonus'::text, 'streak_bonus'::text, 'manual_adjustment'::text])),
  points_earned integer NOT NULL,
  points_multiplier numeric DEFAULT 1.0,
  description text,
  related_booking_id uuid,
  related_review_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loyalty_activities_pkey PRIMARY KEY (id)
);
```

### Social Features

#### friends
User friendship relationships.
```sql
CREATE TABLE public.friends (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  friendship_date timestamp with time zone DEFAULT now(),
  CONSTRAINT friends_pkey PRIMARY KEY (id)
);
```

#### friend_requests
Friend request management.
```sql
CREATE TABLE public.friend_requests (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'cancelled'::text])),
  message text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friend_requests_pkey PRIMARY KEY (id)
);
```

#### notifications
System notifications.
```sql
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['friend_request'::text, 'friend_request_accepted'::text, 'booking_shared'::text, 'shared_booking_accepted'::text, 'booking_reminder'::text, 'booking_confirmed'::text, 'booking_cancelled'::text])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
```

### Reviews and Ratings

#### reviews
Restaurant reviews by users.
```sql
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  food_rating integer CHECK (food_rating >= 1 AND food_rating <= 5),
  service_rating integer CHECK (service_rating >= 1 AND service_rating <= 5),
  ambiance_rating integer CHECK (ambiance_rating >= 1 AND ambiance_rating <= 5),
  value_rating integer CHECK (value_rating >= 1 AND value_rating <= 5),
  recommend_to_friend boolean DEFAULT false,
  visit_again boolean DEFAULT false,
  tags ARRAY,
  photos ARRAY,
  CONSTRAINT reviews_pkey PRIMARY KEY (id)
);
```

### Special Features

#### special_offers
Restaurant promotions and offers.
```sql
CREATE TABLE public.special_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  discount_percentage integer,
  valid_from timestamp with time zone NOT NULL,
  valid_until timestamp with time zone NOT NULL,
  terms_conditions ARRAY,
  minimum_party_size integer DEFAULT 1,
  applicable_days ARRAY,
  created_at timestamp with time zone DEFAULT now(),
  img_url text,
  CONSTRAINT special_offers_pkey PRIMARY KEY (id)
);
```



## Key Features

### Booking Policies
- **Instant Booking**: Immediate confirmation
- **Request Booking**: Restaurant approval required (2-hour response window)

### Table Management
- **Combinable Tables**: Multiple tables can be combined for larger parties
- **Priority Scoring**: Tables have priority scores for optimal assignment
- **Turn Times**: Configurable dining duration per party size

### Loyalty System
- **Restaurant-Funded**: Restaurants purchase loyalty points to award customers
- **Rule-Based**: Flexible rules based on time, date, party size, etc.
- **User Tiers**: Bronze, Silver, Gold, Platinum with multipliers

### Rating System
- **User Ratings**: Dynamic ratings based on booking behavior
- **Restaurant Ratings**: Comprehensive review system with detailed breakdowns

### Social Features
- **Friend System**: Connect with other users
- **Playlist Sharing**: Share restaurant collections
- **Group Bookings**: Invite friends to bookings

## Data Relationships

### Core Relationships
- `bookings.user_id` → `profiles.id`
- `bookings.restaurant_id` → `restaurants.id`
- `booking_tables.booking_id` → `bookings.id`
- `booking_tables.table_id` → `restaurant_tables.id`

### Loyalty Relationships
- `restaurant_loyalty_rules.restaurant_id` → `restaurants.id`
- `loyalty_activities.user_id` → `profiles.id`
- `bookings.applied_loyalty_rule_id` → `restaurant_loyalty_rules.id`

### Social Relationships
- `friends.user_id` → `profiles.id`
- `friends.friend_id` → `profiles.id`
- `reviews.user_id` → `profiles.id`
- `reviews.restaurant_id` → `restaurants.id`
