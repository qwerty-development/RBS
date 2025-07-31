# Database Functions Reference

## Core Booking Functions

### create_booking_with_tables
Creates a booking with associated table assignments.
```sql
public.create_booking_with_tables(
  p_user_id uuid, 
  p_restaurant_id uuid, 
  p_booking_time timestamp with time zone, 
  p_party_size integer, 
  p_table_ids uuid[], 
  p_turn_time integer, 
  p_special_requests text DEFAULT NULL, 
  p_occasion text DEFAULT NULL, 
  p_dietary_notes text[] DEFAULT NULL, 
  p_table_preferences text[] DEFAULT NULL, 
  p_is_group_booking boolean DEFAULT false, 
  p_applied_offer_id uuid DEFAULT NULL
) RETURNS json
```

### check_booking_overlap
Checks for conflicting bookings on specified tables.
```sql
public.check_booking_overlap(
  p_table_ids uuid[], 
  p_start_time timestamp with time zone, 
  p_end_time timestamp with time zone, 
  p_exclude_booking_id uuid DEFAULT NULL
) RETURNS uuid
```

### update_booking_statuses
Automated status updates for bookings (completed, no-show, cancelled).
```sql
public.update_booking_statuses() RETURNS jsonb
```

## Table Management Functions

### get_available_tables
Finds available tables for a specific time slot and party size.
```sql
public.get_available_tables(
  p_restaurant_id uuid, 
  p_start_time timestamp with time zone, 
  p_end_time timestamp with time zone, 
  p_party_size integer
) RETURNS TABLE(
  table_id uuid, 
  table_number text, 
  capacity integer, 
  min_capacity integer, 
  max_capacity integer, 
  table_type text, 
  is_combinable boolean, 
  priority_score integer
)
```

### suggest_optimal_tables
Suggests the best table combination for a booking.
```sql
public.suggest_optimal_tables(
  p_restaurant_id uuid, 
  p_party_size integer, 
  p_start_time timestamp with time zone, 
  p_end_time timestamp with time zone
) RETURNS TABLE(
  table_ids uuid[], 
  total_capacity integer, 
  requires_combination boolean
)
```

### validate_table_combination
Validates if tables can be combined for a booking.
```sql
public.validate_table_combination(p_table_ids uuid[]) 
RETURNS TABLE(
  is_valid boolean, 
  total_capacity integer, 
  message text
)
```

## Loyalty System Functions

### award_restaurant_loyalty_points
Awards loyalty points to users from restaurant balance.
```sql
public.award_restaurant_loyalty_points(p_booking_id uuid) RETURNS boolean
```

### check_loyalty_rules_for_booking
Finds applicable loyalty rules for a booking.
```sql
public.check_loyalty_rules_for_booking(p_booking_id uuid)
RETURNS TABLE(
  rule_id uuid, 
  points_to_award integer, 
  rule_name text
)
```

### award_loyalty_points_with_tracking
Awards points to users with full activity tracking.
```sql
public.award_loyalty_points_with_tracking(
  p_user_id uuid, 
  p_points integer, 
  p_activity_type text DEFAULT 'manual_adjustment', 
  p_description text DEFAULT NULL, 
  p_related_booking_id uuid DEFAULT NULL, 
  p_related_review_id uuid DEFAULT NULL, 
  p_metadata jsonb DEFAULT '{}'
) RETURNS TABLE(
  new_points integer, 
  new_tier text, 
  tier_changed boolean
)
```

### refund_restaurant_loyalty_points
Refunds loyalty points when bookings are cancelled.
```sql
public.refund_restaurant_loyalty_points(p_booking_id uuid) RETURNS boolean
```

### get_loyalty_summary
Gets comprehensive loyalty information for a user.
```sql
public.get_loyalty_summary(p_user_id uuid)
RETURNS TABLE(
  total_points integer, 
  current_tier text, 
  points_to_next_tier integer, 
  total_earned integer, 
  total_redeemed integer, 
  active_redemptions integer, 
  tier_benefits jsonb
)
```

## User Rating Functions

### calculate_user_rating
Calculates user reliability rating based on booking history.
```sql
public.calculate_user_rating(p_user_id uuid) RETURNS numeric
```

### update_user_rating
Updates user rating and logs the change.
```sql
public.update_user_rating(
  p_user_id uuid, 
  p_booking_id uuid DEFAULT NULL, 
  p_change_reason text DEFAULT 'manual_update'
) RETURNS void
```

### get_user_rating_stats
Gets comprehensive user rating statistics.
```sql
public.get_user_rating_stats(p_user_id uuid)
RETURNS TABLE(
  current_rating numeric, 
  total_bookings integer, 
  completed_bookings integer, 
  cancelled_bookings integer, 
  no_show_bookings integer, 
  completion_rate numeric, 
  reliability_score text, 
  rating_trend text
)
```

## Analytics Functions

### get_table_utilization_report
Generates table utilization analytics for restaurants.
```sql
public.get_table_utilization_report(
  p_restaurant_id uuid, 
  p_start_date date DEFAULT (CURRENT_DATE - '30 days'::interval), 
  p_end_date date DEFAULT CURRENT_DATE
) RETURNS jsonb
```

### check_booking_system_health
System health check for booking operations.
```sql
public.check_booking_system_health() RETURNS jsonb
```

### get_table_availability_by_hour
Hour-by-hour availability analysis.
```sql
public.get_table_availability_by_hour(
  p_restaurant_id uuid, 
  p_date date
) RETURNS TABLE(
  hour integer, 
  total_tables integer, 
  available_tables integer, 
  utilization_percentage integer
)
```

## Customer Management Functions

### manage_restaurant_customers
Automatically manages restaurant customer records from bookings.
```sql
-- Triggered automatically on booking insert/update
```

### update_all_customer_statistics
Recalculates all customer statistics (maintenance function).
```sql
public.update_all_customer_statistics() RETURNS void
```

### verify_customer_statistics
Verifies customer data integrity.
```sql
public.verify_customer_statistics(p_restaurant_id uuid DEFAULT NULL)
RETURNS TABLE(
  customer_id uuid, 
  customer_name text, 
  stored_total_bookings integer, 
  actual_total_bookings bigint, 
  stored_no_shows integer, 
  actual_no_shows bigint, 
  stored_cancelled integer, 
  actual_cancelled bigint, 
  needs_update boolean
)
```

## Availability Functions

### quick_availability_check
Fast availability check for time slots.
```sql
public.quick_availability_check(
  p_restaurant_id uuid, 
  p_start_time timestamp with time zone, 
  p_end_time timestamp with time zone, 
  p_party_size integer
) RETURNS boolean
```

### get_booked_tables_for_slot
Gets all booked tables for a specific time slot.
```sql
public.get_booked_tables_for_slot(
  p_restaurant_id uuid, 
  p_start_time timestamp with time zone, 
  p_end_time timestamp with time zone
) RETURNS TABLE(table_id uuid)
```

## Maintenance Functions

### archive_old_bookings
Archives old booking records for data retention.
```sql
public.archive_old_bookings(
  p_days_to_keep integer DEFAULT 90, 
  p_archive_user_id uuid DEFAULT NULL
) RETURNS jsonb
```

### perform_daily_maintenance
Comprehensive daily maintenance routine.
```sql
public.perform_daily_maintenance() RETURNS jsonb
```

### auto_decline_expired_pending_bookings
Automatically declines old pending requests.
```sql
public.auto_decline_expired_pending_bookings() RETURNS void
```

## Offer and Redemption Functions

### use_user_offer
Redeems a user offer for a booking.
```sql
public.use_user_offer(
  p_redemption_code text, 
  p_user_id uuid, 
  p_booking_id uuid DEFAULT NULL
) RETURNS TABLE(
  success boolean, 
  message text, 
  offer_details jsonb
)
```

### redeem_loyalty_reward
Redeems loyalty points for rewards.
```sql
public.redeem_loyalty_reward(
  p_user_id uuid, 
  p_reward_id uuid DEFAULT NULL, 
  p_offer_id uuid DEFAULT NULL, 
  p_points_cost integer DEFAULT NULL
) RETURNS TABLE(
  redemption_id uuid, 
  redemption_code text, 
  expires_at timestamp with time zone
)
```

### expire_old_redemptions
Expires old unused redemptions.
```sql
public.expire_old_redemptions() RETURNS integer
```

## Social Functions

### search_users
Search for users to connect with.
```sql
public.search_users(search_query text)
RETURNS TABLE(
  id uuid, 
  full_name text, 
  avatar_url text, 
  is_friend boolean
)
```

### get_friend_recommendations
Get friend recommendations based on mutual connections.
```sql
public.get_friend_recommendations(
  p_user_id uuid, 
  p_limit integer DEFAULT 10
) RETURNS TABLE(
  user_id uuid, 
  full_name text, 
  email text, 
  avatar_url text, 
  mutual_friends_count bigint
)
```

## Utility Functions

### calculate_tier
Calculates loyalty tier based on points.
```sql
public.calculate_tier(p_points integer) RETURNS text
```

### get_turn_time
Gets appropriate turn time for party size and restaurant.
```sql
public.get_turn_time(
  p_restaurant_id uuid, 
  p_party_size integer, 
  p_booking_time timestamp with time zone DEFAULT now()
) RETURNS integer
```

### generate_confirmation_code
Generates unique booking confirmation codes.
```sql
public.generate_confirmation_code() RETURNS trigger
```

## Menu Functions

### get_restaurant_menu
Gets full menu structure for a restaurant.
```sql
public.get_restaurant_menu(p_restaurant_id uuid)
RETURNS TABLE(
  category_id uuid, 
  category_name text, 
  category_description text, 
  category_order integer, 
  items json
)
```

## Key Function Categories

### Real-time Operations
- `create_booking_with_tables` - Core booking creation
- `check_booking_overlap` - Conflict detection
- `quick_availability_check` - Fast availability checks

### Business Logic
- `award_restaurant_loyalty_points` - Loyalty point distribution
- `calculate_user_rating` - User reliability scoring
- `suggest_optimal_tables` - Table assignment optimization

### Data Integrity
- `update_booking_statuses` - Automated status management
- `verify_customer_statistics` - Data consistency checks
- `archive_old_bookings` - Data retention

### Analytics
- `get_table_utilization_report` - Business insights
- `check_booking_system_health` - System monitoring
- `get_loyalty_summary` - User engagement metrics
