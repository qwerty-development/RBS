

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "archive";


ALTER SCHEMA "archive" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."notification_type" AS ENUM (
    'booking_confirmation',
    'booking_reminder',
    'waiting_list_available',
    'promotional_offer',
    'admin_message'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."table_type" AS ENUM (
    'any',
    'booth',
    'window',
    'patio',
    'standard',
    'bar',
    'private'
);


ALTER TYPE "public"."table_type" OWNER TO "postgres";


CREATE TYPE "public"."waiting_status" AS ENUM (
    'active',
    'notified',
    'booked',
    'expired'
);


ALTER TYPE "public"."waiting_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."waiting_status" IS 'the status of the user in the waiting list ';



CREATE OR REPLACE FUNCTION "public"."_http_post_edge"("path" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_secret text;
  v_url text;
begin

  v_url := 'https://xsovqvbigdettnpeisjs.functions.supabase.co/' || path;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_secret,
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
end $$;


ALTER FUNCTION "public"."_http_post_edge"("path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_archived_count integer;
BEGIN
  -- Archive instead of delete
  WITH archived AS (
    INSERT INTO booking_archive
    SELECT *, now(), null
    FROM bookings
    WHERE booking_time < CURRENT_DATE - (p_days_to_keep || ' days')::interval
      AND status IN ('completed', 'cancelled_by_user', 'no_show')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_archived_count FROM archived;
  
  -- Then delete from main table
  DELETE FROM bookings
  WHERE id IN (SELECT id FROM booking_archive WHERE archived_at >= now() - interval '1 minute');
  
  RETURN v_archived_count;
END;
$$;


ALTER FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer DEFAULT 90, "p_archive_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_cutoff_date date;
  v_archived_bookings integer := 0;
  v_archived_tables integer := 0;
  v_archived_history integer := 0;
  v_freed_space bigint := 0;
BEGIN
  v_cutoff_date := CURRENT_DATE - (p_days_to_keep || ' days')::interval;
  
  -- Start transaction
  BEGIN
    -- Archive bookings
    WITH archived AS (
      INSERT INTO archive.bookings
      SELECT b.*, now(), p_archive_user_id, 'Retention policy - ' || p_days_to_keep || ' days'
      FROM public.bookings b
      WHERE b.booking_time < v_cutoff_date
        AND b.status IN ('completed', 'cancelled_by_user', 'cancelled_by_restaurant', 'no_show')
      RETURNING id
    )
    SELECT COUNT(*) INTO v_archived_bookings FROM archived;

    -- Archive booking_tables
    WITH archived AS (
      INSERT INTO archive.booking_tables
      SELECT bt.*, now()
      FROM public.booking_tables bt
      WHERE bt.booking_id IN (
        SELECT id FROM archive.bookings 
        WHERE archived_at >= now() - INTERVAL '1 minute'
      )
      RETURNING booking_id
    )
    SELECT COUNT(*) INTO v_archived_tables FROM archived;

    -- Archive status history
    WITH archived AS (
      INSERT INTO archive.booking_status_history
      SELECT bsh.*, now()
      FROM public.booking_status_history bsh
      WHERE bsh.booking_id IN (
        SELECT id FROM archive.bookings 
        WHERE archived_at >= now() - INTERVAL '1 minute'
      )
      RETURNING booking_id
    )
    SELECT COUNT(DISTINCT booking_id) INTO v_archived_history FROM archived;

    -- Delete from main tables
    DELETE FROM public.booking_tables
    WHERE booking_id IN (
      SELECT id FROM archive.bookings 
      WHERE archived_at >= now() - INTERVAL '1 minute'
    );

    DELETE FROM public.bookings
    WHERE id IN (
      SELECT id FROM archive.bookings 
      WHERE archived_at >= now() - INTERVAL '1 minute'
    );

    -- Estimate freed space
    SELECT pg_total_relation_size('public.bookings') + 
           pg_total_relation_size('public.booking_tables') +
           pg_total_relation_size('public.booking_status_history')
    INTO v_freed_space;

    -- Vacuum tables to reclaim space
    VACUUM ANALYZE public.bookings;
    VACUUM ANALYZE public.booking_tables;
    VACUUM ANALYZE public.booking_status_history;

    RETURN jsonb_build_object(
      'archived_bookings', v_archived_bookings,
      'archived_tables', v_archived_tables,
      'archived_history_entries', v_archived_history,
      'cutoff_date', v_cutoff_date,
      'estimated_space_freed_bytes', v_freed_space,
      'archived_at', now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'Error in archive_old_bookings: %', SQLERRM;
      RAISE;
  END;
END;
$$;


ALTER FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer, "p_archive_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_decline_expired_pending_bookings"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE bookings
  SET 
    status = 'declined_by_restaurant',
    updated_at = now()
  WHERE 
    status = 'pending'
    AND created_at < (now() - interval '2 hours')
    AND booking_time > now(); -- Don't decline past bookings
    
  -- No need to handle loyalty refunds as pending bookings don't have points awarded
END;
$$;


ALTER FUNCTION "public"."auto_decline_expired_pending_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_decline_expired_requests"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  updated_bookings_count integer;
BEGIN
  -- Update expired bookings where booking time has passed
  WITH updated_bookings AS (
    UPDATE bookings 
    SET 
      status = 'auto_declined',
      auto_declined = true,
      updated_at = now(),
      acceptance_failed_reason = 'Booking time passed without restaurant response'
    WHERE 
      status = 'pending'
      AND booking_time < now() -- Booking time has passed
    RETURNING id
  )
  INSERT INTO booking_status_history (booking_id, old_status, new_status, metadata)
  SELECT 
    ub.id,
    'pending',
    'auto_declined',
    jsonb_build_object(
      'reason', 'Booking time passed', 
      'auto_declined', true,
      'expired_at', now()
    )
  FROM updated_bookings ub;
  
  GET DIAGNOSTICS updated_bookings_count = ROW_COUNT;
  
  IF updated_bookings_count > 0 THEN
    RAISE NOTICE 'Auto-declined % expired booking requests', updated_bookings_count;
  END IF;
END;
$$;


ALTER FUNCTION "public"."auto_decline_expired_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_loyalty_points"("p_user_id" "uuid", "p_points" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_new_points INTEGER;
  v_new_tier TEXT;
BEGIN
  -- Update points
  UPDATE public.profiles
  SET loyalty_points = loyalty_points + p_points
  WHERE id = p_user_id
  RETURNING loyalty_points INTO v_new_points;
  
  -- Calculate new tier
  v_new_tier := CASE
    WHEN v_new_points >= 3000 THEN 'platinum'
    WHEN v_new_points >= 1500 THEN 'gold'
    WHEN v_new_points >= 500 THEN 'silver'
    ELSE 'bronze'
  END;
  
  -- Update tier if changed
  UPDATE public.profiles
  SET membership_tier = v_new_tier
  WHERE id = p_user_id AND membership_tier != v_new_tier;
END;
$$;


ALTER FUNCTION "public"."award_loyalty_points"("p_user_id" "uuid", "p_points" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_loyalty_points_with_tracking"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text" DEFAULT 'manual_adjustment'::"text", "p_description" "text" DEFAULT NULL::"text", "p_related_booking_id" "uuid" DEFAULT NULL::"uuid", "p_related_review_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("new_points" integer, "new_tier" "text", "tier_changed" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_old_points INTEGER;
  v_new_points INTEGER;
  v_old_tier TEXT;
  v_new_tier TEXT;
  v_points_multiplier DECIMAL(3,2) := 1.0;
  v_final_points INTEGER;
BEGIN
  -- Get current points and tier
  SELECT loyalty_points, membership_tier 
  INTO v_old_points, v_old_tier
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Get tier multiplier
  SELECT CASE
    WHEN v_old_tier = 'silver' THEN 1.1
    WHEN v_old_tier = 'gold' THEN 1.2
    WHEN v_old_tier = 'platinum' THEN 1.5
    ELSE 1.0
  END INTO v_points_multiplier;
  
  -- Calculate final points (only apply multiplier for positive points)
  v_final_points := CASE 
    WHEN p_points > 0 THEN ROUND(p_points * v_points_multiplier)
    ELSE p_points
  END;
  
  -- Update points
  UPDATE public.profiles
  SET loyalty_points = GREATEST(0, loyalty_points + v_final_points)
  WHERE id = p_user_id
  RETURNING loyalty_points INTO v_new_points;
  
  -- Calculate new tier
  v_new_tier := CASE
    WHEN v_new_points >= 3000 THEN 'platinum'
    WHEN v_new_points >= 1500 THEN 'gold'
    WHEN v_new_points >= 500 THEN 'silver'
    ELSE 'bronze'
  END;
  
  -- Update tier if changed
  IF v_new_tier != v_old_tier THEN
    UPDATE public.profiles
    SET membership_tier = v_new_tier
    WHERE id = p_user_id;
  END IF;
  
  -- Record activity
  INSERT INTO public.loyalty_activities (
    user_id,
    activity_type,
    points_earned,
    points_multiplier,
    description,
    related_booking_id,
    related_review_id,
    metadata
  ) VALUES (
    p_user_id,
    p_activity_type,
    v_final_points,
    v_points_multiplier,
    COALESCE(p_description, 'Points adjustment'),
    p_related_booking_id,
    p_related_review_id,
    p_metadata
  );
  
  RETURN QUERY SELECT v_new_points, v_new_tier, (v_new_tier != v_old_tier);
END;
$$;


ALTER FUNCTION "public"."award_loyalty_points_with_tracking"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_description" "text", "p_related_booking_id" "uuid", "p_related_review_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."award_restaurant_loyalty_points"("p_booking_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_rule RECORD;
  v_booking RECORD;
  v_current_balance integer;
  v_success boolean := false;
BEGIN
  -- Get applicable rule
  SELECT clr.rule_id, clr.points_to_award, clr.rule_name
  INTO v_rule
  FROM check_loyalty_rules_for_booking(p_booking_id) clr
  LIMIT 1;
  
  IF v_rule.rule_id IS NULL THEN
    RAISE NOTICE 'No applicable loyalty rule found for booking: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Get booking details
  SELECT b.*
  INTO v_booking
  FROM bookings b
  WHERE b.id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Booking not found: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Check if booking is confirmed
  IF v_booking.status != 'confirmed' THEN
    RAISE NOTICE 'Booking not confirmed: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Check if points already awarded
  IF EXISTS (
    SELECT 1 
    FROM user_loyalty_rule_usage ulru 
    WHERE ulru.booking_id = p_booking_id 
    AND ulru.user_id = v_booking.user_id
  ) THEN
    RAISE NOTICE 'Points already awarded for booking: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Start transaction
  -- Lock restaurant balance row
  SELECT rlb.current_balance 
  INTO v_current_balance
  FROM restaurant_loyalty_balance rlb
  WHERE rlb.restaurant_id = v_booking.restaurant_id
  FOR UPDATE;
  
  -- Double-check balance
  IF v_current_balance < v_rule.points_to_award THEN
    RAISE NOTICE 'Insufficient restaurant balance. Required: %, Available: %', v_rule.points_to_award, v_current_balance;
    RETURN false;
  END IF;
  
  BEGIN
    -- Deduct from restaurant balance
    UPDATE restaurant_loyalty_balance
    SET 
      current_balance = current_balance - v_rule.points_to_award,
      updated_at = now()
    WHERE restaurant_id = v_booking.restaurant_id;
    
    -- Record transaction
    INSERT INTO restaurant_loyalty_transactions (
      restaurant_id,
      transaction_type,
      points,
      balance_before,
      balance_after,
      description,
      booking_id,
      user_id
    ) VALUES (
      v_booking.restaurant_id,
      'deduction',
      v_rule.points_to_award,
      v_current_balance,
      v_current_balance - v_rule.points_to_award,
      'Points awarded for booking - ' || v_rule.rule_name,
      p_booking_id,
      v_booking.user_id
    );
    
    -- Award points to user
    UPDATE profiles
    SET loyalty_points = loyalty_points + v_rule.points_to_award
    WHERE id = v_booking.user_id;
    
    -- Record loyalty activity
    INSERT INTO loyalty_activities (
      user_id,
      activity_type,
      points_earned,
      description,
      related_booking_id,
      metadata
    ) VALUES (
      v_booking.user_id,
      'booking_completed',
      v_rule.points_to_award,
      'Earned from ' || v_rule.rule_name,
      p_booking_id,
      jsonb_build_object('rule_id', v_rule.rule_id, 'rule_name', v_rule.rule_name)
    );
    
    -- Update rule usage
    UPDATE restaurant_loyalty_rules
    SET current_uses = current_uses + 1
    WHERE id = v_rule.rule_id;
    
    -- Record user usage
    INSERT INTO user_loyalty_rule_usage (user_id, rule_id, booking_id)
    VALUES (v_booking.user_id, v_rule.rule_id, p_booking_id);
    
    -- Update booking with applied rule
    UPDATE bookings
    SET 
      applied_loyalty_rule_id = v_rule.rule_id,
      loyalty_points_earned = v_rule.points_to_award,
      updated_at = now()
    WHERE id = p_booking_id;
    
    RAISE NOTICE 'Successfully awarded % points to user % for booking %', v_rule.points_to_award, v_booking.user_id, p_booking_id;
    RETURN true;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error awarding loyalty points: %', SQLERRM;
    RETURN false;
  END;
END;
$$;


ALTER FUNCTION "public"."award_restaurant_loyalty_points"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_offer_expiry"("p_claimed_at" timestamp with time zone, "p_offer_valid_until" timestamp with time zone) RETURNS timestamp with time zone
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Return whichever is sooner: 30 days from claim or offer expiry
  RETURN LEAST(
    p_claimed_at + INTERVAL '30 days',
    p_offer_valid_until
  );
END;
$$;


ALTER FUNCTION "public"."calculate_offer_expiry"("p_claimed_at" timestamp with time zone, "p_offer_valid_until" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_tier"("p_points" integer) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN CASE
    WHEN p_points >= 3000 THEN 'platinum'
    WHEN p_points >= 1500 THEN 'gold'
    WHEN p_points >= 500 THEN 'silver'
    ELSE 'bronze'
  END;
END;
$$;


ALTER FUNCTION "public"."calculate_tier"("p_points" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_user_rating"("p_user_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_bookings INTEGER := 0;
  v_completed_bookings INTEGER := 0;
  v_cancelled_bookings INTEGER := 0;
  v_no_show_bookings INTEGER := 0;
  v_declined_bookings INTEGER := 0;
  v_rating DECIMAL(2,1);
  v_completion_rate DECIMAL(3,2);
  v_cancellation_rate DECIMAL(3,2);
  v_no_show_rate DECIMAL(3,2);
  v_base_rating DECIMAL(2,1) := 5.0;
  v_recent_behavior_weight DECIMAL(2,1) := 0.0;
BEGIN
  -- Get booking statistics for the user
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'cancelled_by_user') as cancelled,
    COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
    COUNT(*) FILTER (WHERE status = 'declined_by_restaurant') as declined
  INTO v_total_bookings, v_completed_bookings, v_cancelled_bookings, v_no_show_bookings, v_declined_bookings
  FROM public.bookings 
  WHERE user_id = p_user_id;

  -- If no bookings, return default rating
  IF v_total_bookings = 0 THEN
    RETURN 5.0;
  END IF;

  -- Calculate rates
  v_completion_rate := v_completed_bookings::DECIMAL / v_total_bookings::DECIMAL;
  v_cancellation_rate := v_cancelled_bookings::DECIMAL / v_total_bookings::DECIMAL;
  v_no_show_rate := v_no_show_bookings::DECIMAL / v_total_bookings::DECIMAL;

  -- Calculate recent behavior (last 10 bookings more heavily weighted)
  SELECT 
    CASE 
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE status = 'completed') * 0.3) - 
        (COUNT(*) FILTER (WHERE status = 'cancelled_by_user') * 0.5) - 
        (COUNT(*) FILTER (WHERE status = 'no_show') * 1.0)
      ELSE 0.0
    END
  INTO v_recent_behavior_weight
  FROM (
    SELECT status 
    FROM public.bookings 
    WHERE user_id = p_user_id 
    ORDER BY created_at DESC 
    LIMIT 10
  ) recent_bookings;

  -- Base rating calculation:
  -- Start with 5.0 stars
  -- +0.1 for every 10% completion rate above 70%
  -- -0.3 for every 10% cancellation rate
  -- -0.5 for every 10% no-show rate
  -- Recent behavior adjustment
  
  v_rating := v_base_rating;
  
  -- Reward high completion rates
  IF v_completion_rate > 0.7 THEN
    v_rating := v_rating + ((v_completion_rate - 0.7) * 1.0);
  END IF;
  
  -- Penalize cancellations (moderate penalty)
  v_rating := v_rating - (v_cancellation_rate * 1.5);
  
  -- Penalize no-shows (heavy penalty)
  v_rating := v_rating - (v_no_show_rate * 2.5);
  
  -- Apply recent behavior weight
  v_rating := v_rating + v_recent_behavior_weight;
  
  -- Ensure rating stays within bounds (1.0 - 5.0)
  v_rating := GREATEST(1.0, LEAST(5.0, v_rating));
  
  -- Round to 1 decimal place
  v_rating := ROUND(v_rating, 1);
  
  RETURN v_rating;
END;
$$;


ALTER FUNCTION "public"."calculate_user_rating"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  conflicting_booking_id uuid;
BEGIN
  -- Validate inputs
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RETURN NULL; -- No tables to check
  END IF;
  
  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Invalid time range: start time must be before end time';
  END IF;

  SELECT b.id INTO conflicting_booking_id
  FROM bookings b
  JOIN booking_tables bt ON b.id = bt.booking_id
  WHERE bt.table_id = ANY(p_table_ids)
    AND b.status IN ('confirmed', 'pending')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval)
        OVERLAPS (p_start_time, p_end_time)
  LIMIT 1;

  RETURN conflicting_booking_id;
END;
$$;


ALTER FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid" DEFAULT NULL::"uuid", "p_exclude_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  conflicting_booking_id uuid;
BEGIN
  -- Validate inputs
  IF p_table_ids IS NULL OR array_length(p_table_ids, 1) = 0 THEN
    RETURN NULL; -- No tables to check
  END IF;
  
  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Invalid time range: start time must be before end time';
  END IF;

  SELECT b.id INTO conflicting_booking_id
  FROM bookings b
  JOIN booking_tables bt ON b.id = bt.booking_id
  WHERE bt.table_id = ANY(p_table_ids)
    AND b.status IN ('confirmed', 'pending')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND (p_exclude_user_id IS NULL OR b.user_id != p_exclude_user_id)
    AND (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval)
        OVERLAPS (p_start_time, p_end_time)
  LIMIT 1;

  RETURN conflicting_booking_id;
END;
$$;


ALTER FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid", "p_exclude_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_booking_system_health"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result jsonb := '{}';
  v_pending_bookings integer;
  v_upcoming_bookings integer;
  v_orphaned_tables integer;
  v_table_conflicts integer;
  v_stale_pending integer;
BEGIN
  -- Check pending bookings count
  SELECT COUNT(*) INTO v_pending_bookings
  FROM bookings
  WHERE status = 'pending'
    AND created_at > now() - INTERVAL '24 hours';

  -- Check upcoming bookings in next 24 hours
  SELECT COUNT(*) INTO v_upcoming_bookings
  FROM bookings
  WHERE status = 'confirmed'
    AND booking_time BETWEEN now() AND now() + INTERVAL '24 hours';

  -- Check for orphaned booking_tables
  SELECT COUNT(*) INTO v_orphaned_tables
  FROM booking_tables bt
  WHERE NOT EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = bt.booking_id
  );

  -- Check for table conflicts (double bookings)
  WITH conflicts AS (
    SELECT 
      bt1.table_id,
      COUNT(DISTINCT bt1.booking_id) as conflict_count
    FROM booking_tables bt1
    JOIN bookings b1 ON bt1.booking_id = b1.id
    JOIN booking_tables bt2 ON bt1.table_id = bt2.table_id AND bt1.booking_id != bt2.booking_id
    JOIN bookings b2 ON bt2.booking_id = b2.id
    WHERE b1.status IN ('confirmed', 'pending')
      AND b2.status IN ('confirmed', 'pending')
      AND (b1.booking_time, b1.booking_time + (b1.turn_time_minutes || ' minutes')::interval)
          OVERLAPS (b2.booking_time, b2.booking_time + (b2.turn_time_minutes || ' minutes')::interval)
    GROUP BY bt1.table_id
  )
  SELECT COUNT(*) INTO v_table_conflicts FROM conflicts;

  -- Check stale pending bookings
  SELECT COUNT(*) INTO v_stale_pending
  FROM bookings
  WHERE status = 'pending'
    AND created_at < now() - INTERVAL '2 hours';

  v_result := jsonb_build_object(
    'status', CASE 
      WHEN v_orphaned_tables > 0 OR v_table_conflicts > 0 THEN 'critical'
      WHEN v_stale_pending > 5 THEN 'warning'
      ELSE 'healthy'
    END,
    'metrics', jsonb_build_object(
      'pending_bookings', v_pending_bookings,
      'upcoming_24h', v_upcoming_bookings,
      'orphaned_tables', v_orphaned_tables,
      'table_conflicts', v_table_conflicts,
      'stale_pending', v_stale_pending
    ),
    'checked_at', now()
  );

  -- Auto-fix orphaned tables if found
  IF v_orphaned_tables > 0 THEN
    DELETE FROM booking_tables
    WHERE booking_id NOT IN (SELECT id FROM bookings);
    
    v_result := v_result || jsonb_build_object('auto_fixed_orphans', v_orphaned_tables);
  END IF;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."check_booking_system_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_in_booking"("p_booking_id" "uuid", "p_checked_in_by" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking record;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
    AND status = 'confirmed';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not in confirmed status';
  END IF;
  
  -- Check if within valid check-in window (1 hour before to 30 minutes after)
  IF v_booking.booking_time > now() + INTERVAL '1 hour' OR
     v_booking.booking_time < now() - INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'Check-in is only allowed from 1 hour before to 30 minutes after booking time';
  END IF;
  
  -- Record check-in
  INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by, reason)
  VALUES (p_booking_id, 'confirmed', 'checked_in', p_checked_in_by, 'Guest arrived');
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."check_in_booking"("p_booking_id" "uuid", "p_checked_in_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_loyalty_rules_for_booking"("p_booking_id" "uuid") RETURNS TABLE("rule_id" "uuid", "points_to_award" integer, "rule_name" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking RECORD;
  v_restaurant_balance integer;
BEGIN
  -- Get booking details
  SELECT 
    b.*,
    EXTRACT(DOW FROM b.booking_time AT TIME ZONE 'UTC')::integer as day_of_week,
    EXTRACT(HOUR FROM b.booking_time AT TIME ZONE 'UTC') * 60 + 
    EXTRACT(MINUTE FROM b.booking_time AT TIME ZONE 'UTC') as time_minutes
  INTO v_booking
  FROM bookings b
  WHERE b.id = p_booking_id;
  
  -- Check if booking exists
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Get restaurant balance
  SELECT current_balance INTO v_restaurant_balance
  FROM restaurant_loyalty_balance rlb
  WHERE rlb.restaurant_id = v_booking.restaurant_id;
  
  -- If no balance or zero balance, return empty
  IF v_restaurant_balance IS NULL OR v_restaurant_balance = 0 THEN
    RETURN;
  END IF;
  
  -- Find applicable rules
  RETURN QUERY
  WITH user_rule_counts AS (
    SELECT 
      ulru.rule_id as usage_rule_id, 
      COUNT(*) as use_count
    FROM user_loyalty_rule_usage ulru
    WHERE ulru.user_id = v_booking.user_id
    GROUP BY ulru.rule_id
  )
  SELECT 
    rlr.id as rule_id,
    rlr.points_to_award,
    rlr.rule_name
  FROM restaurant_loyalty_rules rlr
  LEFT JOIN user_rule_counts urc ON urc.usage_rule_id = rlr.id
  WHERE 
    rlr.restaurant_id = v_booking.restaurant_id
    AND rlr.is_active = true
    AND (rlr.valid_from IS NULL OR rlr.valid_from <= v_booking.booking_time)
    AND (rlr.valid_until IS NULL OR rlr.valid_until >= v_booking.booking_time)
    AND v_booking.day_of_week = ANY(rlr.applicable_days)
    AND (rlr.start_time_minutes IS NULL OR v_booking.time_minutes >= rlr.start_time_minutes)
    AND (rlr.end_time_minutes IS NULL OR v_booking.time_minutes <= rlr.end_time_minutes)
    AND v_booking.party_size >= rlr.minimum_party_size
    AND (rlr.maximum_party_size IS NULL OR v_booking.party_size <= rlr.maximum_party_size)
    AND (rlr.max_uses_total IS NULL OR rlr.current_uses < rlr.max_uses_total)
    AND (rlr.max_uses_per_user IS NULL OR COALESCE(urc.use_count, 0) < rlr.max_uses_per_user)
    AND rlr.points_to_award <= v_restaurant_balance
  ORDER BY rlr.priority DESC, rlr.points_to_award DESC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."check_loyalty_rules_for_booking"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_loyalty_rules"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE restaurant_loyalty_rules
  SET is_active = false
  WHERE 
    is_active = true
    AND valid_until IS NOT NULL
    AND valid_until < now();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_loyalty_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_notifications"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM public.notifications 
  WHERE read = true 
  AND created_at < NOW() - INTERVAL '30 days';
  
  -- Delete unread notifications older than 90 days
  DELETE FROM public.notifications 
  WHERE read = false 
  AND created_at < NOW() - INTERVAL '90 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_booking_and_finalize_loyalty"("p_booking_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking record;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
    AND status = 'confirmed';
    
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update booking status to completed
  UPDATE bookings
  SET 
    status = 'completed',
    updated_at = now()
  WHERE id = p_booking_id;
  
  -- If loyalty points weren't awarded yet (edge case), award them now
  IF v_booking.applied_loyalty_rule_id IS NOT NULL AND v_booking.loyalty_points_earned = 0 THEN
    PERFORM award_restaurant_loyalty_points(p_booking_id);
  END IF;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."complete_booking_and_finalize_loyalty"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text" DEFAULT NULL::"text", "p_occasion" "text" DEFAULT NULL::"text", "p_dietary_notes" "text"[] DEFAULT NULL::"text"[], "p_table_preferences" "text"[] DEFAULT NULL::"text"[], "p_is_group_booking" boolean DEFAULT false, "p_applied_offer_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking bookings;
  v_table_id uuid;
  v_conflict_id uuid;
  v_confirmation_code text;
  v_retry_count integer := 0;
  v_max_retries integer := 10;
  v_is_vip boolean;
  v_max_booking_days integer;
  v_restaurant_status text;
BEGIN
  -- Check if restaurant exists and is active
  SELECT status INTO v_restaurant_status
  FROM restaurants WHERE id = p_restaurant_id;
  
  IF v_restaurant_status IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;
  
  IF v_restaurant_status != 'active' THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting bookings';
  END IF;

  -- Check VIP status and booking window
  SELECT EXISTS (
    SELECT 1 FROM restaurant_vip_users
    WHERE user_id = p_user_id 
    AND restaurant_id = p_restaurant_id
    AND valid_until > now()
    AND extended_booking_days IS NOT NULL
  ) INTO v_is_vip;
  
  -- Get booking window
  IF v_is_vip THEN
    SELECT COALESCE(extended_booking_days, 60) INTO v_max_booking_days
    FROM restaurant_vip_users
    WHERE user_id = p_user_id AND restaurant_id = p_restaurant_id;
  ELSE
    SELECT COALESCE(booking_window_days, 30) INTO v_max_booking_days
    FROM restaurants WHERE id = p_restaurant_id;
  END IF;
  
  -- Validate booking is within allowed window
  IF p_booking_time > now() + (v_max_booking_days || ' days')::interval THEN
    RAISE EXCEPTION 'Booking date is beyond allowed window of % days', v_max_booking_days;
  END IF;
  
  -- Validate booking is in the future (at least 15 minutes from now)
  IF p_booking_time <= now() + interval '15 minutes' THEN
    RAISE EXCEPTION 'Booking time must be at least 15 minutes in the future';
  END IF;

  -- Generate unique confirmation code with retry logic
  LOOP
    v_confirmation_code := 'BK' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
    
    IF NOT EXISTS (SELECT 1 FROM bookings WHERE confirmation_code = v_confirmation_code) THEN
      EXIT;
    END IF;
    
    v_retry_count := v_retry_count + 1;
    IF v_retry_count > v_max_retries THEN
      RAISE EXCEPTION 'Unable to generate unique confirmation code after % attempts', v_max_retries;
    END IF;
  END LOOP;

  -- Validate table combination if multiple tables
  IF array_length(p_table_ids, 1) > 1 THEN
    DECLARE
      v_total_capacity integer;
      v_combinable_count integer;
      v_active_count integer;
    BEGIN
      SELECT 
        SUM(capacity), 
        COUNT(CASE WHEN is_combinable THEN 1 END),
        COUNT(CASE WHEN is_active THEN 1 END)
      INTO v_total_capacity, v_combinable_count, v_active_count
      FROM restaurant_tables
      WHERE id = ANY(p_table_ids)
        AND restaurant_id = p_restaurant_id;
      
      -- Check all tables belong to the restaurant and are active
      IF v_active_count < array_length(p_table_ids, 1) THEN
        RAISE EXCEPTION 'One or more selected tables are not available';
      END IF;
      
      IF v_combinable_count < array_length(p_table_ids, 1) THEN
        RAISE EXCEPTION 'Not all selected tables can be combined';
      END IF;
      
      IF v_total_capacity IS NULL OR v_total_capacity < p_party_size THEN
        RAISE EXCEPTION 'Selected tables do not have enough capacity for party of %', p_party_size;
      END IF;
      
      -- Don't allow excessive over-capacity
      IF v_total_capacity > p_party_size + 4 THEN
        RAISE EXCEPTION 'Selected tables have too much excess capacity. Please choose a better fit.';
      END IF;
    END;
  ELSIF array_length(p_table_ids, 1) = 1 THEN
    -- Validate single table
    DECLARE
      v_table_capacity integer;
      v_table_min_capacity integer;
      v_table_max_capacity integer;
    BEGIN
      SELECT capacity, min_capacity, max_capacity
      INTO v_table_capacity, v_table_min_capacity, v_table_max_capacity
      FROM restaurant_tables
      WHERE id = p_table_ids[1]
        AND restaurant_id = p_restaurant_id
        AND is_active = true;
        
      IF v_table_capacity IS NULL THEN
        RAISE EXCEPTION 'Selected table is not available';
      END IF;
      
      IF p_party_size < v_table_min_capacity OR p_party_size > v_table_max_capacity THEN
        RAISE EXCEPTION 'Party size does not match table capacity requirements';
      END IF;
    END;
  END IF;

  -- Final conflict check inside transaction (this is atomic!)
  SELECT check_booking_overlap(
    p_table_ids, 
    p_booking_time, 
    p_booking_time + (p_turn_time || ' minutes')::interval
  ) INTO v_conflict_id;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Table is no longer available. Please select another time.';
  END IF;

  -- Create the booking
  INSERT INTO bookings (
    user_id, 
    restaurant_id, 
    booking_time, 
    party_size, 
    status,
    special_requests, 
    occasion,
    dietary_notes,
    table_preferences,
    turn_time_minutes, 
    confirmation_code,
    is_group_booking,
    applied_offer_id,
    created_at,
    updated_at
  ) VALUES (
    p_user_id, 
    p_restaurant_id, 
    p_booking_time, 
    p_party_size, 
    'confirmed',
    p_special_requests, 
    p_occasion,
    p_dietary_notes,
    p_table_preferences,
    p_turn_time, 
    v_confirmation_code,
    p_is_group_booking,
    p_applied_offer_id,
    now(),
    now()
  ) RETURNING * INTO v_booking;

  -- Link tables to booking
  IF array_length(p_table_ids, 1) > 0 THEN
    FOREACH v_table_id IN ARRAY p_table_ids LOOP
      INSERT INTO booking_tables (booking_id, table_id)
      VALUES (v_booking.id, v_table_id);
    END LOOP;
  END IF;

  -- Return booking with additional info
  RETURN json_build_object(
    'booking', row_to_json(v_booking),
    'tables', p_table_ids,
    'is_vip', v_is_vip,
    'booking_window_days', v_max_booking_days
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error for debugging
    RAISE NOTICE 'Error in create_booking_with_tables: %', SQLERRM;
    -- Re-raise with context
    RAISE;
END;
$$;


ALTER FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text" DEFAULT NULL::"text", "p_occasion" "text" DEFAULT NULL::"text", "p_dietary_notes" "text"[] DEFAULT NULL::"text"[], "p_table_preferences" "text"[] DEFAULT NULL::"text"[], "p_is_group_booking" boolean DEFAULT false, "p_applied_offer_id" "uuid" DEFAULT NULL::"uuid", "p_booking_policy" "text" DEFAULT 'instant'::"text", "p_expected_loyalty_points" integer DEFAULT 0, "p_applied_loyalty_rule_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking bookings;
  v_table_id uuid;
  v_conflict_id uuid;
  v_confirmation_code text;
  v_retry_count integer := 0;
  v_max_retries integer := 10;
  v_is_vip boolean;
  v_max_booking_days integer;
  v_restaurant_status text;
  v_existing_booking_id uuid;
  v_existing_confirmation_code text;
  v_existing_status text;
  v_booking_status text;
  v_booking_end_time timestamp with time zone;
BEGIN
  -- Calculate booking end time
  v_booking_end_time := p_booking_time + (p_turn_time || ' minutes')::interval;

  -- CRITICAL: Check if user already has a booking at this restaurant that overlaps with the requested time
  -- This prevents the user from double-booking themselves
  SELECT b.id, b.confirmation_code, b.status 
  INTO v_existing_booking_id, v_existing_confirmation_code, v_existing_status
  FROM bookings b
  WHERE b.user_id = p_user_id
    AND b.restaurant_id = p_restaurant_id
    AND b.status IN ('pending', 'confirmed')
    -- Check for time overlap using the actual booking window
    AND (
      (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval) 
      OVERLAPS 
      (p_booking_time, v_booking_end_time)
    );
  
  IF v_existing_booking_id IS NOT NULL THEN
    -- User already has a booking that overlaps with this time
    -- Raise a proper error instead of returning success
    RAISE EXCEPTION 'DUPLICATE_BOOKING: You already have a booking at this restaurant around this time. Confirmation code: %. Please choose a different time slot.', v_existing_confirmation_code
      USING ERRCODE = 'P0002';
  END IF;

  -- Also check for exact duplicate (same time and party size) - this catches rapid clicks
  SELECT id INTO v_existing_booking_id
  FROM bookings
  WHERE user_id = p_user_id
    AND restaurant_id = p_restaurant_id
    AND booking_time = p_booking_time
    AND party_size = p_party_size
    AND status IN ('pending', 'confirmed')
    AND created_at > now() - interval '30 seconds'; -- Recent duplicate attempt
  
  IF v_existing_booking_id IS NOT NULL THEN
    -- This is likely a double-click scenario
    RAISE EXCEPTION 'DUPLICATE_BOOKING: A booking request was just submitted. Please wait a moment and check your bookings.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Check if restaurant exists and is active
  SELECT status INTO v_restaurant_status
  FROM restaurants WHERE id = p_restaurant_id;
  
  IF v_restaurant_status IS NULL THEN
    RAISE EXCEPTION 'Restaurant not found';
  END IF;
  
  IF v_restaurant_status != 'active' THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting bookings';
  END IF;

  -- Check VIP status and booking window
  SELECT EXISTS (
    SELECT 1 FROM restaurant_vip_users
    WHERE user_id = p_user_id 
    AND restaurant_id = p_restaurant_id
    AND valid_until > now()
    AND extended_booking_days IS NOT NULL
  ) INTO v_is_vip;
  
  -- Get booking window
  IF v_is_vip THEN
    SELECT COALESCE(extended_booking_days, 60) INTO v_max_booking_days
    FROM restaurant_vip_users
    WHERE user_id = p_user_id AND restaurant_id = p_restaurant_id;
  ELSE
    SELECT COALESCE(booking_window_days, 30) INTO v_max_booking_days
    FROM restaurants WHERE id = p_restaurant_id;
  END IF;
  
  -- Validate booking is within allowed window
  IF p_booking_time > now() + (v_max_booking_days || ' days')::interval THEN
    RAISE EXCEPTION 'Booking date is beyond allowed window of % days', v_max_booking_days;
  END IF;
  
  -- Validate booking is in the future (at least 15 minutes from now)
  IF p_booking_time <= now() + interval '15 minutes' THEN
    RAISE EXCEPTION 'Booking time must be at least 15 minutes in the future';
  END IF;

  -- Generate unique confirmation code with improved algorithm
  LOOP
    -- Use a combination of timestamp, random UUID, and counter for better uniqueness
    v_confirmation_code := 'BK' || 
      TO_CHAR(now(), 'YYMMDD') || 
      UPPER(SUBSTRING(MD5(gen_random_uuid()::text || v_retry_count::text) FROM 1 FOR 6));
    
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM bookings WHERE confirmation_code = v_confirmation_code) THEN
      EXIT;
    END IF;
    
    v_retry_count := v_retry_count + 1;
    IF v_retry_count > v_max_retries THEN
      -- If we can't generate a unique code, use a longer one
      v_confirmation_code := 'BK' || UPPER(REPLACE(gen_random_uuid()::text, '-', ''));
      EXIT;
    END IF;
  END LOOP;

  -- Determine booking status based on policy
  IF p_booking_policy = 'request' THEN
    v_booking_status := 'pending';
  ELSE
    v_booking_status := 'confirmed';
  END IF;

  -- Validate tables only for instant bookings
  IF v_booking_status = 'confirmed' AND array_length(p_table_ids, 1) > 0 THEN
    -- Validate table combination if multiple tables
    IF array_length(p_table_ids, 1) > 1 THEN
      DECLARE
        v_total_capacity integer;
        v_combinable_count integer;
        v_active_count integer;
      BEGIN
        SELECT 
          SUM(capacity), 
          COUNT(CASE WHEN is_combinable THEN 1 END),
          COUNT(CASE WHEN is_active THEN 1 END)
        INTO v_total_capacity, v_combinable_count, v_active_count
        FROM restaurant_tables
        WHERE id = ANY(p_table_ids)
          AND restaurant_id = p_restaurant_id;
        
        IF v_active_count < array_length(p_table_ids, 1) THEN
          RAISE EXCEPTION 'One or more selected tables are not available';
        END IF;
        
        IF v_combinable_count < array_length(p_table_ids, 1) THEN
          RAISE EXCEPTION 'Not all selected tables can be combined';
        END IF;
        
        IF v_total_capacity IS NULL OR v_total_capacity < p_party_size THEN
          RAISE EXCEPTION 'Selected tables do not have enough capacity for party of %', p_party_size;
        END IF;
        
        IF v_total_capacity > p_party_size + 4 THEN
          RAISE EXCEPTION 'Selected tables have too much excess capacity. Please choose a better fit.';
        END IF;
      END;
    ELSIF array_length(p_table_ids, 1) = 1 THEN
      -- Validate single table
      DECLARE
        v_table_capacity integer;
        v_table_min_capacity integer;
        v_table_max_capacity integer;
      BEGIN
        SELECT capacity, min_capacity, max_capacity
        INTO v_table_capacity, v_table_min_capacity, v_table_max_capacity
        FROM restaurant_tables
        WHERE id = p_table_ids[1]
          AND restaurant_id = p_restaurant_id
          AND is_active = true;
          
        IF v_table_capacity IS NULL THEN
          RAISE EXCEPTION 'Selected table is not available';
        END IF;
        
        IF p_party_size < v_table_min_capacity OR p_party_size > v_table_max_capacity THEN
          RAISE EXCEPTION 'Party size does not match table capacity requirements';
        END IF;
      END;
    END IF;

    -- Final conflict check for confirmed bookings with OTHER users' bookings
    SELECT b.id INTO v_conflict_id
    FROM bookings b
    JOIN booking_tables bt ON b.id = bt.booking_id
    WHERE bt.table_id = ANY(p_table_ids)
      AND b.status IN ('confirmed', 'pending')
      AND b.user_id != p_user_id  -- Exclude current user's bookings (already checked above)
      AND (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval)
          OVERLAPS (p_booking_time, v_booking_end_time)
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Table is no longer available. Another guest just booked this table. Please select another time.';
    END IF;
  END IF;

  -- Create the booking with duplicate prevention
  BEGIN
    INSERT INTO bookings (
      user_id, 
      restaurant_id, 
      booking_time, 
      party_size, 
      status,
      special_requests, 
      occasion,
      dietary_notes,
      table_preferences,
      turn_time_minutes, 
      confirmation_code,
      is_group_booking,
      applied_offer_id,
      expected_loyalty_points,
      applied_loyalty_rule_id,
      created_at,
      updated_at
    ) VALUES (
      p_user_id, 
      p_restaurant_id, 
      p_booking_time, 
      p_party_size, 
      v_booking_status,
      p_special_requests, 
      p_occasion,
      p_dietary_notes,
      p_table_preferences,
      p_turn_time, 
      v_confirmation_code,
      p_is_group_booking,
      p_applied_offer_id,
      p_expected_loyalty_points,
      p_applied_loyalty_rule_id,
      now(),
      now()
    ) RETURNING * INTO v_booking;
  EXCEPTION 
    WHEN unique_violation THEN
      -- This should rarely happen due to our checks above, but handle it gracefully
      RAISE EXCEPTION 'DUPLICATE_BOOKING: Unable to create booking. You may already have a booking for this time. Please check your bookings and try again.'
        USING ERRCODE = 'P0002';
  END;

  -- Link tables to booking (only for confirmed bookings)
  IF v_booking_status = 'confirmed' AND array_length(p_table_ids, 1) > 0 THEN
    FOREACH v_table_id IN ARRAY p_table_ids LOOP
      INSERT INTO booking_tables (booking_id, table_id)
      VALUES (v_booking.id, v_table_id)
      ON CONFLICT DO NOTHING; -- Prevent duplicate table assignments
    END LOOP;
  END IF;

  -- Return booking with additional info
  RETURN json_build_object(
    'booking', row_to_json(v_booking),
    'tables', p_table_ids,
    'is_vip', v_is_vip,
    'booking_window_days', v_max_booking_days,
    'is_duplicate_attempt', false
  );
END;
$$;


ALTER FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid", "p_booking_policy" "text", "p_expected_loyalty_points" integer, "p_applied_loyalty_rule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_with_tables_debug"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text" DEFAULT NULL::"text", "p_occasion" "text" DEFAULT NULL::"text", "p_dietary_notes" "text"[] DEFAULT NULL::"text"[], "p_table_preferences" "text"[] DEFAULT NULL::"text"[], "p_is_group_booking" boolean DEFAULT false, "p_applied_offer_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking bookings;
  v_table_id uuid;
  v_conflict_id uuid;
  v_confirmation_code text;
  v_retry_count integer := 0;
  v_max_retries integer := 10;
  v_debug_info jsonb := '{}';
  v_table_assignments jsonb := '[]';
BEGIN
  -- Debug logging
  v_debug_info := v_debug_info || jsonb_build_object(
    'input_table_ids', p_table_ids,
    'table_count', COALESCE(array_length(p_table_ids, 1), 0),
    'party_size', p_party_size,
    'booking_time', p_booking_time
  );

  -- Generate confirmation code
  LOOP
    v_confirmation_code := 'BK' || UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8));
    IF NOT EXISTS (SELECT 1 FROM bookings WHERE confirmation_code = v_confirmation_code) THEN
      EXIT;
    END IF;
    v_retry_count := v_retry_count + 1;
    IF v_retry_count > v_max_retries THEN
      RAISE EXCEPTION 'Unable to generate unique confirmation code';
    END IF;
  END LOOP;

  -- Check for conflicts if tables provided
  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    SELECT check_booking_overlap(
      p_table_ids, 
      p_booking_time, 
      p_booking_time + (p_turn_time || ' minutes')::interval
    ) INTO v_conflict_id;

    v_debug_info := v_debug_info || jsonb_build_object('conflict_check', v_conflict_id);

    IF v_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Table is no longer available. Conflict with booking %', v_conflict_id;
    END IF;
  END IF;

  -- Create booking
  INSERT INTO bookings (
    user_id, restaurant_id, booking_time, party_size, status,
    special_requests, occasion, dietary_notes, table_preferences,
    turn_time_minutes, confirmation_code, is_group_booking,
    applied_offer_id, created_at, updated_at
  ) VALUES (
    p_user_id, p_restaurant_id, p_booking_time, p_party_size, 'confirmed',
    p_special_requests, p_occasion, p_dietary_notes, p_table_preferences,
    p_turn_time, v_confirmation_code, p_is_group_booking,
    p_applied_offer_id, now(), now()
  ) RETURNING * INTO v_booking;

  v_debug_info := v_debug_info || jsonb_build_object('booking_created', v_booking.id);

  -- Assign tables
  IF p_table_ids IS NOT NULL AND array_length(p_table_ids, 1) > 0 THEN
    FOREACH v_table_id IN ARRAY p_table_ids LOOP
      BEGIN
        INSERT INTO booking_tables (booking_id, table_id)
        VALUES (v_booking.id, v_table_id);
        
        v_table_assignments := v_table_assignments || jsonb_build_object(
          'table_id', v_table_id,
          'assigned', true
        );
      EXCEPTION
        WHEN foreign_key_violation THEN
          v_table_assignments := v_table_assignments || jsonb_build_object(
            'table_id', v_table_id,
            'assigned', false,
            'error', 'Invalid table ID'
          );
        WHEN OTHERS THEN
          v_table_assignments := v_table_assignments || jsonb_build_object(
            'table_id', v_table_id,
            'assigned', false,
            'error', SQLERRM
          );
      END;
    END LOOP;
  END IF;

  v_debug_info := v_debug_info || jsonb_build_object('table_assignments', v_table_assignments);

  -- Return detailed result
  RETURN json_build_object(
    'booking', row_to_json(v_booking),
    'tables', p_table_ids,
    'debug', v_debug_info
  );
END;
$$;


ALTER FUNCTION "public"."create_booking_with_tables_debug"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_booking_reminders"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  r record;
  v_title text;
  v_msg text;
  v_data jsonb;
  v_deeplink text;
BEGIN
  -- 24h reminders (type: booking_reminder_24h)
  FOR r IN
    SELECT b.*
    FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = b.user_id
          AND n.category = 'booking'
          AND n.type = 'booking_reminder_24h'
          AND (n.data->>'bookingId')::uuid = b.id
      )
  LOOP
    v_title := 'Upcoming Booking (Tomorrow)';
    v_msg := 'Reminder: You have a booking tomorrow.';
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder_24h', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
  END LOOP;

  -- 2h reminders (type: booking_reminder_2h)
  FOR r IN
    SELECT b.*
    FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '110 minutes' AND now() + interval '130 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = b.user_id
          AND n.category = 'booking'
          AND n.type = 'booking_reminder_2h'
          AND (n.data->>'bookingId')::uuid = b.id
      )
  LOOP
    v_title := 'Upcoming Booking (2 hours)';
    v_msg := 'Reminder: Your booking is in about 2 hours.';
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder_2h', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
  END LOOP;

  -- 1h reminders (type: booking_reminder_1h)
  FOR r IN
    SELECT b.*
    FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '50 minutes' AND now() + interval '70 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications n
        WHERE n.user_id = b.user_id
          AND n.category = 'booking'
          AND n.type = 'booking_reminder_1h'
          AND (n.data->>'bookingId')::uuid = b.id
      )
  LOOP
    v_title := 'Upcoming Booking (1 hour)';
    v_msg := 'Reminder: Your booking is in about 1 hour.';
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder_1h', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."enqueue_booking_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_notification"("p_user_id" "uuid", "p_category" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb", "p_deeplink" "text" DEFAULT NULL::"text", "p_channels" "text"[] DEFAULT ARRAY['inapp'::"text", 'push'::"text"]) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_notification_id uuid;
  v_pref public.notification_preferences;
  v_channel text;
BEGIN
  SELECT * INTO v_pref FROM public.notification_preferences WHERE user_id = p_user_id;
  IF v_pref IS NULL THEN
    -- default allow (except marketing)
    INSERT INTO public.notification_preferences(user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_pref FROM public.notification_preferences WHERE user_id = p_user_id;
  END IF;

  -- Gate by category
  IF (p_category = 'marketing' AND NOT COALESCE(v_pref.marketing, FALSE)) THEN
    RETURN NULL; -- skip entirely
  END IF;
  IF (p_category = 'booking' AND NOT COALESCE(v_pref.booking, TRUE)) THEN
    RETURN NULL;
  END IF;
  IF (p_category = 'waitlist' AND NOT COALESCE(v_pref.waitlist, TRUE)) THEN
    RETURN NULL;
  END IF;
  IF (p_category = 'offers' AND NOT COALESCE(v_pref.offers, TRUE)) THEN
    RETURN NULL;
  END IF;
  IF (p_category = 'reviews' AND NOT COALESCE(v_pref.reviews, TRUE)) THEN
    RETURN NULL;
  END IF;
  IF (p_category = 'loyalty' AND NOT COALESCE(v_pref.loyalty, TRUE)) THEN
    RETURN NULL;
  END IF;
  IF (p_category = 'system' AND NOT COALESCE(v_pref.system, TRUE)) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications(user_id, type, title, message, data, category, deeplink)
  VALUES (p_user_id, p_type, p_title, p_message, p_data, p_category, p_deeplink)
  RETURNING id INTO v_notification_id;

  FOREACH v_channel IN ARRAY p_channels LOOP
    INSERT INTO public.notification_outbox(notification_id, user_id, channel, payload)
    VALUES (v_notification_id, p_user_id, v_channel, jsonb_build_object(
      'title', p_title,
      'message', p_message,
      'data', p_data,
      'deeplink', p_deeplink,
      'category', p_category,
      'type', p_type
    ));
  END LOOP;

  RETURN v_notification_id;
END;
$$;


ALTER FUNCTION "public"."enqueue_notification"("p_user_id" "uuid", "p_category" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_deeplink" "text", "p_channels" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_offer_expiry_notices"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare r record; begin
  for r in
    select uo.* from public.user_offers uo
    where uo.status='active'
      and uo.expires_at between now()+interval '36 hours' and now()+interval '60 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id=uo.user_id and n.category='offers' and n.type='offer_expiry_warning'
          and (n.data->>'userOfferId')::uuid = uo.id
      )
  loop
    perform public.enqueue_notification(r.user_id,'offers','offer_expiry_warning',
      'Offer expiring soon','One of your offers is expiring soon. Don''t miss out.',
      jsonb_build_object('userOfferId',r.id,'offerId',r.offer_id,'expiresAt',r.expires_at),
      'app://profile/my-rewards', array['inapp','push']);
  end loop;
end; $$;


ALTER FUNCTION "public"."enqueue_offer_expiry_notices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_review_reminders"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare r record; begin
  for r in
    select b.* from public.bookings b
    left join public.reviews rv on rv.booking_id = b.id
    where b.status='completed' and rv.id is null
      and b.booking_time between now()-interval '72 hours' and now()-interval '24 hours'
      and not exists (
        select 1 from public.notifications n
        where n.user_id=b.user_id and n.category='reviews' and n.type='review_reminder'
          and (n.data->>'bookingId')::uuid = b.id
      )
  loop
    perform public.enqueue_notification(r.user_id,'reviews','review_reminder',
      'How was your visit?','Leave a quick review to help others and earn points.',
      jsonb_build_object('bookingId',r.id,'restaurantId',r.restaurant_id),
      'app://profile/reviews', array['inapp','push']);
  end loop;
end; $$;


ALTER FUNCTION "public"."enqueue_review_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_old_redemptions"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.loyalty_redemptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND expires_at < NOW();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;


ALTER FUNCTION "public"."expire_old_redemptions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_old_user_offers"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.user_offers
  SET status = 'expired'
  WHERE status = 'active' 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  RETURN v_expired_count;
END;
$$;


ALTER FUNCTION "public"."expire_old_user_offers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_alternative_slots"("p_restaurant_id" "uuid", "p_original_time" timestamp with time zone, "p_party_size" integer, "p_duration_minutes" integer) RETURNS TABLE("suggested_time" timestamp with time zone, "available_tables" integer)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH time_slots AS (
    SELECT 
      generate_series(
        p_original_time - interval '2 hours',
        p_original_time + interval '2 hours',
        interval '30 minutes'
      ) AS slot_time
  ),
  slot_availability AS (
    SELECT 
      ts.slot_time,
      COUNT(DISTINCT rt.id) AS available_tables
    FROM time_slots ts
    CROSS JOIN restaurant_tables rt
    WHERE rt.restaurant_id = p_restaurant_id
      AND rt.is_active = true
      AND rt.capacity >= p_party_size
      AND NOT EXISTS (
        SELECT 1
        FROM bookings b
        JOIN booking_tables bt ON bt.booking_id = b.id
        WHERE bt.table_id = rt.id
          AND b.status IN ('confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
          AND (
            (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval)
            OVERLAPS
            (ts.slot_time, ts.slot_time + (p_duration_minutes || ' minutes')::interval)
          )
      )
    GROUP BY ts.slot_time
    HAVING COUNT(DISTINCT rt.id) > 0
  )
  SELECT 
    slot_time AS suggested_time,
    available_tables::integer
  FROM slot_availability
  WHERE slot_time != p_original_time
  ORDER BY ABS(EXTRACT(EPOCH FROM (slot_time - p_original_time)))
  LIMIT 5;
END;
$$;


ALTER FUNCTION "public"."find_alternative_slots"("p_restaurant_id" "uuid", "p_original_time" timestamp with time zone, "p_party_size" integer, "p_duration_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_booking_without_tables"("p_booking_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking record;
  v_available_table record;
  v_result jsonb;
BEGIN
  -- Get booking details
  SELECT b.*, r.id as restaurant_id
  INTO v_booking
  FROM bookings b
  JOIN restaurants r ON b.restaurant_id = r.id
  WHERE b.id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  -- Check if tables already assigned
  IF EXISTS (SELECT 1 FROM booking_tables WHERE booking_id = p_booking_id) THEN
    RETURN jsonb_build_object('error', 'Tables already assigned');
  END IF;

  -- Find an available table
  SELECT * INTO v_available_table
  FROM get_available_tables(
    v_booking.restaurant_id,
    v_booking.booking_time,
    v_booking.booking_time + (v_booking.turn_time_minutes || ' minutes')::interval,
    v_booking.party_size
  )
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No available tables found');
  END IF;

  -- Assign the table
  INSERT INTO booking_tables (booking_id, table_id)
  VALUES (p_booking_id, v_available_table.table_id);

  RETURN jsonb_build_object(
    'success', true,
    'table_assigned', v_available_table.table_number,
    'table_id', v_available_table.table_id
  );
END;
$$;


ALTER FUNCTION "public"."fix_booking_without_tables"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fix_customer_data_inconsistencies"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  fixed_count integer;
BEGIN
  RAISE NOTICE 'Checking for and fixing customer data inconsistencies...';
  
  -- Fix customers without names (use profile name for registered users)
  UPDATE restaurant_customers 
  SET guest_name = p.full_name,
      updated_at = now()
  FROM profiles p
  WHERE restaurant_customers.user_id = p.id 
  AND (restaurant_customers.guest_name IS NULL OR restaurant_customers.guest_name = '');
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % customer records with missing names', fixed_count;
  
  -- Fix negative statistics (shouldn't happen but just in case)
  UPDATE restaurant_customers
  SET 
    total_bookings = GREATEST(total_bookings, 0),
    no_show_count = GREATEST(no_show_count, 0),
    cancelled_count = GREATEST(cancelled_count, 0),
    average_party_size = GREATEST(average_party_size, 0),
    updated_at = now()
  WHERE total_bookings < 0 OR no_show_count < 0 OR cancelled_count < 0 OR average_party_size < 0;
  
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % customer records with negative statistics', fixed_count;
  
  -- Identify and report potential duplicate customers
  CREATE TEMP TABLE potential_duplicates AS
  SELECT 
    restaurant_id,
    guest_email,
    COUNT(*) as duplicate_count,
    array_agg(id) as customer_ids
  FROM restaurant_customers
  WHERE guest_email IS NOT NULL
  GROUP BY restaurant_id, guest_email
  HAVING COUNT(*) > 1;
  
  SELECT COUNT(*) INTO fixed_count FROM potential_duplicates;
  
  IF fixed_count > 0 THEN
    RAISE NOTICE 'Found % potential duplicate customer groups (same email). Manual review recommended:', fixed_count;
    -- You can uncomment this to see the details:
    -- FOR record IN SELECT * FROM potential_duplicates LOOP
    --   RAISE NOTICE 'Restaurant: %, Email: %, Count: %, IDs: %', 
    --     record.restaurant_id, record.guest_email, record.duplicate_count, record.customer_ids;
    -- END LOOP;
  ELSE
    RAISE NOTICE 'No duplicate customers found.';
  END IF;
  
  DROP TABLE potential_duplicates;
  
END;
$$;


ALTER FUNCTION "public"."fix_customer_data_inconsistencies"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_confirmation_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.confirmation_code := UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_confirmation_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number"("restaurant_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  order_count integer;
  order_number text;
BEGIN
  -- Get today's order count for this restaurant
  SELECT COUNT(*) INTO order_count
  FROM orders 
  WHERE orders.restaurant_id = generate_order_number.restaurant_id 
    AND DATE(created_at) = CURRENT_DATE;
  
  -- Generate order number: YYYYMMDD-RRR-NNN
  order_number := TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                  LPAD(SUBSTRING(restaurant_id::text FROM 1 FOR 3), 3, '0') || '-' ||
                  LPAD((order_count + 1)::text, 3, '0');
  
  RETURN order_number;
END;
$$;


ALTER FUNCTION "public"."generate_order_number"("restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_share_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_share_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_tables"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) RETURNS TABLE("table_id" "uuid", "table_number" "text", "capacity" integer, "min_capacity" integer, "max_capacity" integer, "table_type" "text", "is_combinable" boolean, "priority_score" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rt.id,
    rt.table_number,
    rt.capacity,
    rt.min_capacity,
    rt.max_capacity,
    rt.table_type,
    rt.is_combinable,
    rt.priority_score
  FROM restaurant_tables rt
  WHERE rt.restaurant_id = p_restaurant_id
    AND rt.is_active = true
    AND rt.min_capacity <= p_party_size
    AND rt.max_capacity >= p_party_size
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      JOIN booking_tables bt ON b.id = bt.booking_id
      WHERE bt.table_id = rt.id
        AND b.status IN ('confirmed', 'pending')
        AND (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval)
            OVERLAPS (p_start_time, p_end_time)
    )
  ORDER BY 
    rt.priority_score ASC, -- Lower score = higher priority
    ABS(rt.capacity - p_party_size) ASC, -- Then closest capacity match
    rt.capacity ASC; -- Then smallest suitable table
END;
$$;


ALTER FUNCTION "public"."get_available_tables"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_booked_tables_for_slot"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) RETURNS TABLE("table_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT bt.table_id
  FROM booking_tables bt
  INNER JOIN bookings b ON bt.booking_id = b.id
  WHERE b.restaurant_id = p_restaurant_id
    AND b.status NOT IN ('cancelled_by_user', 'declined_by_restaurant', 'no_show')
    AND (
      -- Check for time overlap
      (b.booking_time < p_end_time) AND 
      (b.booking_time + INTERVAL '1 minute' * COALESCE(b.turn_time_minutes, 120) > p_start_time)
    );
END;
$$;


ALTER FUNCTION "public"."get_booked_tables_for_slot"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friend_recommendations"("p_user_id" "uuid", "p_limit" integer DEFAULT 10) RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text", "avatar_url" "text", "mutual_friends_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH user_friends AS (
    SELECT CASE 
      WHEN sc.user_id = p_user_id THEN sc.friend_id
      ELSE sc.user_id
    END as friend_id
    FROM public.social_connections sc
    WHERE (sc.user_id = p_user_id OR sc.friend_id = p_user_id)
    AND sc.status = 'accepted'
  ),
  potential_friends AS (
    SELECT DISTINCT CASE 
      WHEN sc.user_id IN (SELECT friend_id FROM user_friends) THEN sc.friend_id
      ELSE sc.user_id
    END as potential_friend_id
    FROM public.social_connections sc
    WHERE sc.status = 'accepted'
    AND (sc.user_id IN (SELECT friend_id FROM user_friends) OR sc.friend_id IN (SELECT friend_id FROM user_friends))
    AND CASE 
      WHEN sc.user_id IN (SELECT friend_id FROM user_friends) THEN sc.friend_id
      ELSE sc.user_id
    END != p_user_id
    AND CASE 
      WHEN sc.user_id IN (SELECT friend_id FROM user_friends) THEN sc.friend_id
      ELSE sc.user_id
    END NOT IN (SELECT friend_id FROM user_friends)
    AND CASE 
      WHEN sc.user_id IN (SELECT friend_id FROM user_friends) THEN sc.friend_id
      ELSE sc.user_id
    END NOT IN (
      SELECT CASE 
        WHEN sc2.user_id = p_user_id THEN sc2.friend_id
        ELSE sc2.user_id
      END
      FROM public.social_connections sc2
      WHERE (sc2.user_id = p_user_id OR sc2.friend_id = p_user_id)
      AND sc2.status IN ('pending', 'blocked')
    )
  )
  SELECT 
    pf.potential_friend_id,
    p.full_name,
    p.email,
    p.avatar_url,
    COUNT(*) as mutual_friends_count
  FROM potential_friends pf
  JOIN public.profiles p ON pf.potential_friend_id = p.id
  GROUP BY pf.potential_friend_id, p.full_name, p.email, p.avatar_url
  ORDER BY mutual_friends_count DESC, p.full_name
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_friend_recommendations"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friend_suggestions"() RETURNS TABLE("id" "uuid", "full_name" "text", "avatar_url" "text", "mutual_friends_count" integer, "common_restaurants" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH user_restaurants AS (
    SELECT DISTINCT restaurant_id 
    FROM public.bookings 
    WHERE user_id = auth.uid() AND status = 'completed'
  ),
  potential_friends AS (
    SELECT DISTINCT b.user_id
    FROM public.bookings b
    INNER JOIN user_restaurants ur ON b.restaurant_id = ur.restaurant_id
    WHERE b.user_id != auth.uid() 
    AND b.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM public.friends f 
      WHERE f.user_id = auth.uid() AND f.friend_id = b.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.friend_requests fr 
      WHERE (fr.from_user_id = auth.uid() AND fr.to_user_id = b.user_id)
      OR (fr.from_user_id = b.user_id AND fr.to_user_id = auth.uid())
    )
  )
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    COUNT(DISTINCT mf.user_id)::INTEGER AS mutual_friends_count,
    COUNT(DISTINCT b.restaurant_id)::INTEGER AS common_restaurants
  FROM potential_friends pf
  INNER JOIN public.profiles p ON p.id = pf.user_id
  LEFT JOIN public.friends f ON f.friend_id = pf.user_id
  LEFT JOIN public.friends mf ON mf.user_id = f.user_id AND mf.friend_id = auth.uid()
  LEFT JOIN public.bookings b ON b.user_id = pf.user_id
  INNER JOIN user_restaurants ur ON b.restaurant_id = ur.restaurant_id
  GROUP BY p.id, p.full_name, p.avatar_url
  ORDER BY mutual_friends_count DESC, common_restaurants DESC
  LIMIT 10;
END;
$$;


ALTER FUNCTION "public"."get_friend_suggestions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_loyalty_summary"("p_user_id" "uuid") RETURNS TABLE("total_points" integer, "current_tier" "text", "points_to_next_tier" integer, "total_earned" integer, "total_redeemed" integer, "active_redemptions" integer, "tier_benefits" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_profile RECORD;
  v_total_earned INTEGER;
  v_total_redeemed INTEGER;
  v_active_redemptions INTEGER;
  v_points_to_next INTEGER;
  v_benefits JSONB;
BEGIN
  -- Get profile data
  SELECT loyalty_points, membership_tier 
  INTO v_profile
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Calculate total points earned
  SELECT COALESCE(SUM(points_earned), 0) 
  INTO v_total_earned
  FROM public.loyalty_activities 
  WHERE user_id = p_user_id AND points_earned > 0;
  
  -- Calculate total points redeemed
  SELECT COALESCE(SUM(points_cost), 0) 
  INTO v_total_redeemed
  FROM public.loyalty_redemptions 
  WHERE user_id = p_user_id;
  
  -- Count active redemptions
  SELECT COUNT(*) 
  INTO v_active_redemptions
  FROM public.loyalty_redemptions 
  WHERE user_id = p_user_id AND status = 'active' AND expires_at > NOW();
  
  -- Calculate points to next tier
  v_points_to_next := CASE
    WHEN v_profile.membership_tier = 'bronze' THEN 500 - v_profile.loyalty_points
    WHEN v_profile.membership_tier = 'silver' THEN 1500 - v_profile.loyalty_points
    WHEN v_profile.membership_tier = 'gold' THEN 3000 - v_profile.loyalty_points
    ELSE 0
  END;
  
  -- Get tier benefits
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', benefit_type,
      'value', benefit_value,
      'description', description
    )
  ) INTO v_benefits
  FROM public.tier_benefits
  WHERE tier = v_profile.membership_tier AND is_active = true;
  
  RETURN QUERY SELECT 
    v_profile.loyalty_points,
    v_profile.membership_tier,
    GREATEST(0, v_points_to_next),
    v_total_earned,
    v_total_redeemed,
    v_active_redemptions,
    COALESCE(v_benefits, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_loyalty_summary"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_max_turn_time"("p_restaurant_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
           max(turn_time_minutes),  -- true max from config if present
           240                      -- fallback only when no rows exist
         )
  from public.restaurant_turn_times
  where restaurant_id = p_restaurant_id
$$;


ALTER FUNCTION "public"."get_max_turn_time"("p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_bookings_count"("p_restaurant_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM bookings
  WHERE restaurant_id = p_restaurant_id
    AND status = 'pending'
    AND created_at >= (now() - interval '2 hours');
    
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."get_pending_bookings_count"("p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_restaurant_menu"("p_restaurant_id" "uuid") RETURNS TABLE("category_id" "uuid", "category_name" "text", "category_description" "text", "category_order" integer, "items" json)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.description,
    c.display_order,
    COALESCE(
      json_agg(
        json_build_object(
          'id', i.id,
          'name', i.name,
          'description', i.description,
          'price', i.price,
          'image_url', i.image_url,
          'dietary_tags', i.dietary_tags,
          'allergens', i.allergens,
          'calories', i.calories,
          'preparation_time', i.preparation_time,
          'is_available', i.is_available,
          'is_featured', i.is_featured,
          'display_order', i.display_order
        ) ORDER BY i.display_order, i.name
      ) FILTER (WHERE i.id IS NOT NULL),
      '[]'::json
    ) as items
  FROM public.menu_categories c
  LEFT JOIN public.menu_items i 
    ON c.id = i.category_id 
    AND i.is_available = true
  WHERE c.restaurant_id = p_restaurant_id
    AND c.is_active = true
  GROUP BY c.id, c.name, c.description, c.display_order
  ORDER BY c.display_order, c.name;
END;
$$;


ALTER FUNCTION "public"."get_restaurant_menu"("p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_restaurant_status"("p_restaurant_id" "uuid", "p_check_time" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("is_open" boolean, "reason" "text", "open_time" time without time zone, "close_time" time without time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_date DATE;
  v_time TIME;
  v_day_of_week TEXT;
BEGIN
  v_date := p_check_time::DATE;
  v_time := p_check_time::TIME;
  v_day_of_week := LOWER(to_char(p_check_time, 'Day'));
  v_day_of_week := TRIM(v_day_of_week);
  
  -- Check closures first
  IF EXISTS (
    SELECT 1 FROM restaurant_closures rc
    WHERE rc.restaurant_id = p_restaurant_id
    AND v_date BETWEEN rc.start_date AND rc.end_date
  ) THEN
    RETURN QUERY
    SELECT 
      false::BOOLEAN,
      rc.reason,
      NULL::TIME,
      NULL::TIME
    FROM restaurant_closures rc
    WHERE rc.restaurant_id = p_restaurant_id
    AND v_date BETWEEN rc.start_date AND rc.end_date
    LIMIT 1;
    RETURN;
  END IF;
  
  -- Check special hours
  IF EXISTS (
    SELECT 1 FROM restaurant_special_hours rsh
    WHERE rsh.restaurant_id = p_restaurant_id
    AND rsh.date = v_date
  ) THEN
    RETURN QUERY
    SELECT 
      CASE WHEN rsh.is_closed THEN false 
           ELSE v_time BETWEEN rsh.open_time AND rsh.close_time 
      END,
      rsh.reason,
      rsh.open_time,
      rsh.close_time
    FROM restaurant_special_hours rsh
    WHERE rsh.restaurant_id = p_restaurant_id
    AND rsh.date = v_date
    LIMIT 1;
    RETURN;
  END IF;
  
  -- Check regular hours
  RETURN QUERY
  SELECT 
    CASE WHEN rh.is_open THEN v_time BETWEEN rh.open_time AND rh.close_time 
         ELSE false 
    END,
    CASE WHEN NOT rh.is_open THEN 'Closed on ' || v_day_of_week 
         ELSE NULL 
    END,
    rh.open_time,
    rh.close_time
  FROM restaurant_hours rh
  WHERE rh.restaurant_id = p_restaurant_id
  AND rh.day_of_week = v_day_of_week
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_restaurant_status"("p_restaurant_id" "uuid", "p_check_time" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_restaurant_status"("p_restaurant_id" "uuid", "p_check_time" timestamp with time zone) IS 'Get current open/closed status for a restaurant at any given time';



CREATE OR REPLACE FUNCTION "public"."get_table_availability_by_hour"("p_restaurant_id" "uuid", "p_date" "date") RETURNS TABLE("hour" integer, "total_tables" integer, "available_tables" integer, "utilization_percentage" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH hours AS (
    SELECT generate_series(11, 22) AS hour -- 11 AM to 10 PM
  ),
  restaurant_tables AS (
    SELECT COUNT(*) AS total_count
    FROM restaurant_tables
    WHERE restaurant_id = p_restaurant_id AND is_active = true
  ),
  hourly_bookings AS (
    SELECT 
      EXTRACT(HOUR FROM b.booking_time)::INTEGER AS booking_hour,
      COUNT(DISTINCT bt.table_id) AS booked_tables
    FROM bookings b
    INNER JOIN booking_tables bt ON b.id = bt.booking_id
    WHERE b.restaurant_id = p_restaurant_id
      AND DATE(b.booking_time) = p_date
      AND b.status NOT IN ('cancelled_by_user', 'declined_by_restaurant', 'no_show')
    GROUP BY booking_hour
  )
  SELECT 
    h.hour,
    rt.total_count::INTEGER AS total_tables,
    (rt.total_count - COALESCE(hb.booked_tables, 0))::INTEGER AS available_tables,
    CASE 
      WHEN rt.total_count > 0 
      THEN ((COALESCE(hb.booked_tables, 0)::FLOAT / rt.total_count) * 100)::INTEGER
      ELSE 0 
    END AS utilization_percentage
  FROM hours h
  CROSS JOIN restaurant_tables rt
  LEFT JOIN hourly_bookings hb ON h.hour = hb.booking_hour
  ORDER BY h.hour;
END;
$$;


ALTER FUNCTION "public"."get_table_availability_by_hour"("p_restaurant_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_table_utilization_report"("p_restaurant_id" "uuid", "p_start_date" "date" DEFAULT (CURRENT_DATE - '30 days'::interval), "p_end_date" "date" DEFAULT CURRENT_DATE) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH utilization_data AS (
    SELECT 
      rt.id as table_id,
      rt.table_number,
      rt.capacity,
      COUNT(DISTINCT b.id) as total_bookings,
      COUNT(DISTINCT DATE(b.booking_time)) as days_used,
      AVG(b.party_size::float / rt.capacity) as avg_utilization_rate,
      SUM(b.party_size) as total_guests_served,
      AVG(b.turn_time_minutes) as avg_turn_time
    FROM restaurant_tables rt
    LEFT JOIN booking_tables bt ON rt.id = bt.table_id
    LEFT JOIN bookings b ON bt.booking_id = b.id
      AND b.status = 'completed'
      AND b.booking_time >= p_start_date
      AND b.booking_time < p_end_date + INTERVAL '1 day'
    WHERE rt.restaurant_id = p_restaurant_id
    GROUP BY rt.id, rt.table_number, rt.capacity
  ),
  peak_hours AS (
    SELECT 
      EXTRACT(HOUR FROM b.booking_time) as hour,
      COUNT(*) as booking_count
    FROM bookings b
    WHERE b.restaurant_id = p_restaurant_id
      AND b.status = 'completed'
      AND b.booking_time >= p_start_date
      AND b.booking_time < p_end_date + INTERVAL '1 day'
    GROUP BY EXTRACT(HOUR FROM b.booking_time)
    ORDER BY booking_count DESC
    LIMIT 3
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'table_stats', jsonb_agg(
      jsonb_build_object(
        'table_number', table_number,
        'capacity', capacity,
        'total_bookings', total_bookings,
        'days_used', days_used,
        'utilization_rate', ROUND(avg_utilization_rate * 100, 2),
        'total_guests', total_guests_served,
        'avg_turn_time_minutes', ROUND(avg_turn_time)
      ) ORDER BY avg_utilization_rate DESC NULLS LAST
    ),
    'peak_hours', (SELECT jsonb_agg(hour ORDER BY hour) FROM peak_hours),
    'summary', jsonb_build_object(
      'total_tables', COUNT(*),
      'avg_utilization', ROUND(AVG(avg_utilization_rate) * 100, 2),
      'total_bookings', SUM(total_bookings),
      'total_guests', SUM(total_guests_served)
    )
  ) INTO v_result
  FROM utilization_data;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_table_utilization_report"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_turn_time"("p_restaurant_id" "uuid", "p_party_size" integer, "p_booking_time" timestamp with time zone DEFAULT "now"()) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_turn_time integer;
  v_day_of_week integer;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_booking_time);
  
  -- Check custom turn time
  SELECT turn_time_minutes INTO v_turn_time
  FROM restaurant_turn_times
  WHERE restaurant_id = p_restaurant_id
    AND party_size = p_party_size
    AND (day_of_week IS NULL OR day_of_week = v_day_of_week)
  LIMIT 1;
  
  IF v_turn_time IS NOT NULL THEN
    RETURN v_turn_time;
  END IF;
  
  -- Default turn times by party size
  RETURN CASE
    WHEN p_party_size <= 2 THEN 90
    WHEN p_party_size <= 4 THEN 120
    WHEN p_party_size <= 6 THEN 150
    ELSE 180
  END;
END;
$$;


ALTER FUNCTION "public"."get_turn_time"("p_restaurant_id" "uuid", "p_party_size" integer, "p_booking_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_offer_stats"("p_user_id" "uuid") RETURNS TABLE("total_claimed" integer, "active_offers" integer, "used_offers" integer, "expired_offers" integer, "total_savings" numeric)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as total_claimed,
    COUNT(*) FILTER (WHERE status = 'active' AND expires_at > NOW())::INTEGER as active_offers,
    COUNT(*) FILTER (WHERE status = 'used')::INTEGER as used_offers,
    COUNT(*) FILTER (WHERE status = 'expired' OR expires_at <= NOW())::INTEGER as expired_offers,
    COALESCE(SUM(
      CASE WHEN status = 'used' THEN 
        -- Estimate savings based on discount percentage (assuming average bill of $50)
        (so.discount_percentage::decimal / 100) * 50
      ELSE 0 END
    ), 0) as total_savings
  FROM public.user_offers uo
  JOIN public.special_offers so ON uo.offer_id = so.id
  WHERE uo.user_id = p_user_id;
END;
$_$;


ALTER FUNCTION "public"."get_user_offer_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_rating_stats"("p_user_id" "uuid") RETURNS TABLE("current_rating" numeric, "total_bookings" integer, "completed_bookings" integer, "cancelled_bookings" integer, "no_show_bookings" integer, "completion_rate" numeric, "reliability_score" "text", "rating_trend" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_recent_rating DECIMAL(2,1);
  v_previous_rating DECIMAL(2,1);
BEGIN
  -- Get current stats
  SELECT 
    user_rating,
    profiles.total_bookings,
    profiles.completed_bookings,
    profiles.cancelled_bookings,
    profiles.no_show_bookings,
    CASE 
      WHEN profiles.total_bookings > 0 THEN 
        ROUND((profiles.completed_bookings::DECIMAL / profiles.total_bookings::DECIMAL) * 100, 2)
      ELSE 0.00
    END as completion_rate
  INTO 
    current_rating,
    total_bookings,
    completed_bookings,
    cancelled_bookings,
    no_show_bookings,
    completion_rate
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Determine reliability score
  reliability_score := CASE
    WHEN current_rating >= 4.5 THEN 'Excellent'
    WHEN current_rating >= 4.0 THEN 'Very Good'
    WHEN current_rating >= 3.5 THEN 'Good'
    WHEN current_rating >= 3.0 THEN 'Fair'
    ELSE 'Needs Improvement'
  END;
  
  -- Get rating trend (compare with rating from 30 days ago)
  SELECT new_rating INTO v_previous_rating
  FROM public.user_rating_history 
  WHERE user_id = p_user_id 
    AND created_at <= NOW() - INTERVAL '30 days'
  ORDER BY created_at DESC 
  LIMIT 1;
  
  rating_trend := CASE
    WHEN v_previous_rating IS NULL THEN 'New User'
    WHEN current_rating > v_previous_rating THEN 'Improving'
    WHEN current_rating < v_previous_rating THEN 'Declining'
    ELSE 'Stable'
  END;
  
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."get_user_rating_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_restaurant_loyalty_summary"("p_user_id" "uuid", "p_restaurant_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("total_points_earned" integer, "total_bookings" integer, "last_earned_date" timestamp with time zone, "restaurant_name" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(la.points_earned), 0)::integer as total_points_earned,
    COUNT(DISTINCT b.id)::integer as total_bookings,
    MAX(la.created_at) as last_earned_date,
    r.name as restaurant_name
  FROM bookings b
  JOIN restaurants r ON r.id = b.restaurant_id
  LEFT JOIN loyalty_activities la ON la.related_booking_id = b.id
  WHERE 
    b.user_id = p_user_id
    AND la.activity_type = 'booking_completed'
    AND la.metadata->>'rule_id' IS NOT NULL -- From restaurant loyalty
    AND (p_restaurant_id IS NULL OR b.restaurant_id = p_restaurant_id)
  GROUP BY r.id, r.name;
END;
$$;


ALTER FUNCTION "public"."get_user_restaurant_loyalty_summary"("p_user_id" "uuid", "p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_accepted_booking_invite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Add user as attendee
    INSERT INTO public.booking_attendees (booking_id, user_id, status)
    VALUES (NEW.booking_id, NEW.to_user_id, 'confirmed')
    ON CONFLICT (booking_id, user_id) 
    DO UPDATE SET status = 'confirmed';
    
    -- Update attendees count
    UPDATE public.bookings 
    SET attendees = attendees + 1
    WHERE id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_accepted_booking_invite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_accepted_friend_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only proceed if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Create bidirectional friendship
    INSERT INTO public.friends (user_id, friend_id)
    VALUES 
      (NEW.from_user_id, NEW.to_user_id),
      (NEW.to_user_id, NEW.from_user_id)
    ON CONFLICT (user_id, friend_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_accepted_friend_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_booking_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- When a pending booking is confirmed, award loyalty points
  IF OLD.status = 'pending' AND NEW.status = 'confirmed' AND NEW.applied_loyalty_rule_id IS NOT NULL THEN
    PERFORM award_restaurant_loyalty_points(NEW.id);
  END IF;
  
  -- When a booking is cancelled, refund loyalty points
  IF (OLD.status IN ('confirmed', 'completed') AND NEW.status IN ('cancelled_by_user', 'declined_by_restaurant')) 
     AND NEW.loyalty_points_earned > 0 THEN
    PERFORM refund_restaurant_loyalty_points(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_booking_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    phone_number,
    email
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone_number',
    NEW.email -- Use the direct 'email' column from the auth.users table
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_booking_for_update"("p_booking_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_booking record;
BEGIN
  -- Use FOR UPDATE to lock the row
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE NOWAIT;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Booking not found');
  END IF;
  
  RETURN row_to_json(v_booking);
EXCEPTION
  WHEN lock_not_available THEN
    RETURN json_build_object('error', 'Booking is being processed by another request');
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."lock_booking_for_update"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_loyalty_transaction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO loyalty_audit_log (
    action,
    restaurant_id,
    user_id,
    booking_id,
    points_amount,
    balance_before,
    balance_after,
    metadata
  ) VALUES (
    TG_OP || '_' || NEW.transaction_type,
    NEW.restaurant_id,
    NEW.user_id,
    NEW.booking_id,
    NEW.points,
    NEW.balance_before,
    NEW.balance_after,
    NEW.metadata
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_loyalty_transaction"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manage_restaurant_customers"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_customer_id uuid;
  v_customer_name text;
  v_customer_email text;
  v_customer_phone text;
BEGIN
  -- Handle both INSERT and UPDATE operations
  -- For INSERT: NEW contains the new booking data
  -- For UPDATE: NEW contains the updated booking data
  
  -- Determine customer information based on whether it's a registered user or guest
  IF NEW.user_id IS NOT NULL THEN
    -- Registered user booking
    SELECT full_name INTO v_customer_name 
    FROM profiles 
    WHERE id = NEW.user_id;
    
    v_customer_email := COALESCE(NEW.guest_email, '');
    v_customer_phone := COALESCE(NEW.guest_phone, '');
    
    -- Try to find existing customer record for this user
    SELECT id INTO v_customer_id
    FROM restaurant_customers
    WHERE restaurant_id = NEW.restaurant_id 
    AND user_id = NEW.user_id;
    
    -- If customer doesn't exist, create new record
    IF v_customer_id IS NULL THEN
      INSERT INTO restaurant_customers (
        restaurant_id, 
        user_id, 
        guest_name, 
        guest_email, 
        guest_phone,
        first_visit
      )
      VALUES (
        NEW.restaurant_id, 
        NEW.user_id, 
        COALESCE(NEW.guest_name, v_customer_name),
        v_customer_email,
        v_customer_phone,
        NEW.booking_time
      )
      RETURNING id INTO v_customer_id;
      
      RAISE LOG 'Created new customer record for user_id: % at restaurant: %', NEW.user_id, NEW.restaurant_id;
    ELSE
      -- Update existing customer record with any new information
      UPDATE restaurant_customers
      SET 
        guest_name = COALESCE(NEW.guest_name, guest_name, v_customer_name),
        guest_email = COALESCE(NEW.guest_email, guest_email),
        guest_phone = COALESCE(NEW.guest_phone, guest_phone),
        updated_at = now()
      WHERE id = v_customer_id;
    END IF;
    
  ELSIF NEW.guest_email IS NOT NULL THEN
    -- Guest booking with email
    v_customer_name := COALESCE(NEW.guest_name, 'Guest');
    v_customer_email := NEW.guest_email;
    v_customer_phone := COALESCE(NEW.guest_phone, '');
    
    -- Try to find existing guest customer record
    SELECT id INTO v_customer_id
    FROM restaurant_customers
    WHERE restaurant_id = NEW.restaurant_id 
    AND guest_email = NEW.guest_email
    AND user_id IS NULL;
    
    -- If guest customer doesn't exist, create new record
    IF v_customer_id IS NULL THEN
      INSERT INTO restaurant_customers (
        restaurant_id, 
        guest_email, 
        guest_name, 
        guest_phone,
        first_visit
      )
      VALUES (
        NEW.restaurant_id, 
        NEW.guest_email, 
        v_customer_name,
        v_customer_phone,
        NEW.booking_time
      )
      RETURNING id INTO v_customer_id;
      
      RAISE LOG 'Created new guest customer record for email: % at restaurant: %', NEW.guest_email, NEW.restaurant_id;
    ELSE
      -- Update existing guest record
      UPDATE restaurant_customers
      SET 
        guest_name = COALESCE(NEW.guest_name, guest_name),
        guest_phone = COALESCE(NEW.guest_phone, guest_phone),
        updated_at = now()
      WHERE id = v_customer_id;
    END IF;
    
  ELSE
    -- No user_id or guest_email - this shouldn't happen with proper constraints
    RAISE WARNING 'Booking created without user_id or guest_email: %', NEW.id;
    RETURN NEW;
  END IF;

  -- Update customer statistics regardless of whether record was created or updated
  IF v_customer_id IS NOT NULL THEN
    UPDATE restaurant_customers
    SET 
      total_bookings = (
        SELECT COUNT(*) 
        FROM bookings 
        WHERE restaurant_id = NEW.restaurant_id 
        AND (
          (user_id = NEW.user_id AND NEW.user_id IS NOT NULL) OR 
          (guest_email = NEW.guest_email AND NEW.guest_email IS NOT NULL AND NEW.user_id IS NULL)
        )
        AND status IN ('confirmed', 'completed')
      ),
      last_visit = CASE 
        WHEN NEW.status IN ('confirmed', 'completed') AND NEW.booking_time > COALESCE(last_visit, '1900-01-01'::timestamp)
        THEN NEW.booking_time 
        ELSE last_visit 
      END,
      average_party_size = (
        SELECT ROUND(AVG(party_size), 1) 
        FROM bookings 
        WHERE restaurant_id = NEW.restaurant_id 
        AND (
          (user_id = NEW.user_id AND NEW.user_id IS NOT NULL) OR 
          (guest_email = NEW.guest_email AND NEW.guest_email IS NOT NULL AND NEW.user_id IS NULL)
        )
        AND status IN ('confirmed', 'completed')
      ),
      no_show_count = (
        SELECT COUNT(*) 
        FROM bookings 
        WHERE restaurant_id = NEW.restaurant_id 
        AND (
          (user_id = NEW.user_id AND NEW.user_id IS NOT NULL) OR 
          (guest_email = NEW.guest_email AND NEW.guest_email IS NOT NULL AND NEW.user_id IS NULL)
        )
        AND status = 'no_show'
      ),
      cancelled_count = (
        SELECT COUNT(*) 
        FROM bookings 
        WHERE restaurant_id = NEW.restaurant_id 
        AND (
          (user_id = NEW.user_id AND NEW.user_id IS NOT NULL) OR 
          (guest_email = NEW.guest_email AND NEW.guest_email IS NOT NULL AND NEW.user_id IS NULL)
        )
        AND status LIKE 'cancelled%'
      ),
      updated_at = now()
    WHERE id = v_customer_id;
    
    RAISE LOG 'Updated customer statistics for customer_id: %', v_customer_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."manage_restaurant_customers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_existing_bookings_to_customers"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  booking_record RECORD;
  v_customer_id uuid;
BEGIN
  -- Loop through all existing bookings and ensure customers exist
  FOR booking_record IN 
    SELECT b.restaurant_id, b.user_id, b.guest_email, b.guest_name, b.guest_phone,
           MIN(b.booking_time) as first_booking
    FROM bookings b
    LEFT JOIN restaurant_customers rc ON (
      (b.user_id = rc.user_id AND b.restaurant_id = rc.restaurant_id) OR
      (b.guest_email = rc.guest_email AND b.restaurant_id = rc.restaurant_id AND b.user_id IS NULL)
    )
    WHERE rc.id IS NULL  -- Only process bookings without customer records
    GROUP BY b.restaurant_id, b.user_id, b.guest_email, b.guest_name, b.guest_phone
  LOOP
    -- Create customer record
    IF booking_record.user_id IS NOT NULL THEN
      INSERT INTO restaurant_customers (
        restaurant_id, user_id, guest_name, guest_email, guest_phone, first_visit
      )
      SELECT 
        booking_record.restaurant_id, 
        booking_record.user_id, 
        COALESCE(booking_record.guest_name, p.full_name),
        booking_record.guest_email,
        booking_record.guest_phone,
        booking_record.first_booking
      FROM profiles p WHERE p.id = booking_record.user_id
      ON CONFLICT (restaurant_id, user_id) DO NOTHING
      RETURNING id INTO v_customer_id;
      
    ELSIF booking_record.guest_email IS NOT NULL THEN
      INSERT INTO restaurant_customers (
        restaurant_id, guest_email, guest_name, guest_phone, first_visit
      )
      VALUES (
        booking_record.restaurant_id, 
        booking_record.guest_email, 
        COALESCE(booking_record.guest_name, 'Guest'),
        booking_record.guest_phone,
        booking_record.first_booking
      )
      ON CONFLICT (restaurant_id, guest_email) DO NOTHING
      RETURNING id INTO v_customer_id;
    END IF;
    
    RAISE LOG 'Migrated customer for restaurant: %, user: %, email: %', 
      booking_record.restaurant_id, booking_record.user_id, booking_record.guest_email;
  END LOOP;
  
  RAISE NOTICE 'Migration completed. All existing bookings now have customer records.';
END;
$$;


ALTER FUNCTION "public"."migrate_existing_bookings_to_customers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_booking_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    restaurant_name TEXT;
    booking_date TEXT;
    booking_time TEXT;
    notification_title TEXT;
    notification_body TEXT;
    notification_data JSONB;
BEGIN
    -- Only process status changes
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Get restaurant name
    SELECT name INTO restaurant_name
    FROM restaurants
    WHERE id = NEW.restaurant_id;
    
    -- Format booking date and time
    booking_date := to_char(NEW.booking_time, 'YYYY-MM-DD');
    booking_time := to_char(NEW.booking_time, 'HH12:MI AM');
    
    -- Prepare notification data
    notification_data := jsonb_build_object(
        'type', 'booking',
        'bookingId', NEW.id,
        'restaurantId', NEW.restaurant_id,
        'restaurantName', restaurant_name,
        'date', booking_date,
        'time', booking_time,
        'partySize', NEW.party_size
    );
    
    -- Determine notification content based on status
    CASE NEW.status
        WHEN 'confirmed' THEN
            notification_title := '✅ Booking Confirmed!';
            notification_body := format('Your table for %s at %s is confirmed for %s at %s.',
                NEW.party_size, restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'confirmed');
            
        WHEN 'cancelled' THEN
            notification_title := '❌ Booking Cancelled';
            notification_body := format('Your booking at %s for %s at %s has been cancelled.',
                restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'cancelled');
            
        WHEN 'declined' THEN
            notification_title := '😔 Booking Declined';
            notification_body := format('%s couldn''t accommodate your request for %s at %s. Try booking a different time.',
                restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'declined');
            
        ELSE
            -- Don't send notification for other statuses
            RETURN NEW;
    END CASE;
    
    -- Send notification with type
    PERFORM send_push_notification(
        NEW.user_id,
        notification_title,
        notification_body,
        notification_data,
        'high',
        CASE NEW.status
            WHEN 'confirmed' THEN 'booking_confirmation'
            WHEN 'cancelled' THEN 'booking_cancellation'
            WHEN 'declined' THEN 'booking_cancellation'
            ELSE 'general'
        END
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_booking_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_booking_status_change"() IS 'Trigger function to send notifications when booking status changes';



CREATE OR REPLACE FUNCTION "public"."notify_friend_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  requester_name TEXT;
BEGIN
  -- Get requester name
  SELECT full_name INTO requester_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Create notification for friend
  PERFORM public.create_notification(
    NEW.friend_id,
    'friend_request',
    'New Friend Request',
    requester_name || ' wants to connect with you',
    jsonb_build_object('connection_id', NEW.id, 'requester_id', NEW.user_id)
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_friend_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_friend_request_accepted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  accepter_name TEXT;
BEGIN
  -- Only notify when status changes to accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Get accepter name
    SELECT full_name INTO accepter_name
    FROM public.profiles
    WHERE id = NEW.friend_id;
    
    -- Create notification for original requester
    PERFORM public.create_notification(
      NEW.user_id,
      'friend_request_accepted',
      'Friend Request Accepted',
      accepter_name || ' accepted your friend request',
      jsonb_build_object('friend_id', NEW.friend_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_friend_request_accepted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_loyalty_points_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    points_difference INTEGER;
    notification_title TEXT;
    notification_body TEXT;
    notification_data JSONB;
BEGIN
    -- Only process points increases
    IF TG_OP = 'UPDATE' AND NEW.loyalty_points <= OLD.loyalty_points THEN
        RETURN NEW;
    END IF;
    
    points_difference := NEW.loyalty_points - OLD.loyalty_points;
    
    -- Only notify for significant point gains (more than 10 points)
    IF points_difference <= 10 THEN
        RETURN NEW;
    END IF;
    
    -- Prepare notification
    notification_title := '🎯 Points Earned!';
    notification_body := format('You earned %s loyalty points!', points_difference);
    notification_data := jsonb_build_object(
        'type', 'loyalty',
        'points', points_difference,
        'totalPoints', NEW.loyalty_points,
        'action', 'points_earned'
    );
    
    -- Send notification with type
    PERFORM send_push_notification(
        NEW.id,
        notification_title,
        notification_body,
        notification_data,
        'default',
        'points_earned'
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_loyalty_points_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_loyalty_points_change"() IS 'Trigger function to send notifications when loyalty points increase';



CREATE OR REPLACE FUNCTION "public"."notify_shared_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  sharer_name TEXT;
  restaurant_name TEXT;
  booking_date TEXT;
BEGIN
  -- Get sharer name and booking details
  SELECT 
    p.full_name,
    r.name,
    TO_CHAR(b.booking_time, 'Mon DD, YYYY')
  INTO sharer_name, restaurant_name, booking_date
  FROM public.bookings b
  JOIN public.profiles p ON b.user_id = p.id
  JOIN public.restaurants r ON b.restaurant_id = r.id
  WHERE b.id = NEW.booking_id;
  
  -- Create notification for shared user
  PERFORM public.create_notification(
    NEW.shared_with_user_id,
    'booking_shared',
    'Booking Shared With You',
    sharer_name || ' shared a booking at ' || restaurant_name || ' on ' || booking_date,
    jsonb_build_object(
      'shared_booking_id', NEW.id,
      'booking_id', NEW.booking_id,
      'sharer_name', sharer_name,
      'restaurant_name', restaurant_name
    )
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_shared_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_shared_booking_accepted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  accepter_name TEXT;
  restaurant_name TEXT;
  booking_owner_id UUID;
BEGIN
  -- Only notify when accepted status changes to true
  IF OLD.accepted = false AND NEW.accepted = true THEN
    -- Get accepter name, restaurant name, and booking owner
    SELECT 
      p.full_name,
      r.name,
      b.user_id
    INTO accepter_name, restaurant_name, booking_owner_id
    FROM public.profiles p
    JOIN public.shared_bookings sb ON p.id = sb.shared_with_user_id
    JOIN public.bookings b ON sb.booking_id = b.id
    JOIN public.restaurants r ON b.restaurant_id = r.id
    WHERE sb.id = NEW.id;
    
    -- Create notification for booking owner
    PERFORM public.create_notification(
      booking_owner_id,
      'shared_booking_accepted',
      'Shared Booking Accepted',
      accepter_name || ' accepted your shared booking at ' || restaurant_name,
      jsonb_build_object(
        'accepter_name', accepter_name,
        'restaurant_name', restaurant_name,
        'booking_id', NEW.booking_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_shared_booking_accepted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_waitlist_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    restaurant_name TEXT;
    notification_title TEXT;
    notification_body TEXT;
    notification_data JSONB;
    requested_date TEXT;
BEGIN
    -- Only process status changes
    IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Get restaurant name
    SELECT name INTO restaurant_name
    FROM restaurants
    WHERE id = NEW.restaurant_id;
    
    -- Format requested date
    requested_date := to_char(NEW.desired_date, 'YYYY-MM-DD');
    
    -- Prepare notification data
    notification_data := jsonb_build_object(
        'type', 'waitlist',
        'entryId', NEW.id,
        'restaurantId', NEW.restaurant_id,
        'restaurantName', restaurant_name,
        'requestedDate', requested_date,
        'partySize', NEW.party_size
    );
    
    -- Determine notification content based on status
    CASE NEW.status
        WHEN 'notified' THEN
            notification_title := '🎉 Table Available!';
            notification_body := format('A table for %s at %s is now available for %s!',
                NEW.party_size, restaurant_name, requested_date);
            notification_data := notification_data || jsonb_build_object('action', 'available');
            
        WHEN 'expired' THEN
            notification_title := '⏰ Waitlist Expired';
            notification_body := format('Your waiting list entry at %s has expired.',
                restaurant_name);
            notification_data := notification_data || jsonb_build_object('action', 'expired');
            
        ELSE
            -- Don't send notification for other statuses
            RETURN NEW;
    END CASE;
    
    -- Send notification with type
    PERFORM send_push_notification(
        NEW.user_id,
        notification_title,
        notification_body,
        notification_data,
        'high',
        CASE NEW.status
            WHEN 'notified' THEN 'waitlist_available'
            WHEN 'expired' THEN 'waitlist_expired'
            ELSE 'general'
        END
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_waitlist_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_waitlist_status_change"() IS 'Trigger function to send notifications when waitlist status changes';



CREATE OR REPLACE FUNCTION "public"."perform_daily_maintenance"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_result jsonb := '{}';
  v_status_update jsonb;
  v_archive_result jsonb;
  v_health_check jsonb;
BEGIN
  -- 1. Update booking statuses
  v_status_update := update_booking_statuses();
  
  -- 2. Archive old bookings (keep 90 days by default)
  v_archive_result := archive_old_bookings(90);
  
  -- 3. Refresh materialized view
  PERFORM refresh_table_availability();
  
  -- 4. Run health check
  v_health_check := check_booking_system_health();
  
  -- 5. Analyze tables for query optimization
  ANALYZE bookings;
  ANALYZE booking_tables;
  ANALYZE restaurant_tables;
  
  v_result := jsonb_build_object(
    'maintenance_date', CURRENT_DATE,
    'status_updates', v_status_update,
    'archive_results', v_archive_result,
    'health_check', v_health_check,
    'completed_at', now()
  );
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."perform_daily_maintenance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quick_availability_check"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_available_tables integer;
  v_should_block_pending boolean;
BEGIN
  v_should_block_pending := should_block_pending_bookings(p_restaurant_id);
  
  SELECT COUNT(*)
  INTO v_available_tables
  FROM restaurant_tables rt
  WHERE rt.restaurant_id = p_restaurant_id
    AND rt.is_active = true
    AND rt.capacity >= p_party_size
    AND NOT EXISTS (
      SELECT 1
      FROM booking_tables bt
      JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.table_id = rt.id
        AND b.restaurant_id = p_restaurant_id
        AND b.status IN (
          'confirmed',
          CASE WHEN v_should_block_pending THEN 'pending' ELSE NULL END
        )
        AND b.booking_time < p_end_time
        AND (b.booking_time + (b.turn_time_minutes || ' minutes')::interval) > p_start_time
    )
  LIMIT 1;
    
  RETURN v_available_tables > 0;
END;
$$;


ALTER FUNCTION "public"."quick_availability_check"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_loyalty_reward"("p_user_id" "uuid", "p_reward_id" "uuid" DEFAULT NULL::"uuid", "p_offer_id" "uuid" DEFAULT NULL::"uuid", "p_points_cost" integer DEFAULT NULL::integer) RETURNS TABLE("redemption_id" "uuid", "redemption_code" "text", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_user_points INTEGER;
  v_user_tier TEXT;
  v_reward_points INTEGER;
  v_reward_tier TEXT;
  v_expires_at TIMESTAMPTZ;
  v_redemption_id UUID;
  v_redemption_code TEXT;
BEGIN
  -- Validate input
  IF (p_reward_id IS NULL AND p_offer_id IS NULL) OR 
     (p_reward_id IS NOT NULL AND p_offer_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Must specify either reward_id or offer_id, but not both';
  END IF;
  
  -- Get user's current points and tier
  SELECT loyalty_points, membership_tier 
  INTO v_user_points, v_user_tier
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Get reward details
  IF p_reward_id IS NOT NULL THEN
    SELECT points_cost, tier_required 
    INTO v_reward_points, v_reward_tier
    FROM public.loyalty_rewards 
    WHERE id = p_reward_id AND is_active = true;
    
    IF v_reward_points IS NULL THEN
      RAISE EXCEPTION 'Reward not found or inactive';
    END IF;
  ELSE
    -- For offers, use provided points cost
    v_reward_points := COALESCE(p_points_cost, 0);
    v_reward_tier := 'bronze'; -- Default for offers
  END IF;
  
  -- Check if user has enough points
  IF v_user_points < v_reward_points THEN
    RAISE EXCEPTION 'Insufficient points: have %, need %', v_user_points, v_reward_points;
  END IF;
  
  -- Check tier requirement
  IF (v_reward_tier = 'silver' AND v_user_tier = 'bronze') OR
     (v_reward_tier = 'gold' AND v_user_tier IN ('bronze', 'silver')) OR
     (v_reward_tier = 'platinum' AND v_user_tier IN ('bronze', 'silver', 'gold')) THEN
    RAISE EXCEPTION 'Insufficient tier: have %, need %', v_user_tier, v_reward_tier;
  END IF;
  
  -- Set expiry date (30 days from now)
  v_expires_at := NOW() + INTERVAL '30 days';
  
  -- Deduct points
  PERFORM award_loyalty_points_with_tracking(
    p_user_id,
    -v_reward_points,
    'reward_redemption',
    'Redeemed reward for ' || v_reward_points || ' points'
  );
  
  -- Create redemption record
  INSERT INTO public.loyalty_redemptions (
    user_id,
    reward_id,
    offer_id,
    points_cost,
    expires_at
  ) VALUES (
    p_user_id,
    p_reward_id,
    p_offer_id,
    v_reward_points,
    v_expires_at
  ) RETURNING id, redemption_code, expires_at 
  INTO v_redemption_id, v_redemption_code, v_expires_at;
  
  RETURN QUERY SELECT v_redemption_id, v_redemption_code, v_expires_at;
END;
$$;


ALTER FUNCTION "public"."redeem_loyalty_reward"("p_user_id" "uuid", "p_reward_id" "uuid", "p_offer_id" "uuid", "p_points_cost" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_table_availability"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_table_availability;
EXCEPTION
  WHEN OTHERS THEN
    -- If concurrent refresh fails, do regular refresh
    REFRESH MATERIALIZED VIEW mv_table_availability;
END;
$$;


ALTER FUNCTION "public"."refresh_table_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_restaurant_loyalty_points"("p_booking_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking RECORD;
  v_current_balance integer;
  v_loyalty_activity RECORD;
BEGIN
  -- Get booking details with loyalty info
  SELECT b.*
  INTO v_booking
  FROM bookings b
  WHERE b.id = p_booking_id
    AND b.applied_loyalty_rule_id IS NOT NULL
    AND b.loyalty_points_earned > 0;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'No booking found with loyalty points to refund: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Get loyalty activity for this booking
  SELECT la.*
  INTO v_loyalty_activity
  FROM loyalty_activities la
  WHERE la.related_booking_id = p_booking_id
    AND la.activity_type = 'booking_completed'
    AND la.points_earned > 0;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'No loyalty activity found for booking: %', p_booking_id;
    RETURN false;
  END IF;
  
  -- Lock restaurant balance
  SELECT rlb.current_balance 
  INTO v_current_balance
  FROM restaurant_loyalty_balance rlb
  WHERE rlb.restaurant_id = v_booking.restaurant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'Restaurant balance not found: %', v_booking.restaurant_id;
    RETURN false;
  END IF;
  
  BEGIN
    -- Refund to restaurant balance
    UPDATE restaurant_loyalty_balance
    SET 
      current_balance = current_balance + v_booking.loyalty_points_earned,
      updated_at = now()
    WHERE restaurant_id = v_booking.restaurant_id;
    
    -- Record transaction
    INSERT INTO restaurant_loyalty_transactions (
      restaurant_id,
      transaction_type,
      points,
      balance_before,
      balance_after,
      description,
      booking_id,
      user_id
    ) VALUES (
      v_booking.restaurant_id,
      'refund',
      v_booking.loyalty_points_earned,
      v_current_balance,
      v_current_balance + v_booking.loyalty_points_earned,
      'Points refunded due to booking cancellation',
      p_booking_id,
      v_booking.user_id
    );
    
    -- Deduct points from user
    UPDATE profiles
    SET loyalty_points = GREATEST(0, loyalty_points - v_booking.loyalty_points_earned)
    WHERE id = v_booking.user_id;
    
    -- Update loyalty activity to negative (refund)
    UPDATE loyalty_activities
    SET 
      points_earned = -v_loyalty_activity.points_earned,
      description = v_loyalty_activity.description || ' (Refunded due to cancellation)',
      metadata = COALESCE(v_loyalty_activity.metadata, '{}'::jsonb) || jsonb_build_object('refunded_at', now(), 'reason', 'booking_cancelled')
    WHERE id = v_loyalty_activity.id;
    
    -- Update rule usage
    UPDATE restaurant_loyalty_rules
    SET current_uses = GREATEST(0, current_uses - 1)
    WHERE id = v_booking.applied_loyalty_rule_id;
    
    -- Remove user usage record
    DELETE FROM user_loyalty_rule_usage ulru
    WHERE ulru.booking_id = p_booking_id
      AND ulru.user_id = v_booking.user_id
      AND ulru.rule_id = v_booking.applied_loyalty_rule_id;
    
    -- Reset booking loyalty fields
    UPDATE bookings
    SET 
      loyalty_points_earned = 0,
      updated_at = now()
    WHERE id = p_booking_id;
    
    RAISE NOTICE 'Successfully refunded % points for booking %', v_booking.loyalty_points_earned, p_booking_id;
    RETURN true;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error refunding loyalty points: %', SQLERRM;
    RETURN false;
  END;
END;
$$;


ALTER FUNCTION "public"."refund_restaurant_loyalty_points"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_notify"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select public._http_post_edge('notify');
$$;


ALTER FUNCTION "public"."run_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."run_schedule_reminders"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select public._http_post_edge('schedule-reminders');
$$;


ALTER FUNCTION "public"."run_schedule_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_users"("search_query" "text") RETURNS TABLE("id" "uuid", "full_name" "text", "avatar_url" "text", "is_friend" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    EXISTS (
      SELECT 1 FROM public.friends f 
      WHERE f.user_id = auth.uid() AND f.friend_id = p.id
    ) AS is_friend
  FROM public.profiles p
  WHERE 
    p.id != auth.uid() AND
    (
      p.full_name ILIKE '%' || search_query || '%' OR
      p.phone_number ILIKE '%' || search_query || '%'
    )
  ORDER BY p.full_name
  LIMIT 20;
END;
$$;


ALTER FUNCTION "public"."search_users"("search_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_push_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT NULL::"jsonb", "p_priority" "text" DEFAULT 'default'::"text", "p_notification_type" "text" DEFAULT 'general'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    function_url TEXT;
    payload JSONB;
    response TEXT;
BEGIN
    -- Check if user should receive this notification
    IF NOT should_send_notification(p_user_id, p_notification_type) THEN
        RAISE NOTICE 'Notification blocked by user preferences: % for user %', p_notification_type, p_user_id;
        RETURN;
    END IF;
    
    -- Get the Supabase function URL from environment or use default
    function_url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification';
    
    -- Prepare payload
    payload := jsonb_build_object(
        'userId', p_user_id,
        'title', p_title,
        'body', p_body,
        'data', COALESCE(p_data, '{}'::jsonb),
        'priority', p_priority
    );
    
    -- Call the Edge Function asynchronously using pg_net (if available)
    BEGIN
        SELECT net.http_post(
            url := function_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
            ),
            body := payload
        ) INTO response;
    EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the main transaction
        RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    END;
END;
$$;


ALTER FUNCTION "public"."send_push_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_priority" "text", "p_notification_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."send_push_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_priority" "text", "p_notification_type" "text") IS 'Sends push notifications via Edge Function';



CREATE OR REPLACE FUNCTION "public"."set_booking_request_expiry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only set expiry for bookings that start as 'pending' (requests)
  IF NEW.status = 'pending' THEN
    NEW.request_expires_at := NEW.booking_time - interval '10 minutes';
  ELSE
    -- For instant bookings (confirmed, etc.), clear the expiry
    NEW.request_expires_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_booking_request_expiry"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_share_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_public = true AND NEW.share_code IS NULL THEN
    LOOP
      NEW.share_code := generate_share_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM restaurant_playlists 
        WHERE share_code = NEW.share_code AND id != NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_share_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_offer_expiry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Set expiry date if not provided
  IF NEW.expires_at IS NULL THEN
    SELECT calculate_offer_expiry(
      NEW.claimed_at,
      so.valid_until
    ) INTO NEW.expires_at
    FROM special_offers so
    WHERE so.id = NEW.offer_id;
  END IF;
  
  -- Set redemption code if not provided
  IF NEW.redemption_code IS NULL THEN
    NEW.redemption_code := encode(gen_random_bytes(8), 'hex');
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_user_offer_expiry"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."should_block_pending_bookings"("p_restaurant_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking_policy text;
BEGIN
  SELECT booking_policy INTO v_booking_policy
  FROM restaurants
  WHERE id = p_restaurant_id;
  
  -- For request bookings, we should still block the slot even if pending
  -- to prevent double bookings while restaurant is reviewing
  RETURN v_booking_policy = 'request';
END;
$$;


ALTER FUNCTION "public"."should_block_pending_bookings"("p_restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."should_send_notification"("p_user_id" "uuid", "p_notification_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    prefs notification_preferences;
    current_time_val TIME; -- Renamed from current_time to current_time_val
    should_send BOOLEAN := false;
BEGIN
    -- Get user preferences
    prefs := get_user_notification_preferences(p_user_id);
    
    -- Check if push notifications are globally disabled
    IF NOT prefs.push_notifications_enabled THEN
        RETURN false;
    END IF;
    
    -- Check quiet hours
    IF prefs.quiet_hours_enabled THEN
        current_time_val := CURRENT_TIME; -- Using PostgreSQL's CURRENT_TIME function
        
        -- Handle quiet hours that span midnight
        IF prefs.quiet_hours_start > prefs.quiet_hours_end THEN
            -- Quiet hours span midnight (e.g., 22:00 to 08:00)
            IF current_time_val >= prefs.quiet_hours_start OR current_time_val <= prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        ELSE
            -- Normal quiet hours (e.g., 01:00 to 06:00)
            IF current_time_val >= prefs.quiet_hours_start AND current_time_val <= prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        END IF;
    END IF;
    
    -- Rest of the function remains the same
    CASE p_notification_type
        WHEN 'booking_confirmation' THEN should_send := prefs.booking_confirmations;
        WHEN 'booking_reminder' THEN should_send := prefs.booking_reminders;
        WHEN 'booking_cancellation' THEN should_send := prefs.booking_cancellations;
        WHEN 'booking_modification' THEN should_send := prefs.booking_modifications;
        
        WHEN 'waitlist_available' THEN should_send := prefs.waitlist_available;
        WHEN 'waitlist_position_update' THEN should_send := prefs.waitlist_position_updates;
        WHEN 'waitlist_expired' THEN should_send := prefs.waitlist_expired;
        
        WHEN 'special_offer' THEN should_send := prefs.special_offers;
        WHEN 'loyalty_offer' THEN should_send := prefs.loyalty_offers;
        WHEN 'expiring_offer' THEN should_send := prefs.expiring_offers;
        
        WHEN 'review_reminder' THEN should_send := prefs.review_reminders;
        WHEN 'review_response' THEN should_send := prefs.review_responses;
        WHEN 'review_featured' THEN should_send := prefs.review_featured;
        
        WHEN 'points_earned' THEN should_send := prefs.points_earned;
        WHEN 'milestone_reached' THEN should_send := prefs.milestone_reached;
        WHEN 'reward_available' THEN should_send := prefs.rewards_available;
        WHEN 'reward_expiring' THEN should_send := prefs.rewards_expiring;
        
        WHEN 'app_update' THEN should_send := prefs.app_updates;
        WHEN 'maintenance_notice' THEN should_send := prefs.maintenance_notices;
        WHEN 'security_alert' THEN should_send := prefs.security_alerts;
        
        ELSE should_send := true; -- Default to true for unknown types
    END CASE;
    
    RETURN should_send;
END;
$$;


ALTER FUNCTION "public"."should_send_notification"("p_user_id" "uuid", "p_notification_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."should_send_notification"("p_user_id" "uuid", "p_notification_type" "text") IS 'Checks if a user should receive a specific type of notification based on their preferences';



CREATE OR REPLACE FUNCTION "public"."suggest_optimal_tables"("p_restaurant_id" "uuid", "p_party_size" integer, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) RETURNS TABLE("table_ids" "uuid"[], "total_capacity" integer, "requires_combination" boolean)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_single_table RECORD;
  v_combination UUID[];
  v_total_cap INTEGER;
BEGIN
  -- First, try to find a single table
  SELECT t.id, t.capacity
  INTO v_single_table
  FROM restaurant_tables t
  WHERE t.restaurant_id = p_restaurant_id
    AND t.is_active = true
    AND t.capacity >= p_party_size
    AND COALESCE(t.min_capacity, 1) <= p_party_size
    AND NOT EXISTS (
      SELECT 1 FROM booking_tables bt
      INNER JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.table_id = t.id
        AND b.status NOT IN ('cancelled_by_user', 'declined_by_restaurant', 'no_show')
        AND (b.booking_time < p_end_time) 
        AND (b.booking_time + INTERVAL '1 minute' * COALESCE(b.turn_time_minutes, 120) > p_start_time)
    )
  ORDER BY 
    ABS(t.capacity - p_party_size), -- Prefer closer capacity
    t.priority_score DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT ARRAY[v_single_table.id], v_single_table.capacity, false;
    RETURN;
  END IF;

  -- If no single table, try combinations (simplified for 2 tables)
  SELECT ARRAY[t1.id, t2.id], t1.capacity + t2.capacity
  INTO v_combination, v_total_cap
  FROM restaurant_tables t1
  CROSS JOIN restaurant_tables t2
  WHERE t1.restaurant_id = p_restaurant_id
    AND t2.restaurant_id = p_restaurant_id
    AND t1.id < t2.id -- Avoid duplicates
    AND t1.is_active = true
    AND t2.is_active = true
    AND t1.is_combinable = true
    AND t2.is_combinable = true
    AND (t1.capacity + t2.capacity) >= p_party_size
    AND (COALESCE(t1.min_capacity, 1) + COALESCE(t2.min_capacity, 1)) <= p_party_size
    -- Check both tables are available
    AND NOT EXISTS (
      SELECT 1 FROM booking_tables bt
      INNER JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.table_id IN (t1.id, t2.id)
        AND b.status NOT IN ('cancelled_by_user', 'declined_by_restaurant', 'no_show')
        AND (b.booking_time < p_end_time) 
        AND (b.booking_time + INTERVAL '1 minute' * COALESCE(b.turn_time_minutes, 120) > p_start_time)
    )
  ORDER BY 
    ABS((t1.capacity + t2.capacity) - p_party_size), -- Prefer closer capacity
    (t1.priority_score + t2.priority_score) DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_combination, v_total_cap, true;
  END IF;
END;
$$;


ALTER FUNCTION "public"."suggest_optimal_tables"("p_restaurant_id" "uuid", "p_party_size" integer, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_customer_names"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update customer names when profile full_name changes
  IF OLD.full_name IS DISTINCT FROM NEW.full_name THEN
    UPDATE restaurant_customers
    SET 
      guest_name = NEW.full_name,
      updated_at = now()
    WHERE user_id = NEW.id
    AND (guest_name IS NULL OR guest_name = OLD.full_name);
    
    RAISE LOG 'Synced customer names for user_id: %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_customer_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_notification_prefs_from_privacy"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, booking, booking_reminders, waitlist, offers, reviews, loyalty, marketing, system, security)
  VALUES (NEW.user_id, TRUE, COALESCE(NEW.push_notifications, TRUE), TRUE, COALESCE(NEW.marketing_emails, TRUE), TRUE, TRUE, COALESCE(NEW.marketing_emails, FALSE), TRUE, TRUE)
  ON CONFLICT (user_id) DO UPDATE SET
    booking_reminders = EXCLUDED.booking_reminders,
    offers = EXCLUDED.offers,
    marketing = EXCLUDED.marketing,
    updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_notification_prefs_from_privacy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_booking_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_title text;
  v_msg text;
  v_type text;
  v_data jsonb;
  v_deeplink text;
BEGIN
  v_deeplink := concat('app://booking/', NEW.id::text);

  IF (TG_OP = 'INSERT') THEN
    -- Fire immediately after a booking is created
    IF (NEW.status = 'confirmed') THEN
      v_title := 'Booking Confirmed';
      v_msg := 'Your booking has been confirmed.';
      v_type := 'booking_confirmed';
    ELSIF (NEW.status = 'pending') THEN
      v_title := 'Booking Request Submitted';
      v_msg := 'Your booking request has been submitted. We will notify you when it''s confirmed.';
      v_type := 'booking_request_submitted';
    END IF;

    IF v_type IS NOT NULL THEN
      v_data := jsonb_build_object('bookingId', NEW.id, 'restaurantId', NEW.restaurant_id, 'time', NEW.booking_time);
      PERFORM public.enqueue_notification(NEW.user_id, 'booking', v_type, v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
    END IF;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Status transitions
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      IF (NEW.status = 'confirmed') THEN
        v_title := 'Booking Confirmed';
        v_msg := 'Your booking has been confirmed.';
        v_type := 'booking_confirmed';
      ELSIF (NEW.status LIKE 'cancelled%') THEN
        v_title := 'Booking Cancelled';
        v_msg := 'Your booking has been cancelled.';
        v_type := 'booking_cancelled';
      ELSIF (NEW.status = 'declined_by_restaurant' OR NEW.status = 'auto_declined') THEN
        v_title := 'Booking Declined';
        v_msg := 'The restaurant could not accommodate your request.';
        v_type := 'booking_declined';
      END IF;
      IF v_type IS NOT NULL THEN
        v_data := jsonb_build_object('bookingId', NEW.id, 'restaurantId', NEW.restaurant_id, 'time', NEW.booking_time);
        PERFORM public.enqueue_notification(NEW.user_id, 'booking', v_type, v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
      END IF;
    END IF;

    -- Modification reminders: time/party size changed
    IF (OLD.booking_time IS DISTINCT FROM NEW.booking_time OR OLD.party_size IS DISTINCT FROM NEW.party_size) THEN
      v_title := 'Booking Updated';
      v_msg := 'Your booking details have changed.';
      v_type := 'booking_modified';
      v_data := jsonb_build_object('bookingId', NEW.id, 'restaurantId', NEW.restaurant_id, 'oldTime', OLD.booking_time, 'newTime', NEW.booking_time, 'oldParty', OLD.party_size, 'newParty', NEW.party_size);
      PERFORM public.enqueue_notification(NEW.user_id, 'booking', v_type, v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."tg_notify_booking_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_loyalty_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform public.enqueue_notification(new.user_id,'loyalty','loyalty_points',
    'Loyalty Points Update','Your loyalty balance has changed.',
    jsonb_build_object('activityId',new.id,'points',new.points_earned,'activityType',new.activity_type),
    'app://profile/loyalty', array['inapp','push']);
  return new;
end; $$;


ALTER FUNCTION "public"."tg_notify_loyalty_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_review_response"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_title text;
  v_msg text;
  v_type text;
  v_data jsonb;
BEGIN
  v_title := 'Restaurant Responded to Your Review';
  v_msg := 'A restaurant has replied to your review.';
  v_type := 'review_response';
  SELECT jsonb_build_object('reviewId', NEW.review_id, 'restaurantId', NEW.restaurant_id) INTO v_data;
  PERFORM public.enqueue_notification((SELECT user_id FROM public.reviews WHERE id = NEW.review_id), 'reviews', v_type, v_title, v_msg, v_data, 'app://profile/reviews', ARRAY['inapp','push']);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_notify_review_response"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_user_offers"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (tg_op='insert') then
    perform public.enqueue_notification(new.user_id,'offers','offer_assigned',
      'New Offer Available','You have a new promotion you can use.',
      jsonb_build_object('userOfferId',new.id,'offerId',new.offer_id,'expiresAt',new.expires_at),
      'app://profile/my-rewards', array['inapp','push']);
  elsif (tg_op='update') then
    if (old.used_at is null and new.used_at is not null) then
      perform public.enqueue_notification(new.user_id,'offers','offer_redeemed',
        'Offer Redeemed','You redeemed an offer.',
        jsonb_build_object('userOfferId',new.id,'offerId',new.offer_id,'bookingId',new.booking_id),
        'app://profile/my-rewards', array['inapp','push']);
    end if;
  end if;
  return coalesce(new, old);
end; $$;


ALTER FUNCTION "public"."tg_notify_user_offers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_notify_waitlist_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_title text;
  v_msg text;
  v_type text;
  v_data jsonb;
  v_deeplink text;
BEGIN
  v_deeplink := concat('app://waiting-list');
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      IF (NEW.status = 'notified') THEN
        v_title := 'Table Available!';
        v_msg := 'A table is available in your selected time range.';
        v_type := 'waiting_list_available';
      ELSIF (NEW.status = 'expired') THEN
        v_title := 'Waitlist Expired';
        v_msg := 'Your waitlist entry has expired.';
        v_type := 'waiting_list_expired';
      ELSIF (NEW.status = 'booked') THEN
        v_title := 'Waitlist Converted';
        v_msg := 'Your waitlist entry has been converted into a booking!';
        v_type := 'waiting_list_converted';
      END IF;
      IF v_type IS NOT NULL THEN
        v_data := jsonb_build_object('entryId', NEW.id, 'restaurantId', NEW.restaurant_id, 'desiredDate', NEW.desired_date, 'timeRange', NEW.desired_time_range);
        PERFORM public.enqueue_notification(NEW.user_id, 'waitlist', v_type, v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_notify_waitlist_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_favorite"("restaurant_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF EXISTS(
    SELECT 1 FROM favorites 
    WHERE user_id = uid 
    AND favorites.restaurant_id = toggle_favorite.restaurant_id
  ) THEN
    DELETE FROM favorites 
    WHERE user_id = uid 
    AND favorites.restaurant_id = toggle_favorite.restaurant_id;
  ELSE
    INSERT INTO favorites (user_id, restaurant_id) 
    VALUES (uid, toggle_favorite.restaurant_id);
  END IF;
END;
$$;


ALTER FUNCTION "public"."toggle_favorite"("restaurant_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_refresh_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Use pg_notify to trigger async refresh
  PERFORM pg_notify('refresh_availability', json_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'time', now()
  )::text);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_refresh_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_update_user_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only update rating for relevant status changes
  IF NEW.status IN ('completed', 'cancelled_by_user', 'no_show') AND 
     (OLD.status IS DISTINCT FROM NEW.status) THEN
    
    PERFORM update_user_rating(
      NEW.user_id, 
      NEW.id, 
      CASE NEW.status
        WHEN 'completed' THEN 'booking_completed'
        WHEN 'cancelled_by_user' THEN 'booking_cancelled'
        WHEN 'no_show' THEN 'no_show'
        ELSE 'status_change'
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_update_user_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_all_customer_statistics"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  customer_record RECORD;
  stats_record RECORD;
  processed_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting customer statistics update...';
  
  -- Loop through all customers and calculate their statistics
  FOR customer_record IN 
    SELECT id, restaurant_id, user_id, guest_email
    FROM restaurant_customers
    ORDER BY restaurant_id, id
  LOOP
    -- Calculate statistics for this customer
    SELECT 
      COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END) as total_bookings,
      COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_count,
      COUNT(CASE WHEN b.status LIKE 'cancelled%' THEN 1 END) as cancelled_count,
      ROUND(AVG(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.party_size END), 1) as average_party_size,
      MIN(b.booking_time) as first_visit,
      MAX(CASE WHEN b.status IN ('confirmed', 'completed') THEN b.booking_time END) as last_visit
    INTO stats_record
    FROM bookings b
    WHERE b.restaurant_id = customer_record.restaurant_id
    AND (
      (customer_record.user_id IS NOT NULL AND b.user_id = customer_record.user_id) OR
      (customer_record.user_id IS NULL AND b.guest_email = customer_record.guest_email)
    );
    
    -- Update the customer record with calculated statistics
    UPDATE restaurant_customers
    SET 
      total_bookings = COALESCE(stats_record.total_bookings, 0),
      no_show_count = COALESCE(stats_record.no_show_count, 0),
      cancelled_count = COALESCE(stats_record.cancelled_count, 0),
      average_party_size = COALESCE(stats_record.average_party_size, 0),
      first_visit = COALESCE(stats_record.first_visit, first_visit), -- Keep existing if no bookings found
      last_visit = stats_record.last_visit, -- This can be NULL if no confirmed/completed bookings
      updated_at = now()
    WHERE id = customer_record.id;
    
    processed_count := processed_count + 1;
    
    -- Log progress every 100 customers
    IF processed_count % 100 = 0 THEN
      RAISE NOTICE 'Processed % customers...', processed_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Customer statistics update completed. Processed % customers total.', processed_count;
  
  -- Show summary statistics
  RAISE NOTICE 'Summary of updated customer statistics:';
  
  FOR stats_record IN
    SELECT 
      COUNT(*) as total_customers,
      COUNT(CASE WHEN total_bookings > 0 THEN 1 END) as customers_with_bookings,
      COUNT(CASE WHEN total_bookings >= 5 THEN 1 END) as loyal_customers,
      COUNT(CASE WHEN total_bookings >= 10 THEN 1 END) as vip_customers,
      ROUND(AVG(total_bookings), 2) as avg_bookings_per_customer,
      MAX(total_bookings) as max_bookings_single_customer
    FROM restaurant_customers
  LOOP
    RAISE NOTICE 'Total customers: %', stats_record.total_customers;
    RAISE NOTICE 'Customers with bookings: %', stats_record.customers_with_bookings;
    RAISE NOTICE 'Loyal customers (5+ bookings): %', stats_record.loyal_customers;
    RAISE NOTICE 'VIP customers (10+ bookings): %', stats_record.vip_customers;
    RAISE NOTICE 'Average bookings per customer: %', stats_record.avg_bookings_per_customer;
    RAISE NOTICE 'Max bookings by single customer: %', stats_record.max_bookings_single_customer;
  END LOOP;
  
END;
$$;


ALTER FUNCTION "public"."update_all_customer_statistics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_booking_statuses"() RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_completed_count integer := 0;
  v_no_show_count integer := 0;
  v_cancelled_count integer := 0;
  v_booking record;
  v_current_time timestamptz := now();
BEGIN
  -- Start transaction
  BEGIN
    -- 1. Mark completed bookings (2 hours after end time)
    FOR v_booking IN 
      SELECT id, status, booking_time, turn_time_minutes
      FROM bookings
      WHERE status = 'confirmed'
        AND booking_time + (turn_time_minutes || ' minutes')::interval + INTERVAL '2 hours' < v_current_time
    LOOP
      UPDATE bookings
      SET status = 'completed',
          updated_at = v_current_time
      WHERE id = v_booking.id;
      
      INSERT INTO booking_status_history (booking_id, old_status, new_status, reason)
      VALUES (v_booking.id, v_booking.status, 'completed', 'Auto-completed after service time');
      
      v_completed_count := v_completed_count + 1;
    END LOOP;

    -- 2. Mark no-shows (30 minutes past booking time, not checked in)
    FOR v_booking IN 
      SELECT b.id, b.status, b.booking_time, b.turn_time_minutes
      FROM bookings b
      WHERE b.status = 'confirmed'
        AND b.booking_time + INTERVAL '30 minutes' < v_current_time
        AND b.booking_time + (b.turn_time_minutes || ' minutes')::interval > v_current_time
        AND NOT EXISTS (
          SELECT 1 FROM booking_status_history bsh 
          WHERE bsh.booking_id = b.id 
          AND bsh.new_status = 'checked_in'
        )
    LOOP
      UPDATE bookings
      SET status = 'no_show',
          updated_at = v_current_time
      WHERE id = v_booking.id;
      
      INSERT INTO booking_status_history (booking_id, old_status, new_status, reason)
      VALUES (v_booking.id, v_booking.status, 'no_show', 'Guest did not arrive within 30 minutes');
      
      v_no_show_count := v_no_show_count + 1;
    END LOOP;

    -- 3. Auto-cancel unconfirmed bookings older than 2 hours (for request-based bookings)
    FOR v_booking IN 
      SELECT id, status
      FROM bookings
      WHERE status = 'pending'
        AND created_at + INTERVAL '2 hours' < v_current_time
    LOOP
      UPDATE bookings
      SET status = 'cancelled_by_restaurant',
          updated_at = v_current_time
      WHERE id = v_booking.id;
      
      INSERT INTO booking_status_history (booking_id, old_status, new_status, reason)
      VALUES (v_booking.id, v_booking.status, 'cancelled_by_restaurant', 'Not confirmed within 2 hours');
      
      v_cancelled_count := v_cancelled_count + 1;
    END LOOP;

    -- Return summary
    RETURN jsonb_build_object(
      'completed', v_completed_count,
      'no_shows', v_no_show_count,
      'auto_cancelled', v_cancelled_count,
      'processed_at', v_current_time
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error and rollback
      RAISE NOTICE 'Error in update_booking_statuses: %', SQLERRM;
      RAISE;
  END;
END;
$$;


ALTER FUNCTION "public"."update_booking_statuses"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Find or create customer record
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO restaurant_customers (restaurant_id, user_id, guest_name, guest_email, guest_phone)
    VALUES (NEW.restaurant_id, NEW.user_id, 
            COALESCE(NEW.guest_name, (SELECT full_name FROM profiles WHERE id = NEW.user_id)),
            NEW.guest_email, NEW.guest_phone)
    ON CONFLICT (restaurant_id, user_id) 
    DO UPDATE SET 
      guest_name = COALESCE(EXCLUDED.guest_name, restaurant_customers.guest_name),
      guest_email = COALESCE(EXCLUDED.guest_email, restaurant_customers.guest_email),
      guest_phone = COALESCE(EXCLUDED.guest_phone, restaurant_customers.guest_phone)
    RETURNING id INTO v_customer_id;
  ELSIF NEW.guest_email IS NOT NULL THEN
    INSERT INTO restaurant_customers (restaurant_id, guest_email, guest_name, guest_phone)
    VALUES (NEW.restaurant_id, NEW.guest_email, NEW.guest_name, NEW.guest_phone)
    ON CONFLICT (restaurant_id, guest_email) 
    DO UPDATE SET 
      guest_name = COALESCE(EXCLUDED.guest_name, restaurant_customers.guest_name),
      guest_phone = COALESCE(EXCLUDED.guest_phone, restaurant_customers.guest_phone)
    RETURNING id INTO v_customer_id;
  END IF;

  -- Update customer statistics
  IF v_customer_id IS NOT NULL THEN
    UPDATE restaurant_customers
    SET 
      total_bookings = (
        SELECT COUNT(*) FROM bookings 
        WHERE restaurant_id = NEW.restaurant_id 
        AND (user_id = NEW.user_id OR guest_email = NEW.guest_email)
        AND status IN ('confirmed', 'completed')
      ),
      last_visit = CASE 
        WHEN NEW.status IN ('confirmed', 'completed') THEN NEW.booking_time 
        ELSE last_visit 
      END,
      first_visit = COALESCE(first_visit, NEW.booking_time),
      average_party_size = (
        SELECT AVG(party_size) FROM bookings 
        WHERE restaurant_id = NEW.restaurant_id 
        AND (user_id = NEW.user_id OR guest_email = NEW.guest_email)
        AND status IN ('confirmed', 'completed')
      ),
      no_show_count = (
        SELECT COUNT(*) FROM bookings 
        WHERE restaurant_id = NEW.restaurant_id 
        AND (user_id = NEW.user_id OR guest_email = NEW.guest_email)
        AND status = 'no_show'
      ),
      cancelled_count = (
        SELECT COUNT(*) FROM bookings 
        WHERE restaurant_id = NEW.restaurant_id 
        AND (user_id = NEW.user_id OR guest_email = NEW.guest_email)
        AND status LIKE 'cancelled%'
      ),
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_customer_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_notification_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update order totals when order items change
  UPDATE orders 
  SET 
    subtotal = (
      SELECT COALESCE(SUM(total_price), 0) 
      FROM order_items 
      WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        AND status != 'cancelled'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  -- Update total_amount (subtotal + tax)
  UPDATE orders 
  SET total_amount = subtotal + tax_amount
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_order_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_playlist_positions"("updates" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  item jsonb;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE playlist_items 
    SET position = (item->>'position')::integer
    WHERE id = (item->>'id')::uuid;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_playlist_positions"("updates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_restaurant_availability"("p_restaurant_id" "uuid", "p_date" "date", "p_time_slot" time without time zone, "p_party_size" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.restaurant_availability
  SET available_capacity = available_capacity - p_party_size
  WHERE restaurant_id = p_restaurant_id
    AND date = p_date
    AND time_slot = p_time_slot
    AND available_capacity >= p_party_size;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient availability';
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_restaurant_availability"("p_restaurant_id" "uuid", "p_date" "date", "p_time_slot" time without time zone, "p_party_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_restaurant_loyalty_balance_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_restaurant_loyalty_balance_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_restaurant_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.restaurants
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0) 
      FROM public.reviews 
      WHERE restaurant_id = NEW.restaurant_id
    ),
    total_reviews = (
      SELECT COUNT(*) 
      FROM public.reviews 
      WHERE restaurant_id = NEW.restaurant_id
    )
  WHERE id = NEW.restaurant_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_restaurant_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_restaurant_review_summary"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update the restaurant's review summary
  UPDATE public.restaurants 
  SET 
    review_summary = (
      SELECT jsonb_build_object(
        'total_reviews', COUNT(*),
        'average_rating', ROUND(AVG(rating)::numeric, 1),
        'rating_distribution', jsonb_build_object(
          '1', COUNT(*) FILTER (WHERE rating = 1),
          '2', COUNT(*) FILTER (WHERE rating = 2),
          '3', COUNT(*) FILTER (WHERE rating = 3),
          '4', COUNT(*) FILTER (WHERE rating = 4),
          '5', COUNT(*) FILTER (WHERE rating = 5)
        ),
        'detailed_ratings', jsonb_build_object(
          'food_avg', ROUND(AVG(food_rating)::numeric, 1),
          'service_avg', ROUND(AVG(service_rating)::numeric, 1),
          'ambiance_avg', ROUND(AVG(ambiance_rating)::numeric, 1),
          'value_avg', ROUND(AVG(value_rating)::numeric, 1)
        ),
        'recommendation_percentage', ROUND(
          (COUNT(*) FILTER (WHERE recommend_to_friend = true) * 100.0 / COUNT(*))::numeric, 1
        )
      )
      FROM public.reviews 
      WHERE restaurant_id = COALESCE(NEW.restaurant_id, OLD.restaurant_id)
    ),
    average_rating = (
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM public.reviews 
      WHERE restaurant_id = COALESCE(NEW.restaurant_id, OLD.restaurant_id)
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews 
      WHERE restaurant_id = COALESCE(NEW.restaurant_id, OLD.restaurant_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.restaurant_id, OLD.restaurant_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_restaurant_review_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_staff_last_login"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.restaurant_staff 
  SET last_login_at = NOW() 
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_staff_last_login"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_rating"("p_user_id" "uuid", "p_booking_id" "uuid" DEFAULT NULL::"uuid", "p_change_reason" "text" DEFAULT 'manual_update'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_old_rating DECIMAL(2,1);
  v_new_rating DECIMAL(2,1);
  v_total_bookings INTEGER;
  v_completed_bookings INTEGER;
  v_cancelled_bookings INTEGER;
  v_no_show_bookings INTEGER;
BEGIN
  -- Get current rating
  SELECT user_rating INTO v_old_rating 
  FROM public.profiles 
  WHERE id = p_user_id;
  
  -- Calculate new rating
  v_new_rating := calculate_user_rating(p_user_id);
  
  -- Get updated booking counts
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'cancelled_by_user') as cancelled,
    COUNT(*) FILTER (WHERE status = 'no_show') as no_show
  INTO v_total_bookings, v_completed_bookings, v_cancelled_bookings, v_no_show_bookings
  FROM public.bookings 
  WHERE user_id = p_user_id;
  
  -- Update user profile with new rating and counts
  UPDATE public.profiles 
  SET 
    user_rating = v_new_rating,
    total_bookings = v_total_bookings,
    completed_bookings = v_completed_bookings,
    cancelled_bookings = v_cancelled_bookings,
    no_show_bookings = v_no_show_bookings,
    rating_last_updated = NOW()
  WHERE id = p_user_id;
  
  -- Log rating change if it's different
  IF v_old_rating IS DISTINCT FROM v_new_rating THEN
    INSERT INTO public.user_rating_history (
      user_id, 
      old_rating, 
      new_rating, 
      booking_id, 
      change_reason
    ) VALUES (
      p_user_id, 
      v_old_rating, 
      v_new_rating, 
      p_booking_id, 
      p_change_reason
    );
  END IF;
END;
$$;


ALTER FUNCTION "public"."update_user_rating"("p_user_id" "uuid", "p_booking_id" "uuid", "p_change_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."use_loyalty_redemption"("p_redemption_id" "uuid", "p_user_id" "uuid", "p_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_redemption RECORD;
BEGIN
  -- Get redemption details
  SELECT * INTO v_redemption
  FROM public.loyalty_redemptions
  WHERE id = p_redemption_id AND user_id = p_user_id;
  
  IF v_redemption IS NULL THEN
    RAISE EXCEPTION 'Redemption not found';
  END IF;
  
  IF v_redemption.status != 'active' THEN
    RAISE EXCEPTION 'Redemption is not active (status: %)', v_redemption.status;
  END IF;
  
  IF v_redemption.expires_at < NOW() THEN
    -- Mark as expired
    UPDATE public.loyalty_redemptions
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_redemption_id;
    
    RAISE EXCEPTION 'Redemption has expired';
  END IF;
  
  -- Mark as used
  UPDATE public.loyalty_redemptions
  SET 
    status = 'used',
    used_at = NOW(),
    booking_id = p_booking_id,
    updated_at = NOW()
  WHERE id = p_redemption_id;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."use_loyalty_redemption"("p_redemption_id" "uuid", "p_user_id" "uuid", "p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."use_user_offer"("p_redemption_code" "text", "p_user_id" "uuid", "p_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("success" boolean, "message" "text", "offer_details" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_user_offer RECORD;
  v_offer RECORD;
BEGIN
  -- Get user offer details
  SELECT uo.*, so.title, so.discount_percentage, so.valid_until, r.name as restaurant_name
  INTO v_user_offer
  FROM public.user_offers uo
  JOIN public.special_offers so ON uo.offer_id = so.id
  JOIN public.restaurants r ON so.restaurant_id = r.id
  WHERE uo.redemption_code = p_redemption_code 
    AND uo.user_id = p_user_id;
  
  -- Check if offer exists
  IF v_user_offer IS NULL THEN
    RETURN QUERY SELECT false, 'Offer not found or invalid redemption code', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check if already used
  IF v_user_offer.status = 'used' OR v_user_offer.used_at IS NOT NULL THEN
    RETURN QUERY SELECT false, 'Offer has already been used', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check if expired
  IF v_user_offer.status = 'expired' OR 
     (v_user_offer.expires_at IS NOT NULL AND v_user_offer.expires_at < NOW()) THEN
    RETURN QUERY SELECT false, 'Offer has expired', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Check if the base offer is still valid
  IF v_user_offer.valid_until < NOW() THEN
    RETURN QUERY SELECT false, 'Offer period has ended', NULL::jsonb;
    RETURN;
  END IF;
  
  -- Mark as used
  UPDATE public.user_offers
  SET 
    status = 'used',
    used_at = NOW(),
    booking_id = p_booking_id,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('used_by_function', true)
  WHERE redemption_code = p_redemption_code;
  
  -- Return success with offer details
  RETURN QUERY SELECT 
    true,
    'Offer successfully used',
    jsonb_build_object(
      'title', v_user_offer.title,
      'discount_percentage', v_user_offer.discount_percentage,
      'restaurant_name', v_user_offer.restaurant_name,
      'used_at', NOW()
    );
END;
$$;


ALTER FUNCTION "public"."use_user_offer"("p_redemption_code" "text", "p_user_id" "uuid", "p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_acceptance"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_booking record;
  v_conflicts jsonb;
  v_table_capacity integer;
  v_available_tables uuid[];
BEGIN
  -- Get booking details
  SELECT * INTO v_booking 
  FROM bookings 
  WHERE id = p_booking_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Booking not found or already processed'
    );
  END IF;
  
  -- Check if booking time has passed (using our logic)
  IF v_booking.booking_time < now() THEN
    -- Mark as auto-declined if not already
    UPDATE bookings 
    SET 
      status = 'auto_declined',
      auto_declined = true,
      acceptance_failed_reason = 'Booking time passed during acceptance attempt',
      acceptance_attempted_at = now()
    WHERE id = p_booking_id;
    
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Booking time has passed'
    );
  END IF;
  
  -- Rest of your existing validation logic...
  SELECT COALESCE(SUM(capacity), 0) INTO v_table_capacity
  FROM restaurant_tables
  WHERE id = ANY(p_table_ids) AND is_active = true;
  
  IF v_table_capacity < v_booking.party_size THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Insufficient table capacity',
      'required_capacity', v_booking.party_size,
      'selected_capacity', v_table_capacity
    );
  END IF;
  
  -- Check for time conflicts with other bookings
  WITH conflicts AS (
    SELECT 
      b.id,
      b.confirmation_code,
      b.booking_time,
      b.party_size,
      array_agg(t.table_number) as table_numbers
    FROM bookings b
    JOIN booking_tables bt ON bt.booking_id = b.id
    JOIN restaurant_tables t ON t.id = bt.table_id
    WHERE b.restaurant_id = v_booking.restaurant_id
      AND b.id != p_booking_id
      AND bt.table_id = ANY(p_table_ids)
      AND b.status IN ('confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
      AND (
        (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval) 
        OVERLAPS 
        (v_booking.booking_time, v_booking.booking_time + (v_booking.turn_time_minutes || ' minutes')::interval)
      )
    GROUP BY b.id, b.confirmation_code, b.booking_time, b.party_size
  )
  SELECT jsonb_agg(row_to_json(conflicts.*)) INTO v_conflicts FROM conflicts;
  
  IF v_conflicts IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'Table conflicts detected',
      'conflicts', v_conflicts
    );
  END IF;
  
  -- Find alternative tables
  WITH available_tables AS (
    SELECT t.id
    FROM restaurant_tables t
    WHERE t.restaurant_id = v_booking.restaurant_id
      AND t.is_active = true
      AND t.capacity >= v_booking.party_size
      AND NOT EXISTS (
        SELECT 1 
        FROM booking_tables bt
        JOIN bookings b ON b.id = bt.booking_id
        WHERE bt.table_id = t.id
          AND b.status IN ('confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert', 'payment')
          AND (
            (b.booking_time, b.booking_time + (b.turn_time_minutes || ' minutes')::interval) 
            OVERLAPS 
            (v_booking.booking_time, v_booking.booking_time + (v_booking.turn_time_minutes || ' minutes')::interval)
          )
      )
  )
  SELECT array_agg(id) INTO v_available_tables FROM available_tables;
  
  RETURN jsonb_build_object(
    'valid', true,
    'available_alternatives', v_available_tables
  );
END;
$$;


ALTER FUNCTION "public"."validate_booking_acceptance"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_restaurant_loyalty_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_balance integer;
  v_rule record;
BEGIN
  -- Only check for new bookings with loyalty rules
  IF NEW.applied_loyalty_rule_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get the rule details
  SELECT * INTO v_rule
  FROM restaurant_loyalty_rules
  WHERE id = NEW.applied_loyalty_rule_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid loyalty rule ID';
  END IF;
  
  -- Get restaurant balance
  SELECT current_balance INTO v_balance
  FROM restaurant_loyalty_balance
  WHERE restaurant_id = NEW.restaurant_id;
  
  -- If no balance record or insufficient balance, remove the loyalty rule
  IF v_balance IS NULL OR v_balance < v_rule.points_to_award THEN
    NEW.applied_loyalty_rule_id := NULL;
    NEW.expected_loyalty_points := 0;
  ELSE
    NEW.expected_loyalty_points := v_rule.points_to_award;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_restaurant_loyalty_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_table_combination"("p_table_ids" "uuid"[]) RETURNS TABLE("is_valid" boolean, "total_capacity" integer, "message" "text")
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_table_count INTEGER;
  v_combinable_count INTEGER;
  v_total_capacity INTEGER;
BEGIN
  -- Count tables
  SELECT COUNT(*), SUM(capacity)
  INTO v_table_count, v_total_capacity
  FROM restaurant_tables
  WHERE id = ANY(p_table_ids) AND is_active = true;

  -- Count combinable tables
  SELECT COUNT(*)
  INTO v_combinable_count
  FROM restaurant_tables
  WHERE id = ANY(p_table_ids) 
    AND is_active = true 
    AND is_combinable = true;

  -- Validation logic
  IF v_table_count != array_length(p_table_ids, 1) THEN
    RETURN QUERY SELECT false, 0, 'One or more tables not found or inactive';
  ELSIF v_table_count > 1 AND v_combinable_count != v_table_count THEN
    RETURN QUERY SELECT false, v_total_capacity, 'Not all selected tables can be combined';
  ELSE
    -- Check specific combination rules if any
    -- This can be expanded based on combinable_with field
    RETURN QUERY SELECT true, v_total_capacity, 'Valid combination';
  END IF;
END;
$$;


ALTER FUNCTION "public"."validate_table_combination"("p_table_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_customer_statistics"("p_restaurant_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("customer_id" "uuid", "customer_name" "text", "stored_total_bookings" integer, "actual_total_bookings" bigint, "stored_no_shows" integer, "actual_no_shows" bigint, "stored_cancelled" integer, "actual_cancelled" bigint, "needs_update" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rc.id as customer_id,
    rc.guest_name as customer_name,
    rc.total_bookings as stored_total_bookings,
    COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END) as actual_total_bookings,
    rc.no_show_count as stored_no_shows,
    COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as actual_no_shows,
    rc.cancelled_count as stored_cancelled,
    COUNT(CASE WHEN b.status LIKE 'cancelled%' THEN 1 END) as actual_cancelled,
    (
      rc.total_bookings != COUNT(CASE WHEN b.status IN ('confirmed', 'completed') THEN 1 END) OR
      rc.no_show_count != COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) OR
      rc.cancelled_count != COUNT(CASE WHEN b.status LIKE 'cancelled%' THEN 1 END)
    ) as needs_update
  FROM restaurant_customers rc
  LEFT JOIN bookings b ON (
    rc.restaurant_id = b.restaurant_id AND
    (
      (rc.user_id IS NOT NULL AND b.user_id = rc.user_id) OR
      (rc.user_id IS NULL AND b.guest_email = rc.guest_email)
    )
  )
  WHERE (p_restaurant_id IS NULL OR rc.restaurant_id = p_restaurant_id)
  GROUP BY rc.id, rc.guest_name, rc.total_bookings, rc.no_show_count, rc.cancelled_count
  ORDER BY needs_update DESC, rc.total_bookings DESC;
END;
$$;


ALTER FUNCTION "public"."verify_customer_statistics"("p_restaurant_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "archive"."booking_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "archived_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "archive"."booking_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "archive"."booking_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "archived_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "archive"."booking_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "archive"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_time" timestamp with time zone NOT NULL,
    "party_size" integer NOT NULL,
    "status" "text" NOT NULL,
    "special_requests" "text",
    "occasion" "text",
    "dietary_notes" "text"[],
    "confirmation_code" "text",
    "table_preferences" "text"[],
    "reminder_sent" boolean DEFAULT false,
    "checked_in_at" timestamp with time zone,
    "loyalty_points_earned" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "applied_offer_id" "uuid",
    "expected_loyalty_points" integer DEFAULT 0,
    "guest_name" "text",
    "guest_email" "text",
    "guest_phone" "text",
    "is_group_booking" boolean DEFAULT false,
    "organizer_id" "uuid",
    "attendees" integer DEFAULT 1,
    "turn_time_minutes" integer DEFAULT 120 NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "now"(),
    "archived_by" "uuid",
    "archive_reason" "text",
    CONSTRAINT "bookings_party_size_check" CHECK (("party_size" > 0)),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled_by_user'::"text", 'declined_by_restaurant'::"text", 'completed'::"text", 'no_show'::"text"])))
);


ALTER TABLE "archive"."bookings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_dining_bookings" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "user_id",
    NULL::"uuid" AS "restaurant_id",
    NULL::timestamp with time zone AS "booking_time",
    NULL::integer AS "party_size",
    NULL::"text" AS "status",
    NULL::"text" AS "special_requests",
    NULL::"text" AS "occasion",
    NULL::"text"[] AS "dietary_notes",
    NULL::"text" AS "confirmation_code",
    NULL::"text"[] AS "table_preferences",
    NULL::boolean AS "reminder_sent",
    NULL::timestamp with time zone AS "checked_in_at",
    NULL::integer AS "loyalty_points_earned",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::"uuid" AS "applied_offer_id",
    NULL::integer AS "expected_loyalty_points",
    NULL::"text" AS "guest_name",
    NULL::"text" AS "guest_email",
    NULL::"text" AS "guest_phone",
    NULL::boolean AS "is_group_booking",
    NULL::"uuid" AS "organizer_id",
    NULL::integer AS "attendees",
    NULL::integer AS "turn_time_minutes",
    NULL::"uuid" AS "applied_loyalty_rule_id",
    NULL::timestamp with time zone AS "actual_end_time",
    NULL::timestamp with time zone AS "seated_at",
    NULL::"jsonb" AS "meal_progress",
    NULL::"text" AS "guest_full_name",
    NULL::"text" AS "guest_phone_number",
    NULL::"text"[] AS "table_numbers",
    NULL::bigint AS "table_count";


ALTER VIEW "public"."active_dining_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_archive" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_time" timestamp with time zone NOT NULL,
    "party_size" integer NOT NULL,
    "status" "text" NOT NULL,
    "special_requests" "text",
    "occasion" "text",
    "dietary_notes" "text"[],
    "confirmation_code" "text",
    "table_preferences" "text"[],
    "reminder_sent" boolean DEFAULT false,
    "checked_in_at" timestamp with time zone,
    "loyalty_points_earned" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "applied_offer_id" "uuid",
    "expected_loyalty_points" integer DEFAULT 0,
    "guest_name" "text",
    "guest_email" "text",
    "guest_phone" "text",
    "is_group_booking" boolean DEFAULT false,
    "organizer_id" "uuid",
    "attendees" integer DEFAULT 1,
    "turn_time_minutes" integer DEFAULT 120 NOT NULL,
    "archived_at" timestamp with time zone DEFAULT "now"(),
    "archived_by" "uuid",
    CONSTRAINT "bookings_party_size_check" CHECK (("party_size" > 0)),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled_by_user'::"text", 'declined_by_restaurant'::"text", 'completed'::"text", 'no_show'::"text"])))
);


ALTER TABLE "public"."booking_archive" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_attendees" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "is_organizer" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "booking_attendees_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'declined'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."booking_attendees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_invites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    CONSTRAINT "booking_invites_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."booking_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."booking_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "table_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."booking_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "booking_time" timestamp with time zone NOT NULL,
    "party_size" integer NOT NULL,
    "status" "text" NOT NULL,
    "special_requests" "text",
    "occasion" "text",
    "dietary_notes" "text"[],
    "confirmation_code" "text",
    "table_preferences" "text"[],
    "reminder_sent" boolean DEFAULT false,
    "checked_in_at" timestamp with time zone,
    "loyalty_points_earned" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "applied_offer_id" "uuid",
    "expected_loyalty_points" integer DEFAULT 0,
    "guest_name" "text",
    "guest_email" "text",
    "guest_phone" "text",
    "is_group_booking" boolean DEFAULT false,
    "organizer_id" "uuid",
    "attendees" integer DEFAULT 1,
    "turn_time_minutes" integer DEFAULT 120 NOT NULL,
    "applied_loyalty_rule_id" "uuid",
    "actual_end_time" timestamp with time zone,
    "seated_at" timestamp with time zone,
    "meal_progress" "jsonb" DEFAULT '{}'::"jsonb",
    "request_expires_at" timestamp with time zone,
    "auto_declined" boolean DEFAULT false,
    "acceptance_attempted_at" timestamp with time zone,
    "acceptance_failed_reason" "text",
    "suggested_alternative_time" timestamp with time zone,
    "suggested_alternative_tables" "uuid"[],
    CONSTRAINT "bookings_party_size_check" CHECK (("party_size" > 0)),
    CONSTRAINT "bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'cancelled_by_user'::"text", 'declined_by_restaurant'::"text", 'auto_declined'::"text", 'completed'::"text", 'no_show'::"text", 'arrived'::"text", 'seated'::"text", 'ordered'::"text", 'appetizers'::"text", 'main_course'::"text", 'dessert'::"text", 'payment'::"text", 'cancelled_by_restaurant'::"text"])))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "category" "text",
    "is_important" boolean DEFAULT false,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_notes_category_check" CHECK (("category" = ANY (ARRAY['dietary'::"text", 'preference'::"text", 'behavior'::"text", 'special_occasion'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."customer_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "preference_type" "text" NOT NULL,
    "preference_value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_preferences_preference_type_check" CHECK (("preference_type" = ANY (ARRAY['seating'::"text", 'ambiance'::"text", 'service'::"text", 'menu'::"text", 'timing'::"text"])))
);


ALTER TABLE "public"."customer_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "related_customer_id" "uuid" NOT NULL,
    "relationship_type" "text" NOT NULL,
    "relationship_details" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customer_relationships_no_self_relation" CHECK (("customer_id" <> "related_customer_id")),
    CONSTRAINT "customer_relationships_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['spouse'::"text", 'parent'::"text", 'child'::"text", 'sibling'::"text", 'friend'::"text", 'colleague'::"text", 'partner'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."customer_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_tag_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "assigned_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_tag_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#gray'::"text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."customer_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_export_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "requested_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "download_url" "text",
    CONSTRAINT "data_export_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."data_export_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."floor_plans" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "svg_layout" "text",
    "width" integer DEFAULT 100,
    "height" integer DEFAULT 100,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."floor_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "friend_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."friend_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friends" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friend_id" "uuid" NOT NULL,
    "friendship_date" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "no_self_friendship" CHECK (("user_id" <> "friend_id"))
);


ALTER TABLE "public"."friends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kitchen_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "station_id" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text"
);


ALTER TABLE "public"."kitchen_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kitchen_display_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "station_id" "uuid",
    "display_name" "text" NOT NULL,
    "show_prep_times" boolean DEFAULT true,
    "show_dietary_info" boolean DEFAULT true,
    "show_special_instructions" boolean DEFAULT true,
    "auto_advance_orders" boolean DEFAULT false,
    "sound_notifications" boolean DEFAULT true,
    "color_scheme" "text" DEFAULT 'default'::"text",
    "font_size" "text" DEFAULT 'medium'::"text",
    "orders_per_page" integer DEFAULT 10,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "kitchen_display_settings_font_size_check" CHECK (("font_size" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text"])))
);


ALTER TABLE "public"."kitchen_display_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kitchen_stations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "station_type" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "kitchen_stations_station_type_check" CHECK (("station_type" = ANY (ARRAY['cold'::"text", 'hot'::"text", 'grill'::"text", 'fryer'::"text", 'pastry'::"text", 'beverage'::"text", 'expo'::"text"])))
);


ALTER TABLE "public"."kitchen_stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_activities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "activity_type" "text" NOT NULL,
    "points_earned" integer NOT NULL,
    "points_multiplier" numeric(3,2) DEFAULT 1.0,
    "description" "text",
    "related_booking_id" "uuid",
    "related_review_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "loyalty_activities_activity_type_check" CHECK (("activity_type" = ANY (ARRAY['booking_completed'::"text", 'review_written'::"text", 'photo_uploaded'::"text", 'referral_success'::"text", 'birthday_bonus'::"text", 'streak_bonus'::"text", 'manual_adjustment'::"text"])))
);


ALTER TABLE "public"."loyalty_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action" "text" NOT NULL,
    "restaurant_id" "uuid",
    "user_id" "uuid",
    "booking_id" "uuid",
    "points_amount" integer,
    "balance_before" integer,
    "balance_after" integer,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_redemptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reward_id" "uuid",
    "offer_id" "uuid",
    "points_cost" integer NOT NULL,
    "redemption_code" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(8), 'hex'::"text"),
    "status" "text" DEFAULT 'active'::"text",
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "booking_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_reward_or_offer" CHECK (((("reward_id" IS NOT NULL) AND ("offer_id" IS NULL)) OR (("reward_id" IS NULL) AND ("offer_id" IS NOT NULL)))),
    CONSTRAINT "loyalty_redemptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'used'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."loyalty_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_rewards" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "points_cost" integer NOT NULL,
    "tier_required" "text" NOT NULL,
    "value_description" "text",
    "terms_conditions" "text"[],
    "max_redemptions_per_user" integer,
    "total_available" integer,
    "restaurant_id" "uuid",
    "is_active" boolean DEFAULT true,
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "loyalty_rewards_category_check" CHECK (("category" = ANY (ARRAY['food'::"text", 'discount'::"text", 'experience'::"text", 'tier_exclusive'::"text"]))),
    CONSTRAINT "loyalty_rewards_points_cost_check" CHECK (("points_cost" > 0)),
    CONSTRAINT "loyalty_rewards_tier_required_check" CHECK (("tier_required" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'platinum'::"text"])))
);


ALTER TABLE "public"."loyalty_rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."menu_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_item_stations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "station_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "preparation_order" integer DEFAULT 1,
    "estimated_time" integer
);


ALTER TABLE "public"."menu_item_stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "image_url" "text",
    "dietary_tags" "text"[] DEFAULT '{}'::"text"[],
    "allergens" "text"[] DEFAULT '{}'::"text"[],
    "calories" integer,
    "preparation_time" integer,
    "is_available" boolean DEFAULT true,
    "is_featured" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_delivery_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "outbox_id" "uuid" NOT NULL,
    "provider" "text",
    "status" "text",
    "error" "text",
    "provider_message_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_delivery_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "sent_at" timestamp with time zone,
    CONSTRAINT "notification_outbox_channel_check" CHECK (("channel" = ANY (ARRAY['push'::"text", 'email'::"text", 'sms'::"text", 'inapp'::"text"]))),
    CONSTRAINT "notification_outbox_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."notification_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "booking" boolean DEFAULT true,
    "booking_reminders" boolean DEFAULT true,
    "waitlist" boolean DEFAULT true,
    "offers" boolean DEFAULT true,
    "reviews" boolean DEFAULT true,
    "loyalty" boolean DEFAULT true,
    "marketing" boolean DEFAULT false,
    "system" boolean DEFAULT true,
    "security" boolean DEFAULT true,
    "quiet_hours" "jsonb" DEFAULT '{"end": "08:00", "start": "22:00", "enabled": false}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "data" "jsonb",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "read_at" timestamp with time zone,
    "deeplink" "text",
    CONSTRAINT "notifications_type_nonempty" CHECK (("length"("type") > 0))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price" numeric NOT NULL,
    "total_price" numeric NOT NULL,
    "special_instructions" "text",
    "dietary_modifications" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "estimated_prep_time" integer,
    "actual_prep_time" integer,
    "started_preparing_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "served_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'preparing'::"text", 'ready'::"text", 'served'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_modifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "modification_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "price_adjustment" numeric DEFAULT 0,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_modifications_modification_type_check" CHECK (("modification_type" = ANY (ARRAY['add'::"text", 'remove'::"text", 'substitute'::"text", 'extra'::"text", 'less'::"text", 'on_side'::"text"])))
);


ALTER TABLE "public"."order_modifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "order_item_id" "uuid",
    "old_status" "text",
    "new_status" "text" NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "changed_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text",
    "station_id" "uuid",
    "estimated_completion" timestamp with time zone
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_id" "uuid",
    "order_number" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "order_type" "text" DEFAULT 'dine_in'::"text" NOT NULL,
    "course_type" "text",
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "tax_amount" numeric DEFAULT 0 NOT NULL,
    "total_amount" numeric DEFAULT 0 NOT NULL,
    "special_instructions" "text",
    "dietary_requirements" "text"[] DEFAULT '{}'::"text"[],
    "estimated_prep_time" integer,
    "actual_prep_time" integer,
    "priority_level" integer DEFAULT 1,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "confirmed_at" timestamp with time zone,
    "started_preparing_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "served_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    CONSTRAINT "orders_course_type_check" CHECK (("course_type" = ANY (ARRAY['appetizer'::"text", 'main_course'::"text", 'dessert'::"text", 'beverage'::"text", 'all_courses'::"text"]))),
    CONSTRAINT "orders_order_type_check" CHECK (("order_type" = ANY (ARRAY['dine_in'::"text", 'takeaway'::"text", 'delivery'::"text"]))),
    CONSTRAINT "orders_priority_level_check" CHECK ((("priority_level" >= 1) AND ("priority_level" <= 5))),
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'preparing'::"text", 'ready'::"text", 'served'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "playlist_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission" "text" DEFAULT 'view'::"text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "accepted_at" timestamp with time zone,
    CONSTRAINT "playlist_collaborators_permission_check" CHECK (("permission" = ANY (ARRAY['view'::"text", 'edit'::"text"])))
);


ALTER TABLE "public"."playlist_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."playlist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "playlist_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "added_by" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."playlist_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."playlist_stats" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "user_id",
    NULL::"text" AS "name",
    NULL::"text" AS "description",
    NULL::"text" AS "emoji",
    NULL::boolean AS "is_public",
    NULL::"text" AS "share_code",
    NULL::integer AS "view_count",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::bigint AS "item_count",
    NULL::bigint AS "collaborator_count",
    NULL::timestamp with time zone AS "last_updated";


ALTER VIEW "public"."playlist_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "image_url" "text" NOT NULL,
    "image_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid",
    "tagged_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "booking_id" "uuid",
    "restaurant_id" "uuid",
    "content" "text",
    "visibility" "text" DEFAULT 'friends'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "posts_visibility_check" CHECK (("visibility" = ANY (ARRAY['friends'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."posts_with_details" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "user_id",
    NULL::"uuid" AS "booking_id",
    NULL::"uuid" AS "restaurant_id",
    NULL::"text" AS "content",
    NULL::"text" AS "visibility",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::"text" AS "user_name",
    NULL::"text" AS "user_avatar",
    NULL::"text" AS "restaurant_name",
    NULL::"text" AS "restaurant_image",
    NULL::bigint AS "likes_count",
    NULL::bigint AS "comments_count",
    NULL::bigint AS "images_count",
    NULL::json AS "images",
    NULL::json AS "tagged_friends";


ALTER VIEW "public"."posts_with_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone_number" "text",
    "avatar_url" "text",
    "allergies" "text"[],
    "favorite_cuisines" "text"[],
    "dietary_restrictions" "text"[],
    "preferred_party_size" integer DEFAULT 2,
    "notification_preferences" "jsonb" DEFAULT '{"sms": false, "push": true, "email": true}'::"jsonb",
    "loyalty_points" integer DEFAULT 0,
    "membership_tier" "text" DEFAULT 'bronze'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "privacy_settings" "jsonb" DEFAULT "jsonb_build_object"('profile_visibility', 'public', 'activity_sharing', true, 'location_sharing', false, 'friend_requests_allowed', true),
    "user_rating" numeric(2,1) DEFAULT 5.0,
    "total_bookings" integer DEFAULT 0,
    "completed_bookings" integer DEFAULT 0,
    "cancelled_bookings" integer DEFAULT 0,
    "no_show_bookings" integer DEFAULT 0,
    "rating_last_updated" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    CONSTRAINT "profiles_user_rating_check" CHECK ((("user_rating" >= 1.0) AND ("user_rating" <= 5.0))),
    CONSTRAINT "valid_email_format" CHECK ((("email" IS NULL) OR ("email" ~ '.+@.+'::"text")))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "time_slot" time without time zone NOT NULL,
    "total_capacity" integer NOT NULL,
    "available_capacity" integer NOT NULL
);


ALTER TABLE "public"."restaurant_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_closures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    CONSTRAINT "restaurant_closures_date_check" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."restaurant_closures" OWNER TO "postgres";


COMMENT ON TABLE "public"."restaurant_closures" IS 'Temporary closures for renovations, vacations, etc';



CREATE TABLE IF NOT EXISTS "public"."restaurant_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "guest_email" "text",
    "guest_phone" "text",
    "guest_name" "text",
    "total_bookings" integer DEFAULT 0,
    "total_spent" numeric DEFAULT 0,
    "average_party_size" numeric DEFAULT 0,
    "last_visit" timestamp with time zone,
    "first_visit" timestamp with time zone,
    "no_show_count" integer DEFAULT 0,
    "cancelled_count" integer DEFAULT 0,
    "vip_status" boolean DEFAULT false,
    "blacklisted" boolean DEFAULT false,
    "blacklist_reason" "text",
    "preferred_table_types" "text"[],
    "preferred_time_slots" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."restaurant_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "day_of_week" "text" NOT NULL,
    "is_open" boolean DEFAULT true,
    "open_time" time without time zone,
    "close_time" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "restaurant_hours_day_of_week_check" CHECK (("day_of_week" = ANY (ARRAY['monday'::"text", 'tuesday'::"text", 'wednesday'::"text", 'thursday'::"text", 'friday'::"text", 'saturday'::"text", 'sunday'::"text"])))
);


ALTER TABLE "public"."restaurant_hours" OWNER TO "postgres";


COMMENT ON TABLE "public"."restaurant_hours" IS 'Regular weekly operating hours for each restaurant';



CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "address" "text" NOT NULL,
    "location" "public"."geography"(Point,4326) NOT NULL,
    "main_image_url" "text",
    "image_urls" "text"[],
    "cuisine_type" "text" NOT NULL,
    "tags" "text"[],
    "opening_time" time without time zone NOT NULL,
    "closing_time" time without time zone NOT NULL,
    "booking_policy" "text",
    "price_range" integer,
    "average_rating" numeric(2,1) DEFAULT 0,
    "total_reviews" integer DEFAULT 0,
    "phone_number" "text",
    "whatsapp_number" "text",
    "instagram_handle" "text",
    "menu_url" "text",
    "dietary_options" "text"[],
    "ambiance_tags" "text"[],
    "parking_available" boolean DEFAULT false,
    "valet_parking" boolean DEFAULT false,
    "outdoor_seating" boolean DEFAULT false,
    "shisha_available" boolean DEFAULT false,
    "live_music_schedule" "jsonb",
    "happy_hour_times" "jsonb",
    "booking_window_days" integer DEFAULT 30,
    "cancellation_window_hours" integer DEFAULT 24,
    "table_turnover_minutes" integer DEFAULT 120,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "featured" boolean DEFAULT false,
    "website_url" "text",
    "review_summary" "jsonb" DEFAULT '{"total_reviews": 0, "average_rating": 0, "detailed_ratings": {"food_avg": 0, "value_avg": 0, "service_avg": 0, "ambiance_avg": 0}, "rating_distribution": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}, "recommendation_percentage": 0}'::"jsonb",
    "ai_featured" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "request_expiry_hours" integer DEFAULT 24,
    "auto_decline_enabled" boolean DEFAULT true,
    "max_party_size" integer DEFAULT 10,
    "min_party_size" integer DEFAULT 1,
    CONSTRAINT "restaurants_booking_policy_check" CHECK (("booking_policy" = ANY (ARRAY['instant'::"text", 'request'::"text"]))),
    CONSTRAINT "restaurants_check" CHECK ((("min_party_size" > 0) AND ("min_party_size" <= "max_party_size"))),
    CONSTRAINT "restaurants_max_party_size_check" CHECK (("max_party_size" > 0)),
    CONSTRAINT "restaurants_price_range_check" CHECK ((("price_range" >= 1) AND ("price_range" <= 4))),
    CONSTRAINT "restaurants_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."restaurants"."ai_featured" IS 'Boolean to know if the aimust be biased toward the restaurant or no';



CREATE OR REPLACE VIEW "public"."restaurant_hours_summary" AS
 SELECT "r"."id" AS "restaurant_id",
    "r"."name" AS "restaurant_name",
    "json_object_agg"("rh"."day_of_week", "json_build_object"('is_open', "rh"."is_open", 'open_time', ("rh"."open_time")::"text", 'close_time', ("rh"."close_time")::"text")) AS "weekly_hours"
   FROM ("public"."restaurants" "r"
     LEFT JOIN "public"."restaurant_hours" "rh" ON (("r"."id" = "rh"."restaurant_id")))
  GROUP BY "r"."id", "r"."name";


ALTER VIEW "public"."restaurant_hours_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_loyalty_balance" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "total_purchased" integer DEFAULT 0 NOT NULL,
    "current_balance" integer DEFAULT 0 NOT NULL,
    "last_purchase_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "positive_balance" CHECK (("current_balance" >= 0)),
    CONSTRAINT "restaurant_loyalty_balance_current_balance_check" CHECK (("current_balance" >= 0)),
    CONSTRAINT "restaurant_loyalty_balance_total_purchased_check" CHECK (("total_purchased" >= 0))
);


ALTER TABLE "public"."restaurant_loyalty_balance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_loyalty_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "rule_name" "text" NOT NULL,
    "points_to_award" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "valid_from" timestamp with time zone DEFAULT "now"(),
    "valid_until" timestamp with time zone,
    "applicable_days" integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],
    "start_time_minutes" integer,
    "end_time_minutes" integer,
    "minimum_party_size" integer DEFAULT 1,
    "maximum_party_size" integer,
    "max_uses_total" integer,
    "current_uses" integer DEFAULT 0,
    "max_uses_per_user" integer,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "restaurant_loyalty_rules_end_time_minutes_check" CHECK ((("end_time_minutes" >= 0) AND ("end_time_minutes" <= 1440))),
    CONSTRAINT "restaurant_loyalty_rules_points_to_award_check" CHECK (("points_to_award" > 0)),
    CONSTRAINT "restaurant_loyalty_rules_start_time_minutes_check" CHECK ((("start_time_minutes" >= 0) AND ("start_time_minutes" < 1440))),
    CONSTRAINT "restaurant_loyalty_rules_time_check" CHECK (((("start_time_minutes" IS NULL) AND ("end_time_minutes" IS NULL)) OR (("start_time_minutes" IS NOT NULL) AND ("end_time_minutes" IS NOT NULL) AND ("end_time_minutes" > "start_time_minutes"))))
);


ALTER TABLE "public"."restaurant_loyalty_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_loyalty_transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "points" integer NOT NULL,
    "balance_before" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "description" "text",
    "booking_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "restaurant_loyalty_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['purchase'::"text", 'deduction'::"text", 'refund'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."restaurant_loyalty_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."restaurant_loyalty_analytics" AS
 SELECT "r"."id" AS "restaurant_id",
    "r"."name" AS "restaurant_name",
    "rlb"."current_balance",
    "rlb"."total_purchased",
    "count"(DISTINCT "rlr"."id") AS "active_rules",
    "count"(DISTINCT "rlt"."id") FILTER (WHERE ("rlt"."transaction_type" = 'deduction'::"text")) AS "total_awards",
    COALESCE("sum"("abs"("rlt"."points")) FILTER (WHERE ("rlt"."transaction_type" = 'deduction'::"text")), (0)::bigint) AS "total_points_awarded",
    COALESCE("sum"("rlt"."points") FILTER (WHERE ("rlt"."transaction_type" = 'refund'::"text")), (0)::bigint) AS "total_points_refunded"
   FROM ((("public"."restaurants" "r"
     LEFT JOIN "public"."restaurant_loyalty_balance" "rlb" ON (("rlb"."restaurant_id" = "r"."id")))
     LEFT JOIN "public"."restaurant_loyalty_rules" "rlr" ON ((("rlr"."restaurant_id" = "r"."id") AND ("rlr"."is_active" = true))))
     LEFT JOIN "public"."restaurant_loyalty_transactions" "rlt" ON (("rlt"."restaurant_id" = "r"."id")))
  GROUP BY "r"."id", "r"."name", "rlb"."current_balance", "rlb"."total_purchased";


ALTER VIEW "public"."restaurant_loyalty_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_playlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "emoji" "text" DEFAULT '📍'::"text",
    "is_public" boolean DEFAULT false,
    "share_code" "text",
    "view_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."restaurant_playlists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_special_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "is_closed" boolean DEFAULT false,
    "open_time" time without time zone,
    "close_time" time without time zone,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL
);


ALTER TABLE "public"."restaurant_special_hours" OWNER TO "postgres";


COMMENT ON TABLE "public"."restaurant_special_hours" IS 'Override hours for specific dates (holidays, special events)';



CREATE TABLE IF NOT EXISTS "public"."restaurant_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "permissions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_active" boolean DEFAULT true,
    "hired_at" timestamp with time zone DEFAULT "now"(),
    "terminated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "last_login_at" timestamp with time zone,
    CONSTRAINT "restaurant_staff_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'staff'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."restaurant_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_tables" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "table_number" "text" NOT NULL,
    "table_type" "text" NOT NULL,
    "capacity" integer NOT NULL,
    "x_position" double precision NOT NULL,
    "y_position" double precision NOT NULL,
    "shape" "text" DEFAULT 'rectangle'::"text",
    "width" double precision DEFAULT 10,
    "height" double precision DEFAULT 10,
    "is_active" boolean DEFAULT true,
    "features" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "min_capacity" integer NOT NULL,
    "max_capacity" integer NOT NULL,
    "is_combinable" boolean DEFAULT true,
    "combinable_with" "uuid"[] DEFAULT '{}'::"uuid"[],
    "priority_score" integer DEFAULT 0,
    CONSTRAINT "restaurant_tables_capacity_check" CHECK (("capacity" > 0)),
    CONSTRAINT "restaurant_tables_shape_check" CHECK (("shape" = ANY (ARRAY['rectangle'::"text", 'circle'::"text", 'square'::"text"]))),
    CONSTRAINT "restaurant_tables_table_type_check" CHECK (("table_type" = ANY (ARRAY['booth'::"text", 'window'::"text", 'patio'::"text", 'standard'::"text", 'bar'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."restaurant_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_turn_times" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "party_size" integer NOT NULL,
    "turn_time_minutes" integer NOT NULL,
    "day_of_week" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."restaurant_turn_times" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurant_vip_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "extended_booking_days" integer DEFAULT 60,
    "priority_booking" boolean DEFAULT true,
    "valid_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."restaurant_vip_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_replies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "replied_by" "uuid" NOT NULL,
    "reply_message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "food_rating" integer,
    "service_rating" integer,
    "ambiance_rating" integer,
    "value_rating" integer,
    "recommend_to_friend" boolean DEFAULT false,
    "visit_again" boolean DEFAULT false,
    "tags" "text"[],
    "photos" "text"[],
    CONSTRAINT "reviews_ambiance_rating_check" CHECK ((("ambiance_rating" >= 1) AND ("ambiance_rating" <= 5))),
    CONSTRAINT "reviews_food_rating_check" CHECK ((("food_rating" >= 1) AND ("food_rating" <= 5))),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "reviews_service_rating_check" CHECK ((("service_rating" >= 1) AND ("service_rating" <= 5))),
    CONSTRAINT "reviews_value_rating_check" CHECK ((("value_rating" >= 1) AND ("value_rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."special_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "discount_percentage" integer,
    "valid_from" timestamp with time zone NOT NULL,
    "valid_until" timestamp with time zone NOT NULL,
    "terms_conditions" "text"[],
    "minimum_party_size" integer DEFAULT 1,
    "applicable_days" integer[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "img_url" "text"
);


ALTER TABLE "public"."special_offers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."special_offers"."img_url" IS 'for the special offer banner';



CREATE TABLE IF NOT EXISTS "public"."staff_permission_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "permissions" "text"[] NOT NULL,
    "is_system_template" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_permission_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_availability" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "table_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "time_slot" time without time zone NOT NULL,
    "is_available" boolean DEFAULT true,
    "booking_id" "uuid"
);


ALTER TABLE "public"."table_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."table_combinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "primary_table_id" "uuid" NOT NULL,
    "secondary_table_id" "uuid" NOT NULL,
    "combined_capacity" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."table_combinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tier_benefits" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tier" "text" NOT NULL,
    "benefit_type" "text" NOT NULL,
    "benefit_value" "text" NOT NULL,
    "description" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tier_benefits_tier_check" CHECK (("tier" = ANY (ARRAY['bronze'::"text", 'silver'::"text", 'gold'::"text", 'platinum'::"text"])))
);


ALTER TABLE "public"."tier_benefits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" "text" NOT NULL,
    "expo_push_token" "text",
    "platform" "text",
    "app_version" "text",
    "locale" "text",
    "timezone" "text",
    "enabled" boolean DEFAULT true,
    "last_seen" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_devices_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_loyalty_rule_usage" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rule_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_loyalty_rule_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "offer_id" "uuid" NOT NULL,
    "booking_id" "uuid",
    "claimed_at" timestamp with time zone DEFAULT "now"(),
    "used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "redemption_code" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(8), 'hex'::"text"),
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "user_offers_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'used'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."user_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_privacy_settings" (
    "user_id" "uuid" NOT NULL,
    "marketing_emails" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "location_sharing" boolean DEFAULT false,
    "activity_sharing" boolean DEFAULT true,
    "profile_visibility" "text" DEFAULT 'public'::"text",
    "data_analytics" boolean DEFAULT true,
    "third_party_sharing" boolean DEFAULT false,
    "review_visibility" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_privacy_settings_profile_visibility_check" CHECK (("profile_visibility" = ANY (ARRAY['public'::"text", 'friends'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."user_privacy_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "push_token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "device_id" "text",
    "device_name" "text",
    "app_version" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_push_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text", 'web'::"text"])))
);


ALTER TABLE "public"."user_push_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_push_tokens" IS 'Stores push notification tokens for users across different platforms';



COMMENT ON COLUMN "public"."user_push_tokens"."user_id" IS 'Reference to the user who owns this token';



COMMENT ON COLUMN "public"."user_push_tokens"."push_token" IS 'The actual push notification token from Expo/FCM/APNS';



COMMENT ON COLUMN "public"."user_push_tokens"."platform" IS 'Platform where the token was generated (ios, android, web)';



COMMENT ON COLUMN "public"."user_push_tokens"."device_id" IS 'Unique device identifier if available';



COMMENT ON COLUMN "public"."user_push_tokens"."device_name" IS 'Human-readable device name';



COMMENT ON COLUMN "public"."user_push_tokens"."app_version" IS 'App version when token was registered';



COMMENT ON COLUMN "public"."user_push_tokens"."is_active" IS 'Whether this token is currently active and should receive notifications';



CREATE TABLE IF NOT EXISTS "public"."user_rating_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "old_rating" numeric(2,1),
    "new_rating" numeric(2,1) NOT NULL,
    "booking_id" "uuid",
    "change_reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_rating_history" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_bookings_with_tables" AS
 SELECT "b"."id" AS "booking_id",
    "b"."confirmation_code",
    "b"."booking_time",
    "b"."party_size",
    "b"."status",
    "b"."created_at",
    "r"."name" AS "restaurant_name",
    "r"."id" AS "restaurant_id",
    COALESCE("json_agg"("json_build_object"('table_id', "rt"."id", 'table_number', "rt"."table_number", 'table_type', "rt"."table_type", 'capacity', "rt"."capacity") ORDER BY "rt"."table_number") FILTER (WHERE ("rt"."id" IS NOT NULL)), '[]'::json) AS "assigned_tables",
    "count"("rt"."id") AS "table_count"
   FROM ((("public"."bookings" "b"
     JOIN "public"."restaurants" "r" ON (("b"."restaurant_id" = "r"."id")))
     LEFT JOIN "public"."booking_tables" "bt" ON (("b"."id" = "bt"."booking_id")))
     LEFT JOIN "public"."restaurant_tables" "rt" ON (("bt"."table_id" = "rt"."id")))
  WHERE ("b"."created_at" > ("now"() - '7 days'::interval))
  GROUP BY "b"."id", "b"."confirmation_code", "b"."booking_time", "b"."party_size", "b"."status", "b"."created_at", "r"."name", "r"."id"
  ORDER BY "b"."created_at" DESC;


ALTER VIEW "public"."v_bookings_with_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "restaurant_id" "uuid" NOT NULL,
    "desired_date" "date" NOT NULL,
    "desired_time_range" "tstzrange" NOT NULL,
    "party_size" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "public"."waiting_status" DEFAULT 'active'::"public"."waiting_status" NOT NULL,
    "table_type" "public"."table_type" DEFAULT 'any'::"public"."table_type" NOT NULL
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


COMMENT ON COLUMN "public"."waitlist"."status" IS 'The status fo the user in the waiting_list';



COMMENT ON COLUMN "public"."waitlist"."table_type" IS 'The type of table the user is waiting for , can be any';



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id");



CREATE MATERIALIZED VIEW "public"."mv_table_availability" AS
 WITH "booking_windows" AS (
         SELECT "bt"."table_id",
            "b"."restaurant_id",
            "b"."booking_time" AS "start_time",
            ("b"."booking_time" + (("b"."turn_time_minutes" || ' minutes'::"text"))::interval) AS "end_time",
            "b"."party_size",
            "b"."status",
            "b"."id" AS "booking_id"
           FROM ("public"."bookings" "b"
             JOIN "public"."booking_tables" "bt" ON (("b"."id" = "bt"."booking_id")))
          WHERE (("b"."status" = ANY (ARRAY['confirmed'::"text", 'pending'::"text"])) AND ("b"."booking_time" >= (CURRENT_DATE - '1 day'::interval)) AND ("b"."booking_time" <= (CURRENT_DATE + '60 days'::interval)))
        )
 SELECT "rt"."id" AS "table_id",
    "rt"."restaurant_id",
    "rt"."table_number",
    "rt"."capacity",
    "rt"."min_capacity",
    "rt"."max_capacity",
    "rt"."table_type",
    "rt"."is_active",
    "rt"."is_combinable",
    "rt"."priority_score",
    COALESCE("json_agg"("json_build_object"('booking_id', "bw"."booking_id", 'start_time', "bw"."start_time", 'end_time', "bw"."end_time", 'party_size', "bw"."party_size", 'status', "bw"."status") ORDER BY "bw"."start_time") FILTER (WHERE ("bw"."table_id" IS NOT NULL)), '[]'::json) AS "bookings"
   FROM ("public"."restaurant_tables" "rt"
     LEFT JOIN "booking_windows" "bw" ON (("rt"."id" = "bw"."table_id")))
  WHERE ("rt"."is_active" = true)
  GROUP BY "rt"."id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_table_availability" OWNER TO "postgres";


ALTER TABLE ONLY "archive"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "archive"."booking_tables"
    ADD CONSTRAINT "booking_tables_booking_id_table_id_key" UNIQUE ("booking_id", "table_id");



ALTER TABLE ONLY "archive"."booking_tables"
    ADD CONSTRAINT "booking_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "archive"."bookings"
    ADD CONSTRAINT "bookings_confirmation_code_key" UNIQUE ("confirmation_code");



ALTER TABLE ONLY "archive"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_archive"
    ADD CONSTRAINT "booking_archive_confirmation_code_key" UNIQUE ("confirmation_code");



ALTER TABLE ONLY "public"."booking_archive"
    ADD CONSTRAINT "booking_archive_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_attendees"
    ADD CONSTRAINT "booking_attendees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_invites"
    ADD CONSTRAINT "booking_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_tables"
    ADD CONSTRAINT "booking_tables_booking_id_table_id_key" UNIQUE ("booking_id", "table_id");



ALTER TABLE ONLY "public"."booking_tables"
    ADD CONSTRAINT "booking_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_confirmation_code_key" UNIQUE ("confirmation_code");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_notes"
    ADD CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_preferences"
    ADD CONSTRAINT "customer_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_relationships"
    ADD CONSTRAINT "customer_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_relationships"
    ADD CONSTRAINT "customer_relationships_unique" UNIQUE ("customer_id", "related_customer_id");



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_unique" UNIQUE ("customer_id", "tag_id");



ALTER TABLE ONLY "public"."customer_tags"
    ADD CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_tags"
    ADD CONSTRAINT "customer_tags_unique_name_restaurant" UNIQUE ("restaurant_id", "name");



ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_restaurant_id_key" UNIQUE ("user_id", "restaurant_id");



ALTER TABLE ONLY "public"."floor_plans"
    ADD CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."floor_plans"
    ADD CONSTRAINT "floor_plans_restaurant_id_name_key" UNIQUE ("restaurant_id", "name");



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kitchen_assignments"
    ADD CONSTRAINT "kitchen_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kitchen_display_settings"
    ADD CONSTRAINT "kitchen_display_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kitchen_stations"
    ADD CONSTRAINT "kitchen_stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_activities"
    ADD CONSTRAINT "loyalty_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_audit_log"
    ADD CONSTRAINT "loyalty_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_redemption_code_key" UNIQUE ("redemption_code");



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_item_stations"
    ADD CONSTRAINT "menu_item_stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_delivery_logs"
    ADD CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_unique_user_per_playlist" UNIQUE ("playlist_id", "user_id");



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_unique_restaurant_per_playlist" UNIQUE ("playlist_id", "restaurant_id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_images"
    ADD CONSTRAINT "post_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."post_tags"
    ADD CONSTRAINT "post_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_tags"
    ADD CONSTRAINT "post_tags_post_id_tagged_user_id_key" UNIQUE ("post_id", "tagged_user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_availability"
    ADD CONSTRAINT "restaurant_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_availability"
    ADD CONSTRAINT "restaurant_availability_restaurant_id_date_time_slot_key" UNIQUE ("restaurant_id", "date", "time_slot");



ALTER TABLE ONLY "public"."restaurant_closures"
    ADD CONSTRAINT "restaurant_closures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_customers"
    ADD CONSTRAINT "restaurant_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_customers"
    ADD CONSTRAINT "restaurant_customers_unique_user_restaurant" UNIQUE ("restaurant_id", "user_id");



ALTER TABLE ONLY "public"."restaurant_hours"
    ADD CONSTRAINT "restaurant_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_loyalty_balance"
    ADD CONSTRAINT "restaurant_loyalty_balance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_loyalty_balance"
    ADD CONSTRAINT "restaurant_loyalty_balance_restaurant_id_key" UNIQUE ("restaurant_id");



ALTER TABLE ONLY "public"."restaurant_loyalty_rules"
    ADD CONSTRAINT "restaurant_loyalty_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_loyalty_transactions"
    ADD CONSTRAINT "restaurant_loyalty_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_playlists"
    ADD CONSTRAINT "restaurant_playlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_playlists"
    ADD CONSTRAINT "restaurant_playlists_share_code_key" UNIQUE ("share_code");



ALTER TABLE ONLY "public"."restaurant_special_hours"
    ADD CONSTRAINT "restaurant_special_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_special_hours"
    ADD CONSTRAINT "restaurant_special_hours_unique" UNIQUE ("restaurant_id", "date");



ALTER TABLE ONLY "public"."restaurant_staff"
    ADD CONSTRAINT "restaurant_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_staff"
    ADD CONSTRAINT "restaurant_staff_unique_user_restaurant" UNIQUE ("restaurant_id", "user_id");



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_restaurant_id_table_number_key" UNIQUE ("restaurant_id", "table_number");



ALTER TABLE ONLY "public"."restaurant_turn_times"
    ADD CONSTRAINT "restaurant_turn_times_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_turn_times"
    ADD CONSTRAINT "restaurant_turn_times_restaurant_id_party_size_day_of_week_key" UNIQUE ("restaurant_id", "party_size", "day_of_week");



ALTER TABLE ONLY "public"."restaurant_vip_users"
    ADD CONSTRAINT "restaurant_vip_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurant_vip_users"
    ADD CONSTRAINT "restaurant_vip_users_restaurant_id_user_id_key" UNIQUE ("restaurant_id", "user_id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_review_id_unique" UNIQUE ("review_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."special_offers"
    ADD CONSTRAINT "special_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_permission_templates"
    ADD CONSTRAINT "staff_permission_templates_name_unique" UNIQUE ("name");



ALTER TABLE ONLY "public"."staff_permission_templates"
    ADD CONSTRAINT "staff_permission_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_availability"
    ADD CONSTRAINT "table_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_availability"
    ADD CONSTRAINT "table_availability_table_id_date_time_slot_key" UNIQUE ("table_id", "date", "time_slot");



ALTER TABLE ONLY "public"."table_combinations"
    ADD CONSTRAINT "table_combinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."table_combinations"
    ADD CONSTRAINT "table_combinations_primary_table_id_secondary_table_id_key" UNIQUE ("primary_table_id", "secondary_table_id");



ALTER TABLE ONLY "public"."tier_benefits"
    ADD CONSTRAINT "tier_benefits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_attendees"
    ADD CONSTRAINT "unique_booking_attendee" UNIQUE ("booking_id", "user_id");



ALTER TABLE ONLY "public"."booking_invites"
    ADD CONSTRAINT "unique_booking_invite" UNIQUE ("booking_id", "to_user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "unique_email" UNIQUE ("email");



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "unique_friend_request" UNIQUE ("from_user_id", "to_user_id");



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "unique_friendship" UNIQUE ("user_id", "friend_id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_device_id_key" UNIQUE ("user_id", "device_id");



ALTER TABLE ONLY "public"."user_loyalty_rule_usage"
    ADD CONSTRAINT "user_loyalty_rule_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_loyalty_rule_usage"
    ADD CONSTRAINT "user_loyalty_rule_usage_unique" UNIQUE ("user_id", "rule_id", "booking_id");



ALTER TABLE ONLY "public"."user_offers"
    ADD CONSTRAINT "user_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_offers"
    ADD CONSTRAINT "user_offers_user_id_offer_id_key" UNIQUE ("user_id", "offer_id");



ALTER TABLE ONLY "public"."user_privacy_settings"
    ADD CONSTRAINT "user_privacy_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_user_id_platform_key" UNIQUE ("user_id", "platform");



ALTER TABLE ONLY "public"."user_rating_history"
    ADD CONSTRAINT "user_rating_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "booking_status_history_booking_id_changed_at_idx" ON "archive"."booking_status_history" USING "btree" ("booking_id", "changed_at" DESC);



CREATE INDEX "booking_tables_booking_id_idx" ON "archive"."booking_tables" USING "btree" ("booking_id");



CREATE INDEX "booking_tables_booking_id_table_id_idx" ON "archive"."booking_tables" USING "btree" ("booking_id", "table_id");



CREATE INDEX "booking_tables_table_id_booking_id_idx" ON "archive"."booking_tables" USING "btree" ("table_id", "booking_id");



CREATE INDEX "booking_tables_table_id_idx" ON "archive"."booking_tables" USING "btree" ("table_id");



CREATE INDEX "bookings_booking_time_idx" ON "archive"."bookings" USING "btree" ("booking_time");



CREATE INDEX "bookings_confirmation_code_idx" ON "archive"."bookings" USING "btree" ("confirmation_code") WHERE ("confirmation_code" IS NOT NULL);



CREATE INDEX "bookings_restaurant_id_booking_time_idx" ON "archive"."bookings" USING "btree" ("restaurant_id", "booking_time");



CREATE INDEX "bookings_restaurant_id_idx" ON "archive"."bookings" USING "btree" ("restaurant_id");



CREATE INDEX "bookings_restaurant_id_status_booking_time_idx" ON "archive"."bookings" USING "btree" ("restaurant_id", "status", "booking_time");



CREATE INDEX "bookings_status_booking_time_idx" ON "archive"."bookings" USING "btree" ("status", "booking_time");



CREATE INDEX "bookings_status_idx" ON "archive"."bookings" USING "btree" ("status");



CREATE INDEX "bookings_status_user_id_idx" ON "archive"."bookings" USING "btree" ("status", "user_id");



CREATE INDEX "bookings_user_id_created_at_idx" ON "archive"."bookings" USING "btree" ("user_id", "created_at");



CREATE INDEX "bookings_user_id_idx" ON "archive"."bookings" USING "btree" ("user_id");



CREATE INDEX "bookings_user_id_status_idx" ON "archive"."bookings" USING "btree" ("user_id", "status");



CREATE INDEX "booking_archive_booking_time_idx" ON "public"."booking_archive" USING "btree" ("booking_time");



CREATE INDEX "booking_archive_restaurant_id_booking_time_idx" ON "public"."booking_archive" USING "btree" ("restaurant_id", "booking_time");



CREATE INDEX "booking_archive_restaurant_id_idx" ON "public"."booking_archive" USING "btree" ("restaurant_id");



CREATE INDEX "booking_archive_restaurant_id_status_booking_time_idx" ON "public"."booking_archive" USING "btree" ("restaurant_id", "status", "booking_time");



CREATE INDEX "booking_archive_status_booking_time_idx" ON "public"."booking_archive" USING "btree" ("status", "booking_time");



CREATE INDEX "booking_archive_status_idx" ON "public"."booking_archive" USING "btree" ("status");



CREATE INDEX "booking_archive_status_user_id_idx" ON "public"."booking_archive" USING "btree" ("status", "user_id");



CREATE INDEX "booking_archive_user_id_created_at_idx" ON "public"."booking_archive" USING "btree" ("user_id", "created_at");



CREATE INDEX "booking_archive_user_id_idx" ON "public"."booking_archive" USING "btree" ("user_id");



CREATE INDEX "booking_archive_user_id_status_idx" ON "public"."booking_archive" USING "btree" ("user_id", "status");



CREATE INDEX "idx_availability_restaurant_date" ON "public"."restaurant_availability" USING "btree" ("restaurant_id", "date");



CREATE INDEX "idx_booking_attendees_booking" ON "public"."booking_attendees" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_attendees_user" ON "public"."booking_attendees" USING "btree" ("user_id");



CREATE INDEX "idx_booking_invites_booking" ON "public"."booking_invites" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_invites_status" ON "public"."booking_invites" USING "btree" ("status");



CREATE INDEX "idx_booking_invites_to_user" ON "public"."booking_invites" USING "btree" ("to_user_id");



CREATE INDEX "idx_booking_status_history_booking" ON "public"."booking_status_history" USING "btree" ("booking_id", "changed_at" DESC);



CREATE INDEX "idx_booking_status_history_changed_at" ON "public"."booking_status_history" USING "btree" ("changed_at" DESC);



CREATE INDEX "idx_booking_tables_booking_id" ON "public"."booking_tables" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_tables_composite" ON "public"."booking_tables" USING "btree" ("booking_id", "table_id");



CREATE INDEX "idx_booking_tables_table_booking" ON "public"."booking_tables" USING "btree" ("table_id", "booking_id");



CREATE INDEX "idx_booking_tables_table_id" ON "public"."booking_tables" USING "btree" ("table_id");



CREATE INDEX "idx_bookings_active_dining" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_time") WHERE ("status" = ANY (ARRAY['arrived'::"text", 'seated'::"text", 'ordered'::"text", 'appetizers'::"text", 'main_course'::"text", 'dessert'::"text", 'payment'::"text"]));



CREATE INDEX "idx_bookings_analytics" ON "public"."bookings" USING "btree" ("restaurant_id", "status", "booking_time", "party_size");



CREATE INDEX "idx_bookings_confirmation_code" ON "public"."bookings" USING "btree" ("confirmation_code") WHERE ("confirmation_code" IS NOT NULL);



CREATE INDEX "idx_bookings_created_status" ON "public"."bookings" USING "btree" ("created_at", "status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_bookings_duplicate_check" ON "public"."bookings" USING "btree" ("user_id", "restaurant_id", "booking_time", "party_size", "status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text"]));



CREATE INDEX "idx_bookings_guest_info" ON "public"."bookings" USING "btree" ("restaurant_id", "guest_name", "guest_phone") WHERE ("guest_name" IS NOT NULL);



CREATE INDEX "idx_bookings_loyalty_rule" ON "public"."bookings" USING "btree" ("applied_loyalty_rule_id") WHERE ("applied_loyalty_rule_id" IS NOT NULL);



CREATE INDEX "idx_bookings_overlap_check" ON "public"."bookings" USING "btree" ("user_id", "restaurant_id", "booking_time", "status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text"]));



CREATE INDEX "idx_bookings_pending_requests" ON "public"."bookings" USING "btree" ("restaurant_id", "status", "request_expires_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_bookings_pending_status" ON "public"."bookings" USING "btree" ("restaurant_id", "status", "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_bookings_realtime_updates" ON "public"."bookings" USING "btree" ("restaurant_id", "updated_at" DESC) WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'arrived'::"text", 'seated'::"text"]));



CREATE INDEX "idx_bookings_restaurant" ON "public"."bookings" USING "btree" ("restaurant_id");



CREATE INDEX "idx_bookings_restaurant_booking_time_status" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_time", "status") WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'pending'::"text"]));



CREATE INDEX "idx_bookings_restaurant_status" ON "public"."bookings" USING "btree" ("restaurant_id", "status");



CREATE INDEX "idx_bookings_restaurant_status_time" ON "public"."bookings" USING "btree" ("restaurant_id", "status", "booking_time");



CREATE INDEX "idx_bookings_restaurant_time" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_time");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_bookings_status_restaurant" ON "public"."bookings" USING "btree" ("restaurant_id", "status") WHERE ("status" = ANY (ARRAY['arrived'::"text", 'seated'::"text", 'ordered'::"text", 'appetizers'::"text", 'main_course'::"text", 'dessert'::"text", 'payment'::"text"]));



CREATE INDEX "idx_bookings_status_time" ON "public"."bookings" USING "btree" ("status", "booking_time");



CREATE INDEX "idx_bookings_status_updated" ON "public"."bookings" USING "btree" ("status", "updated_at");



CREATE INDEX "idx_bookings_status_user" ON "public"."bookings" USING "btree" ("status", "user_id");



CREATE INDEX "idx_bookings_table_management" ON "public"."bookings" USING "btree" ("restaurant_id", "status", "booking_time", "party_size");



CREATE INDEX "idx_bookings_time" ON "public"."bookings" USING "btree" ("booking_time");



CREATE INDEX "idx_bookings_time_conflicts" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_time", "status") WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'arrived'::"text", 'seated'::"text", 'ordered'::"text", 'appetizers'::"text", 'main_course'::"text", 'dessert'::"text", 'payment'::"text"]));



CREATE INDEX "idx_bookings_time_restaurant" ON "public"."bookings" USING "btree" ("restaurant_id", "booking_time");



CREATE INDEX "idx_bookings_user" ON "public"."bookings" USING "btree" ("user_id");



CREATE INDEX "idx_bookings_user_created" ON "public"."bookings" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_bookings_user_id" ON "public"."bookings" USING "btree" ("user_id");



CREATE UNIQUE INDEX "idx_bookings_user_restaurant_time" ON "public"."bookings" USING "btree" ("user_id", "restaurant_id", "booking_time", "party_size") WHERE ("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text"]));



CREATE INDEX "idx_bookings_user_status" ON "public"."bookings" USING "btree" ("user_id", "status");



CREATE INDEX "idx_customer_notes_customer_id" ON "public"."customer_notes" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_relationships_customer_id" ON "public"."customer_relationships" USING "btree" ("customer_id");



CREATE INDEX "idx_customer_relationships_related_customer_id" ON "public"."customer_relationships" USING "btree" ("related_customer_id");



CREATE INDEX "idx_customer_tag_assignments_customer_id" ON "public"."customer_tag_assignments" USING "btree" ("customer_id");



CREATE INDEX "idx_favorites_user" ON "public"."favorites" USING "btree" ("user_id");



CREATE INDEX "idx_floor_plans_restaurant" ON "public"."floor_plans" USING "btree" ("restaurant_id");



CREATE INDEX "idx_friend_requests_from_user" ON "public"."friend_requests" USING "btree" ("from_user_id");



CREATE INDEX "idx_friend_requests_status" ON "public"."friend_requests" USING "btree" ("status");



CREATE INDEX "idx_friend_requests_to_user" ON "public"."friend_requests" USING "btree" ("to_user_id");



CREATE INDEX "idx_friends_friend_id" ON "public"."friends" USING "btree" ("friend_id");



CREATE INDEX "idx_friends_user_id" ON "public"."friends" USING "btree" ("user_id");



CREATE INDEX "idx_kitchen_assignments_assigned_to" ON "public"."kitchen_assignments" USING "btree" ("assigned_to");



CREATE INDEX "idx_kitchen_assignments_order_item" ON "public"."kitchen_assignments" USING "btree" ("order_item_id");



CREATE INDEX "idx_kitchen_assignments_staff" ON "public"."kitchen_assignments" USING "btree" ("assigned_to");



CREATE INDEX "idx_kitchen_assignments_station" ON "public"."kitchen_assignments" USING "btree" ("station_id");



CREATE INDEX "idx_kitchen_assignments_station_id" ON "public"."kitchen_assignments" USING "btree" ("station_id");



CREATE INDEX "idx_kitchen_stations_restaurant" ON "public"."kitchen_stations" USING "btree" ("restaurant_id", "is_active", "display_order") WHERE ("is_active" = true);



CREATE INDEX "idx_loyalty_activities_booking" ON "public"."loyalty_activities" USING "btree" ("related_booking_id") WHERE ("related_booking_id" IS NOT NULL);



CREATE INDEX "idx_loyalty_activities_created_at" ON "public"."loyalty_activities" USING "btree" ("created_at");



CREATE INDEX "idx_loyalty_activities_type" ON "public"."loyalty_activities" USING "btree" ("activity_type");



CREATE INDEX "idx_loyalty_activities_user_id" ON "public"."loyalty_activities" USING "btree" ("user_id");



CREATE INDEX "idx_loyalty_redemptions_code" ON "public"."loyalty_redemptions" USING "btree" ("redemption_code");



CREATE INDEX "idx_loyalty_redemptions_expires_at" ON "public"."loyalty_redemptions" USING "btree" ("expires_at");



CREATE INDEX "idx_loyalty_redemptions_status" ON "public"."loyalty_redemptions" USING "btree" ("status");



CREATE INDEX "idx_loyalty_redemptions_user_id" ON "public"."loyalty_redemptions" USING "btree" ("user_id");



CREATE INDEX "idx_loyalty_rewards_active" ON "public"."loyalty_rewards" USING "btree" ("is_active");



CREATE INDEX "idx_loyalty_rewards_category" ON "public"."loyalty_rewards" USING "btree" ("category");



CREATE INDEX "idx_loyalty_rewards_restaurant" ON "public"."loyalty_rewards" USING "btree" ("restaurant_id");



CREATE INDEX "idx_loyalty_rewards_tier" ON "public"."loyalty_rewards" USING "btree" ("tier_required");



CREATE INDEX "idx_menu_categories_order" ON "public"."menu_categories" USING "btree" ("display_order");



CREATE INDEX "idx_menu_categories_restaurant" ON "public"."menu_categories" USING "btree" ("restaurant_id");



CREATE INDEX "idx_menu_items_category" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "idx_menu_items_dietary" ON "public"."menu_items" USING "gin" ("dietary_tags");



CREATE INDEX "idx_menu_items_featured" ON "public"."menu_items" USING "btree" ("is_featured") WHERE ("is_featured" = true);



CREATE INDEX "idx_menu_items_restaurant" ON "public"."menu_items" USING "btree" ("restaurant_id");



CREATE INDEX "idx_mv_table_availability_capacity" ON "public"."mv_table_availability" USING "btree" ("restaurant_id", "capacity");



CREATE INDEX "idx_mv_table_availability_restaurant" ON "public"."mv_table_availability" USING "btree" ("restaurant_id");



CREATE UNIQUE INDEX "idx_mv_table_availability_table_id" ON "public"."mv_table_availability" USING "btree" ("table_id");



CREATE INDEX "idx_offers_restaurant" ON "public"."special_offers" USING "btree" ("restaurant_id");



CREATE INDEX "idx_offers_validity" ON "public"."special_offers" USING "btree" ("valid_from", "valid_until");



CREATE INDEX "idx_order_items_menu_item" ON "public"."order_items" USING "btree" ("menu_item_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_status" ON "public"."order_items" USING "btree" ("status");



CREATE INDEX "idx_order_status_history_order_id" ON "public"."order_status_history" USING "btree" ("order_id");



CREATE INDEX "idx_orders_active_only" ON "public"."orders" USING "btree" ("restaurant_id", "priority_level" DESC, "created_at") WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'preparing'::"text", 'ready'::"text"]));



CREATE INDEX "idx_orders_booking_id" ON "public"."orders" USING "btree" ("booking_id");



CREATE INDEX "idx_orders_course_type" ON "public"."orders" USING "btree" ("restaurant_id", "course_type", "status");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at");



CREATE INDEX "idx_orders_kitchen_performance" ON "public"."orders" USING "btree" ("restaurant_id", "status", "priority_level" DESC, "created_at") WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'preparing'::"text", 'ready'::"text"]));



CREATE INDEX "idx_orders_kitchen_workload" ON "public"."orders" USING "btree" ("restaurant_id", "status", "course_type", "priority_level", "created_at");



CREATE INDEX "idx_orders_priority" ON "public"."orders" USING "btree" ("restaurant_id", "priority_level", "status");



CREATE INDEX "idx_orders_realtime_updates" ON "public"."orders" USING "btree" ("restaurant_id", "updated_at" DESC) WHERE ("status" = ANY (ARRAY['confirmed'::"text", 'preparing'::"text", 'ready'::"text"]));



CREATE INDEX "idx_orders_restaurant_id" ON "public"."orders" USING "btree" ("restaurant_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_status_restaurant" ON "public"."orders" USING "btree" ("restaurant_id", "status");



CREATE INDEX "idx_orders_table_id" ON "public"."orders" USING "btree" ("table_id");



CREATE INDEX "idx_playlist_collaborators_playlist_id" ON "public"."playlist_collaborators" USING "btree" ("playlist_id");



CREATE INDEX "idx_playlist_collaborators_user_id" ON "public"."playlist_collaborators" USING "btree" ("user_id");



CREATE INDEX "idx_playlist_items_playlist_id" ON "public"."playlist_items" USING "btree" ("playlist_id");



CREATE INDEX "idx_playlist_items_restaurant_id" ON "public"."playlist_items" USING "btree" ("restaurant_id");



CREATE INDEX "idx_post_comments_post_id" ON "public"."post_comments" USING "btree" ("post_id");



CREATE INDEX "idx_post_likes_post_id" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "idx_post_tags_post_id" ON "public"."post_tags" USING "btree" ("post_id");



CREATE INDEX "idx_post_tags_tagged_user_id" ON "public"."post_tags" USING "btree" ("tagged_user_id");



CREATE INDEX "idx_posts_booking_id" ON "public"."posts" USING "btree" ("booking_id");



CREATE INDEX "idx_posts_restaurant_id" ON "public"."posts" USING "btree" ("restaurant_id");



CREATE INDEX "idx_posts_user_id" ON "public"."posts" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_user_rating" ON "public"."profiles" USING "btree" ("user_rating");



CREATE INDEX "idx_restaurant_closures_restaurant_dates" ON "public"."restaurant_closures" USING "btree" ("restaurant_id", "start_date", "end_date");



CREATE INDEX "idx_restaurant_customers_analytics" ON "public"."restaurant_customers" USING "btree" ("restaurant_id", "last_visit", "total_bookings");



CREATE INDEX "idx_restaurant_customers_guest_email" ON "public"."restaurant_customers" USING "btree" ("guest_email");



CREATE INDEX "idx_restaurant_customers_lookup_guest" ON "public"."restaurant_customers" USING "btree" ("restaurant_id", "guest_email") WHERE (("guest_email" IS NOT NULL) AND ("user_id" IS NULL));



CREATE INDEX "idx_restaurant_customers_lookup_user" ON "public"."restaurant_customers" USING "btree" ("restaurant_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_restaurant_customers_restaurant_id" ON "public"."restaurant_customers" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_customers_user_id" ON "public"."restaurant_customers" USING "btree" ("user_id");



CREATE INDEX "idx_restaurant_hours_lookup" ON "public"."restaurant_hours" USING "btree" ("restaurant_id", "day_of_week", "open_time");



CREATE INDEX "idx_restaurant_hours_restaurant_id" ON "public"."restaurant_hours" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_loyalty_balance_restaurant_id" ON "public"."restaurant_loyalty_balance" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_loyalty_rules_active" ON "public"."restaurant_loyalty_rules" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_restaurant_loyalty_rules_restaurant_id" ON "public"."restaurant_loyalty_rules" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_loyalty_transactions_booking_id" ON "public"."restaurant_loyalty_transactions" USING "btree" ("booking_id");



CREATE INDEX "idx_restaurant_loyalty_transactions_restaurant_id" ON "public"."restaurant_loyalty_transactions" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_playlists_share_code" ON "public"."restaurant_playlists" USING "btree" ("share_code");



CREATE INDEX "idx_restaurant_playlists_user_id" ON "public"."restaurant_playlists" USING "btree" ("user_id");



CREATE INDEX "idx_restaurant_special_hours_restaurant_date" ON "public"."restaurant_special_hours" USING "btree" ("restaurant_id", "date");



CREATE INDEX "idx_restaurant_staff_active" ON "public"."restaurant_staff" USING "btree" ("is_active");



CREATE INDEX "idx_restaurant_staff_restaurant" ON "public"."restaurant_staff" USING "btree" ("restaurant_id", "role");



CREATE INDEX "idx_restaurant_staff_restaurant_id" ON "public"."restaurant_staff" USING "btree" ("restaurant_id");



CREATE INDEX "idx_restaurant_staff_role" ON "public"."restaurant_staff" USING "btree" ("role");



CREATE INDEX "idx_restaurant_staff_user" ON "public"."restaurant_staff" USING "btree" ("user_id", "restaurant_id");



CREATE INDEX "idx_restaurant_staff_user_id" ON "public"."restaurant_staff" USING "btree" ("user_id");



CREATE INDEX "idx_restaurant_tables_active" ON "public"."restaurant_tables" USING "btree" ("restaurant_id", "is_active");



CREATE INDEX "idx_restaurant_tables_number" ON "public"."restaurant_tables" USING "btree" ("restaurant_id", "table_number");



CREATE INDEX "idx_restaurant_tables_restaurant_active_combinable" ON "public"."restaurant_tables" USING "btree" ("restaurant_id", "is_active", "is_combinable") WHERE ("is_active" = true);



CREATE INDEX "idx_restaurants_cuisine" ON "public"."restaurants" USING "btree" ("cuisine_type");



CREATE INDEX "idx_restaurants_location" ON "public"."restaurants" USING "gist" ("location");



CREATE INDEX "idx_review_replies_replied_by" ON "public"."review_replies" USING "btree" ("replied_by");



CREATE INDEX "idx_review_replies_restaurant_id" ON "public"."review_replies" USING "btree" ("restaurant_id");



CREATE INDEX "idx_review_replies_review_id" ON "public"."review_replies" USING "btree" ("review_id");



CREATE INDEX "idx_reviews_created_at" ON "public"."reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reviews_rating" ON "public"."reviews" USING "btree" ("rating");



CREATE INDEX "idx_reviews_restaurant" ON "public"."reviews" USING "btree" ("restaurant_id");



CREATE INDEX "idx_reviews_user" ON "public"."reviews" USING "btree" ("user_id");



CREATE INDEX "idx_special_offers_discount" ON "public"."special_offers" USING "btree" ("discount_percentage");



CREATE INDEX "idx_special_offers_restaurant_id" ON "public"."special_offers" USING "btree" ("restaurant_id");



CREATE INDEX "idx_special_offers_valid_dates" ON "public"."special_offers" USING "btree" ("valid_from", "valid_until");



CREATE INDEX "idx_table_availability" ON "public"."table_availability" USING "btree" ("table_id", "date");



CREATE INDEX "idx_table_availability_booking" ON "public"."table_availability" USING "btree" ("booking_id");



CREATE INDEX "idx_table_combinations_restaurant" ON "public"."table_combinations" USING "btree" ("restaurant_id", "is_active");



CREATE INDEX "idx_tables_active" ON "public"."restaurant_tables" USING "btree" ("restaurant_id", "is_active");



CREATE INDEX "idx_tables_restaurant" ON "public"."restaurant_tables" USING "btree" ("restaurant_id");



CREATE INDEX "idx_tier_benefits_tier" ON "public"."tier_benefits" USING "btree" ("tier");



CREATE INDEX "idx_tier_benefits_type" ON "public"."tier_benefits" USING "btree" ("benefit_type");



CREATE INDEX "idx_user_loyalty_rule_usage_user_rule" ON "public"."user_loyalty_rule_usage" USING "btree" ("user_id", "rule_id");



CREATE INDEX "idx_user_offers_compound" ON "public"."user_offers" USING "btree" ("user_id", "status", "expires_at");



CREATE INDEX "idx_user_offers_expires_at" ON "public"."user_offers" USING "btree" ("expires_at");



CREATE UNIQUE INDEX "idx_user_offers_redemption_code" ON "public"."user_offers" USING "btree" ("redemption_code");



CREATE INDEX "idx_user_offers_used_at" ON "public"."user_offers" USING "btree" ("used_at");



CREATE INDEX "idx_user_offers_user" ON "public"."user_offers" USING "btree" ("user_id");



CREATE INDEX "idx_user_push_tokens_active" ON "public"."user_push_tokens" USING "btree" ("is_active");



CREATE INDEX "idx_user_push_tokens_platform" ON "public"."user_push_tokens" USING "btree" ("platform");



CREATE INDEX "idx_user_push_tokens_user_id" ON "public"."user_push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_user_rating_history_created" ON "public"."user_rating_history" USING "btree" ("created_at");



CREATE INDEX "idx_user_rating_history_user" ON "public"."user_rating_history" USING "btree" ("user_id");



CREATE INDEX "idx_vip_users" ON "public"."restaurant_vip_users" USING "btree" ("user_id", "restaurant_id", "valid_until");



CREATE INDEX "idx_vip_users_user_restaurant" ON "public"."restaurant_vip_users" USING "btree" ("user_id", "restaurant_id", "valid_until");



CREATE INDEX "idx_waitlist_date" ON "public"."waitlist" USING "btree" ("restaurant_id", "desired_date", "status");



CREATE INDEX "idx_waitlist_restaurant_active" ON "public"."waitlist" USING "btree" ("restaurant_id", "status", "created_at") WHERE ("status" = 'active'::"public"."waiting_status");



CREATE INDEX "idx_waitlist_restaurant_date" ON "public"."waitlist" USING "btree" ("restaurant_id", "desired_date");



CREATE INDEX "idx_waitlist_restaurant_date_status_created" ON "public"."waitlist" USING "btree" ("restaurant_id", "desired_date", "status", "created_at");



CREATE INDEX "idx_waitlist_user" ON "public"."waitlist" USING "btree" ("user_id");



CREATE UNIQUE INDEX "restaurant_customers_unique_identified_guests" ON "public"."restaurant_customers" USING "btree" ("restaurant_id", "guest_email", "guest_phone") WHERE (("guest_email" IS NOT NULL) OR ("guest_phone" IS NOT NULL));



CREATE OR REPLACE VIEW "public"."active_dining_bookings" WITH ("security_invoker"='on') AS
 SELECT "b"."id",
    "b"."user_id",
    "b"."restaurant_id",
    "b"."booking_time",
    "b"."party_size",
    "b"."status",
    "b"."special_requests",
    "b"."occasion",
    "b"."dietary_notes",
    "b"."confirmation_code",
    "b"."table_preferences",
    "b"."reminder_sent",
    "b"."checked_in_at",
    "b"."loyalty_points_earned",
    "b"."created_at",
    "b"."updated_at",
    "b"."applied_offer_id",
    "b"."expected_loyalty_points",
    "b"."guest_name",
    "b"."guest_email",
    "b"."guest_phone",
    "b"."is_group_booking",
    "b"."organizer_id",
    "b"."attendees",
    "b"."turn_time_minutes",
    "b"."applied_loyalty_rule_id",
    "b"."actual_end_time",
    "b"."seated_at",
    "b"."meal_progress",
    "p"."full_name" AS "guest_full_name",
    "p"."phone_number" AS "guest_phone_number",
    "array_agg"("rt"."table_number" ORDER BY "rt"."table_number") AS "table_numbers",
    "count"("bt"."table_id") AS "table_count"
   FROM ((("public"."bookings" "b"
     LEFT JOIN "public"."profiles" "p" ON (("b"."user_id" = "p"."id")))
     LEFT JOIN "public"."booking_tables" "bt" ON (("b"."id" = "bt"."booking_id")))
     LEFT JOIN "public"."restaurant_tables" "rt" ON (("bt"."table_id" = "rt"."id")))
  WHERE ("b"."status" = ANY (ARRAY['arrived'::"text", 'seated'::"text", 'ordered'::"text", 'appetizers'::"text", 'main_course'::"text", 'dessert'::"text", 'payment'::"text"]))
  GROUP BY "b"."id", "p"."full_name", "p"."phone_number";



CREATE OR REPLACE VIEW "public"."playlist_stats" AS
 SELECT "rp"."id",
    "rp"."user_id",
    "rp"."name",
    "rp"."description",
    "rp"."emoji",
    "rp"."is_public",
    "rp"."share_code",
    "rp"."view_count",
    "rp"."created_at",
    "rp"."updated_at",
    "count"(DISTINCT "pi"."id") AS "item_count",
    "count"(DISTINCT "pc"."user_id") AS "collaborator_count",
    "max"("pi"."created_at") AS "last_updated"
   FROM (("public"."restaurant_playlists" "rp"
     LEFT JOIN "public"."playlist_items" "pi" ON (("rp"."id" = "pi"."playlist_id")))
     LEFT JOIN "public"."playlist_collaborators" "pc" ON ((("rp"."id" = "pc"."playlist_id") AND ("pc"."accepted_at" IS NOT NULL))))
  GROUP BY "rp"."id";



CREATE OR REPLACE VIEW "public"."posts_with_details" AS
 SELECT "p"."id",
    "p"."user_id",
    "p"."booking_id",
    "p"."restaurant_id",
    "p"."content",
    "p"."visibility",
    "p"."created_at",
    "p"."updated_at",
    "u"."full_name" AS "user_name",
    "u"."avatar_url" AS "user_avatar",
    "r"."name" AS "restaurant_name",
    "r"."main_image_url" AS "restaurant_image",
    "count"(DISTINCT "pl"."id") AS "likes_count",
    "count"(DISTINCT "pc"."id") AS "comments_count",
    "count"(DISTINCT "pi"."id") AS "images_count",
    COALESCE("json_agg"(DISTINCT "jsonb_build_object"('id', "pi"."id", 'image_url', "pi"."image_url", 'image_order', "pi"."image_order")) FILTER (WHERE ("pi"."id" IS NOT NULL)), '[]'::json) AS "images",
    COALESCE("json_agg"(DISTINCT "jsonb_build_object"('id', "pt"."tagged_user_id", 'full_name', "tagged_user"."full_name", 'avatar_url', "tagged_user"."avatar_url")) FILTER (WHERE ("pt"."id" IS NOT NULL)), '[]'::json) AS "tagged_friends"
   FROM ((((((("public"."posts" "p"
     LEFT JOIN "public"."profiles" "u" ON (("p"."user_id" = "u"."id")))
     LEFT JOIN "public"."restaurants" "r" ON (("p"."restaurant_id" = "r"."id")))
     LEFT JOIN "public"."post_likes" "pl" ON (("p"."id" = "pl"."post_id")))
     LEFT JOIN "public"."post_comments" "pc" ON (("p"."id" = "pc"."post_id")))
     LEFT JOIN "public"."post_images" "pi" ON (("p"."id" = "pi"."post_id")))
     LEFT JOIN "public"."post_tags" "pt" ON (("p"."id" = "pt"."post_id")))
     LEFT JOIN "public"."profiles" "tagged_user" ON (("pt"."tagged_user_id" = "tagged_user"."id")))
  GROUP BY "p"."id", "u"."full_name", "u"."avatar_url", "r"."name", "r"."main_image_url";



CREATE OR REPLACE TRIGGER "booking_status_change_trigger" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."handle_booking_status_change"();



CREATE OR REPLACE TRIGGER "booking_status_notification_trigger" AFTER UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_booking_status_change"();



CREATE OR REPLACE TRIGGER "generate_booking_confirmation" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."generate_confirmation_code"();



CREATE OR REPLACE TRIGGER "loyalty_points_notification_trigger" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."notify_loyalty_points_change"();



CREATE OR REPLACE TRIGGER "loyalty_transaction_audit_trigger" AFTER INSERT ON "public"."restaurant_loyalty_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."log_loyalty_transaction"();



CREATE OR REPLACE TRIGGER "on_booking_invite_accepted" AFTER UPDATE OF "status" ON "public"."booking_invites" FOR EACH ROW EXECUTE FUNCTION "public"."handle_accepted_booking_invite"();



CREATE OR REPLACE TRIGGER "on_friend_request_accepted" AFTER UPDATE OF "status" ON "public"."friend_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_accepted_friend_request"();



CREATE OR REPLACE TRIGGER "refresh_availability_on_booking" AFTER INSERT OR DELETE OR UPDATE ON "public"."bookings" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trigger_refresh_availability"();



CREATE OR REPLACE TRIGGER "refresh_availability_on_booking_tables" AFTER INSERT OR DELETE OR UPDATE ON "public"."booking_tables" FOR EACH STATEMENT EXECUTE FUNCTION "public"."trigger_refresh_availability"();



CREATE OR REPLACE TRIGGER "trg_notify_booking_update" AFTER INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_booking_update"();



CREATE OR REPLACE TRIGGER "trg_notify_loyalty_activity" AFTER INSERT ON "public"."loyalty_activities" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_loyalty_activity"();



CREATE OR REPLACE TRIGGER "trg_notify_review_response" AFTER INSERT ON "public"."review_replies" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_review_response"();



CREATE OR REPLACE TRIGGER "trg_notify_user_offers_ins" AFTER INSERT ON "public"."user_offers" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_user_offers"();



CREATE OR REPLACE TRIGGER "trg_notify_user_offers_upd" AFTER UPDATE ON "public"."user_offers" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_user_offers"();



CREATE OR REPLACE TRIGGER "trg_notify_waitlist_update" AFTER UPDATE ON "public"."waitlist" FOR EACH ROW EXECUTE FUNCTION "public"."tg_notify_waitlist_update"();



CREATE OR REPLACE TRIGGER "trg_sync_notification_prefs" AFTER INSERT OR UPDATE ON "public"."user_privacy_settings" FOR EACH ROW EXECUTE FUNCTION "public"."sync_notification_prefs_from_privacy"();



CREATE OR REPLACE TRIGGER "trg_update_user_rating" AFTER UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_update_user_rating"();



CREATE OR REPLACE TRIGGER "trigger_manage_restaurant_customers" AFTER INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."manage_restaurant_customers"();



CREATE OR REPLACE TRIGGER "trigger_set_booking_request_expiry" BEFORE INSERT OR UPDATE OF "booking_time" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_request_expiry"();



CREATE OR REPLACE TRIGGER "trigger_set_share_code" BEFORE INSERT OR UPDATE ON "public"."restaurant_playlists" FOR EACH ROW EXECUTE FUNCTION "public"."set_share_code"();



CREATE OR REPLACE TRIGGER "trigger_set_user_offer_expiry" BEFORE INSERT ON "public"."user_offers" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_offer_expiry"();



CREATE OR REPLACE TRIGGER "trigger_sync_customer_names" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_customer_names"();



CREATE OR REPLACE TRIGGER "trigger_update_order_totals" AFTER INSERT OR DELETE OR UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_order_totals"();



CREATE OR REPLACE TRIGGER "trigger_update_restaurant_review_summary" AFTER INSERT OR DELETE OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_restaurant_review_summary"();



CREATE OR REPLACE TRIGGER "update_restaurant_hours_updated_at" BEFORE UPDATE ON "public"."restaurant_hours" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_restaurant_loyalty_balance_timestamp" BEFORE UPDATE ON "public"."restaurant_loyalty_balance" FOR EACH ROW EXECUTE FUNCTION "public"."update_restaurant_loyalty_balance_timestamp"();



CREATE OR REPLACE TRIGGER "update_restaurant_rating_trigger" AFTER INSERT OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_restaurant_rating"();



CREATE OR REPLACE TRIGGER "update_review_replies_updated_at" BEFORE UPDATE ON "public"."review_replies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_push_tokens_updated_at" BEFORE UPDATE ON "public"."user_push_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "validate_loyalty_balance_trigger" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."validate_restaurant_loyalty_balance"();



CREATE OR REPLACE TRIGGER "waitlist_status_notification_trigger" AFTER UPDATE ON "public"."waitlist" FOR EACH ROW EXECUTE FUNCTION "public"."notify_waitlist_status_change"();



ALTER TABLE ONLY "archive"."bookings"
    ADD CONSTRAINT "bookings_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."booking_archive"
    ADD CONSTRAINT "booking_archive_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."booking_attendees"
    ADD CONSTRAINT "booking_attendees_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_attendees"
    ADD CONSTRAINT "booking_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_invites"
    ADD CONSTRAINT "booking_invites_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_invites"
    ADD CONSTRAINT "booking_invites_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_invites"
    ADD CONSTRAINT "booking_invites_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."booking_tables"
    ADD CONSTRAINT "booking_tables_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_tables"
    ADD CONSTRAINT "booking_tables_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_applied_loyalty_rule_id_fkey" FOREIGN KEY ("applied_loyalty_rule_id") REFERENCES "public"."restaurant_loyalty_rules"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_applied_offer_id_fkey" FOREIGN KEY ("applied_offer_id") REFERENCES "public"."special_offers"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."customer_notes"
    ADD CONSTRAINT "customer_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."customer_notes"
    ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."restaurant_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_preferences"
    ADD CONSTRAINT "customer_preferences_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."restaurant_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_relationships"
    ADD CONSTRAINT "customer_relationships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."customer_relationships"
    ADD CONSTRAINT "customer_relationships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."restaurant_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_relationships"
    ADD CONSTRAINT "customer_relationships_related_customer_id_fkey" FOREIGN KEY ("related_customer_id") REFERENCES "public"."restaurant_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."restaurant_customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_tag_assignments"
    ADD CONSTRAINT "customer_tag_assignments_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."customer_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_tags"
    ADD CONSTRAINT "customer_tags_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_export_requests"
    ADD CONSTRAINT "data_export_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."floor_plans"
    ADD CONSTRAINT "floor_plans_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friends"
    ADD CONSTRAINT "friends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kitchen_assignments"
    ADD CONSTRAINT "kitchen_assignments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kitchen_assignments"
    ADD CONSTRAINT "kitchen_assignments_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."kitchen_assignments"
    ADD CONSTRAINT "kitchen_assignments_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."kitchen_stations"("id");



ALTER TABLE ONLY "public"."kitchen_display_settings"
    ADD CONSTRAINT "kitchen_display_settings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."kitchen_display_settings"
    ADD CONSTRAINT "kitchen_display_settings_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."kitchen_stations"("id");



ALTER TABLE ONLY "public"."kitchen_stations"
    ADD CONSTRAINT "kitchen_stations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."loyalty_activities"
    ADD CONSTRAINT "loyalty_activities_related_booking_id_fkey" FOREIGN KEY ("related_booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_activities"
    ADD CONSTRAINT "loyalty_activities_related_review_id_fkey" FOREIGN KEY ("related_review_id") REFERENCES "public"."reviews"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_activities"
    ADD CONSTRAINT "loyalty_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."special_offers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_item_stations"
    ADD CONSTRAINT "menu_item_stations_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."menu_item_stations"
    ADD CONSTRAINT "menu_item_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."kitchen_stations"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_delivery_logs"
    ADD CONSTRAINT "notification_delivery_logs_outbox_id_fkey" FOREIGN KEY ("outbox_id") REFERENCES "public"."notification_outbox"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_outbox"
    ADD CONSTRAINT "notification_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."kitchen_stations"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id");



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."restaurant_playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_collaborators"
    ADD CONSTRAINT "playlist_collaborators_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "public"."restaurant_playlists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."playlist_items"
    ADD CONSTRAINT "playlist_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_images"
    ADD CONSTRAINT "post_images_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_tags"
    ADD CONSTRAINT "post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_tags"
    ADD CONSTRAINT "post_tags_tagged_user_id_fkey" FOREIGN KEY ("tagged_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."restaurant_availability"
    ADD CONSTRAINT "restaurant_availability_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."restaurant_closures"
    ADD CONSTRAINT "restaurant_closures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."restaurant_closures"
    ADD CONSTRAINT "restaurant_closures_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_customers"
    ADD CONSTRAINT "restaurant_customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_customers"
    ADD CONSTRAINT "restaurant_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."restaurant_hours"
    ADD CONSTRAINT "restaurant_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_loyalty_balance"
    ADD CONSTRAINT "restaurant_loyalty_balance_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_loyalty_rules"
    ADD CONSTRAINT "restaurant_loyalty_rules_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_loyalty_transactions"
    ADD CONSTRAINT "restaurant_loyalty_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."restaurant_loyalty_transactions"
    ADD CONSTRAINT "restaurant_loyalty_transactions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."restaurant_loyalty_transactions"
    ADD CONSTRAINT "restaurant_loyalty_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."restaurant_playlists"
    ADD CONSTRAINT "restaurant_playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_special_hours"
    ADD CONSTRAINT "restaurant_special_hours_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."restaurant_special_hours"
    ADD CONSTRAINT "restaurant_special_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_staff"
    ADD CONSTRAINT "restaurant_staff_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."restaurant_staff"
    ADD CONSTRAINT "restaurant_staff_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_staff"
    ADD CONSTRAINT "restaurant_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_tables"
    ADD CONSTRAINT "restaurant_tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."restaurant_turn_times"
    ADD CONSTRAINT "restaurant_turn_times_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."restaurant_vip_users"
    ADD CONSTRAINT "restaurant_vip_users_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."restaurant_vip_users"
    ADD CONSTRAINT "restaurant_vip_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_replied_by_fkey" FOREIGN KEY ("replied_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."special_offers"
    ADD CONSTRAINT "special_offers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."table_availability"
    ADD CONSTRAINT "table_availability_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."table_availability"
    ADD CONSTRAINT "table_availability_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."restaurant_tables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."table_combinations"
    ADD CONSTRAINT "table_combinations_primary_table_id_fkey" FOREIGN KEY ("primary_table_id") REFERENCES "public"."restaurant_tables"("id");



ALTER TABLE ONLY "public"."table_combinations"
    ADD CONSTRAINT "table_combinations_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."table_combinations"
    ADD CONSTRAINT "table_combinations_secondary_table_id_fkey" FOREIGN KEY ("secondary_table_id") REFERENCES "public"."restaurant_tables"("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_loyalty_rule_usage"
    ADD CONSTRAINT "user_loyalty_rule_usage_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."user_loyalty_rule_usage"
    ADD CONSTRAINT "user_loyalty_rule_usage_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."restaurant_loyalty_rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_loyalty_rule_usage"
    ADD CONSTRAINT "user_loyalty_rule_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_offers"
    ADD CONSTRAINT "user_offers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."user_offers"
    ADD CONSTRAINT "user_offers_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."special_offers"("id");



ALTER TABLE ONLY "public"."user_offers"
    ADD CONSTRAINT "user_offers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_privacy_settings"
    ADD CONSTRAINT "user_privacy_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_rating_history"
    ADD CONSTRAINT "user_rating_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_rating_history"
    ADD CONSTRAINT "user_rating_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Availability is viewable by everyone" ON "public"."restaurant_availability" FOR SELECT USING (true);



CREATE POLICY "Offers are viewable by everyone" ON "public"."special_offers" FOR SELECT USING (true);



CREATE POLICY "Restaurants are viewable by everyone" ON "public"."restaurants" FOR SELECT USING (true);



CREATE POLICY "Reviews are viewable by everyone" ON "public"."reviews" FOR SELECT USING (true);



CREATE POLICY "Users can create own bookings" ON "public"."bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own reviews" ON "public"."reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own reviews" ON "public"."reviews" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own favorites" ON "public"."favorites" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own offers" ON "public"."user_offers" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own waitlist entries" ON "public"."waitlist" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own bookings" ON "public"."bookings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own reviews" ON "public"."reviews" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own bookings" ON "public"."bookings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("path") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."_http_post_edge"("path" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_http_post_edge"("path" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_http_post_edge"("path" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."addauth"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer, "p_archive_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer, "p_archive_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."archive_old_bookings"("p_days_to_keep" integer, "p_archive_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_decline_expired_pending_bookings"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_decline_expired_pending_bookings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_decline_expired_pending_bookings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_decline_expired_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_decline_expired_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_decline_expired_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."award_loyalty_points"("p_user_id" "uuid", "p_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."award_loyalty_points"("p_user_id" "uuid", "p_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_loyalty_points"("p_user_id" "uuid", "p_points" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."award_loyalty_points_with_tracking"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_description" "text", "p_related_booking_id" "uuid", "p_related_review_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."award_loyalty_points_with_tracking"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_description" "text", "p_related_booking_id" "uuid", "p_related_review_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_loyalty_points_with_tracking"("p_user_id" "uuid", "p_points" integer, "p_activity_type" "text", "p_description" "text", "p_related_booking_id" "uuid", "p_related_review_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."award_restaurant_loyalty_points"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."award_restaurant_loyalty_points"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."award_restaurant_loyalty_points"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_offer_expiry"("p_claimed_at" timestamp with time zone, "p_offer_valid_until" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_offer_expiry"("p_claimed_at" timestamp with time zone, "p_offer_valid_until" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_offer_expiry"("p_claimed_at" timestamp with time zone, "p_offer_valid_until" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_tier"("p_points" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_tier"("p_points" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_tier"("p_points" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_user_rating"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_user_rating"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_user_rating"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid", "p_exclude_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid", "p_exclude_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_booking_overlap"("p_table_ids" "uuid"[], "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_exclude_booking_id" "uuid", "p_exclude_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_booking_system_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_booking_system_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_booking_system_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_in_booking"("p_booking_id" "uuid", "p_checked_in_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_in_booking"("p_booking_id" "uuid", "p_checked_in_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_in_booking"("p_booking_id" "uuid", "p_checked_in_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_loyalty_rules_for_booking"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_loyalty_rules_for_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_loyalty_rules_for_booking"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_loyalty_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_loyalty_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_loyalty_rules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_booking_and_finalize_loyalty"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_booking_and_finalize_loyalty"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_booking_and_finalize_loyalty"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid", "p_booking_policy" "text", "p_expected_loyalty_points" integer, "p_applied_loyalty_rule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid", "p_booking_policy" "text", "p_expected_loyalty_points" integer, "p_applied_loyalty_rule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_with_tables"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid", "p_booking_policy" "text", "p_expected_loyalty_points" integer, "p_applied_loyalty_rule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_booking_with_tables_debug"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_booking_with_tables_debug"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_with_tables_debug"("p_user_id" "uuid", "p_restaurant_id" "uuid", "p_booking_time" timestamp with time zone, "p_party_size" integer, "p_table_ids" "uuid"[], "p_turn_time" integer, "p_special_requests" "text", "p_occasion" "text", "p_dietary_notes" "text"[], "p_table_preferences" "text"[], "p_is_group_booking" boolean, "p_applied_offer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_booking_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_booking_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_booking_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_notification"("p_user_id" "uuid", "p_category" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_deeplink" "text", "p_channels" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_notification"("p_user_id" "uuid", "p_category" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_deeplink" "text", "p_channels" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_notification"("p_user_id" "uuid", "p_category" "text", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb", "p_deeplink" "text", "p_channels" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_offer_expiry_notices"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_offer_expiry_notices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_offer_expiry_notices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_review_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_review_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_review_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_old_redemptions"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_old_redemptions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_old_redemptions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_old_user_offers"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_old_user_offers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_old_user_offers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_alternative_slots"("p_restaurant_id" "uuid", "p_original_time" timestamp with time zone, "p_party_size" integer, "p_duration_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_alternative_slots"("p_restaurant_id" "uuid", "p_original_time" timestamp with time zone, "p_party_size" integer, "p_duration_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_alternative_slots"("p_restaurant_id" "uuid", "p_original_time" timestamp with time zone, "p_party_size" integer, "p_duration_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_booking_without_tables"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fix_booking_without_tables"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_booking_without_tables"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fix_customer_data_inconsistencies"() TO "anon";
GRANT ALL ON FUNCTION "public"."fix_customer_data_inconsistencies"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fix_customer_data_inconsistencies"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_confirmation_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_confirmation_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_confirmation_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"("restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"("restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"("restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_share_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_share_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_share_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_tables"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_tables"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_tables"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_booked_tables_for_slot"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_booked_tables_for_slot"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_booked_tables_for_slot"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friend_recommendations"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_friend_recommendations"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friend_recommendations"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friend_suggestions"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_friend_suggestions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friend_suggestions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_loyalty_summary"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_loyalty_summary"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_loyalty_summary"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_max_turn_time"("p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_max_turn_time"("p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_max_turn_time"("p_restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_bookings_count"("p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_bookings_count"("p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_bookings_count"("p_restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_restaurant_menu"("p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_restaurant_menu"("p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_restaurant_menu"("p_restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_restaurant_status"("p_restaurant_id" "uuid", "p_check_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_restaurant_status"("p_restaurant_id" "uuid", "p_check_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_restaurant_status"("p_restaurant_id" "uuid", "p_check_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_availability_by_hour"("p_restaurant_id" "uuid", "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_availability_by_hour"("p_restaurant_id" "uuid", "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_availability_by_hour"("p_restaurant_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_utilization_report"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_utilization_report"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_utilization_report"("p_restaurant_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_turn_time"("p_restaurant_id" "uuid", "p_party_size" integer, "p_booking_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_turn_time"("p_restaurant_id" "uuid", "p_party_size" integer, "p_booking_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_turn_time"("p_restaurant_id" "uuid", "p_party_size" integer, "p_booking_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_offer_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_offer_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_offer_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_rating_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_rating_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_rating_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_restaurant_loyalty_summary"("p_user_id" "uuid", "p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_restaurant_loyalty_summary"("p_user_id" "uuid", "p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_restaurant_loyalty_summary"("p_user_id" "uuid", "p_restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "postgres";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "anon";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_accepted_booking_invite"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_accepted_booking_invite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_accepted_booking_invite"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_accepted_friend_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_accepted_friend_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_accepted_friend_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_booking_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_booking_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_booking_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."lock_booking_for_update"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."lock_booking_for_update"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lock_booking_for_update"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_loyalty_transaction"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_loyalty_transaction"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_loyalty_transaction"() TO "service_role";



GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "postgres";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manage_restaurant_customers"() TO "anon";
GRANT ALL ON FUNCTION "public"."manage_restaurant_customers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."manage_restaurant_customers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_existing_bookings_to_customers"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_existing_bookings_to_customers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_existing_bookings_to_customers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_booking_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_booking_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_booking_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_friend_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_friend_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_friend_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_friend_request_accepted"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_friend_request_accepted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_friend_request_accepted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_loyalty_points_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_loyalty_points_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_loyalty_points_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_shared_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_shared_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_shared_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_shared_booking_accepted"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_shared_booking_accepted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_shared_booking_accepted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_waitlist_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_waitlist_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_waitlist_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."perform_daily_maintenance"() TO "anon";
GRANT ALL ON FUNCTION "public"."perform_daily_maintenance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."perform_daily_maintenance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."quick_availability_check"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."quick_availability_check"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."quick_availability_check"("p_restaurant_id" "uuid", "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone, "p_party_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_loyalty_reward"("p_user_id" "uuid", "p_reward_id" "uuid", "p_offer_id" "uuid", "p_points_cost" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_loyalty_reward"("p_user_id" "uuid", "p_reward_id" "uuid", "p_offer_id" "uuid", "p_points_cost" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_loyalty_reward"("p_user_id" "uuid", "p_reward_id" "uuid", "p_offer_id" "uuid", "p_points_cost" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_table_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_table_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_table_availability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refund_restaurant_loyalty_points"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refund_restaurant_loyalty_points"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refund_restaurant_loyalty_points"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."run_notify"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_notify"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_notify"() TO "service_role";



GRANT ALL ON FUNCTION "public"."run_schedule_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."run_schedule_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."run_schedule_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_users"("search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_users"("search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_users"("search_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_push_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_priority" "text", "p_notification_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_push_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_priority" "text", "p_notification_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_push_notification"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb", "p_priority" "text", "p_notification_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_request_expiry"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_booking_request_expiry"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_booking_request_expiry"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_share_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_share_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_share_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_user_offer_expiry"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_offer_expiry"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_offer_expiry"() TO "service_role";



GRANT ALL ON FUNCTION "public"."should_block_pending_bookings"("p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."should_block_pending_bookings"("p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."should_block_pending_bookings"("p_restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."should_send_notification"("p_user_id" "uuid", "p_notification_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."should_send_notification"("p_user_id" "uuid", "p_notification_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."should_send_notification"("p_user_id" "uuid", "p_notification_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."suggest_optimal_tables"("p_restaurant_id" "uuid", "p_party_size" integer, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."suggest_optimal_tables"("p_restaurant_id" "uuid", "p_party_size" integer, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."suggest_optimal_tables"("p_restaurant_id" "uuid", "p_party_size" integer, "p_start_time" timestamp with time zone, "p_end_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_customer_names"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_customer_names"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_customer_names"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_notification_prefs_from_privacy"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_notification_prefs_from_privacy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_notification_prefs_from_privacy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_notify_booking_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_notify_booking_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_notify_booking_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_notify_loyalty_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_notify_loyalty_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_notify_loyalty_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_notify_review_response"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_notify_review_response"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_notify_review_response"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_notify_user_offers"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_notify_user_offers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_notify_user_offers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_notify_waitlist_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_notify_waitlist_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_notify_waitlist_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_favorite"("restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_favorite"("restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_favorite"("restaurant_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_refresh_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_refresh_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_refresh_availability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_update_user_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_update_user_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_update_user_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_all_customer_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_all_customer_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_all_customer_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_booking_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_booking_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_booking_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_customer_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_playlist_positions"("updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_playlist_positions"("updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_playlist_positions"("updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_restaurant_availability"("p_restaurant_id" "uuid", "p_date" "date", "p_time_slot" time without time zone, "p_party_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_restaurant_availability"("p_restaurant_id" "uuid", "p_date" "date", "p_time_slot" time without time zone, "p_party_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_restaurant_availability"("p_restaurant_id" "uuid", "p_date" "date", "p_time_slot" time without time zone, "p_party_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_restaurant_loyalty_balance_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_restaurant_loyalty_balance_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_restaurant_loyalty_balance_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_restaurant_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_restaurant_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_restaurant_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_restaurant_review_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_restaurant_review_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_restaurant_review_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_staff_last_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_staff_last_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_staff_last_login"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_rating"("p_user_id" "uuid", "p_booking_id" "uuid", "p_change_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_rating"("p_user_id" "uuid", "p_booking_id" "uuid", "p_change_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_rating"("p_user_id" "uuid", "p_booking_id" "uuid", "p_change_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."use_loyalty_redemption"("p_redemption_id" "uuid", "p_user_id" "uuid", "p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."use_loyalty_redemption"("p_redemption_id" "uuid", "p_user_id" "uuid", "p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_loyalty_redemption"("p_redemption_id" "uuid", "p_user_id" "uuid", "p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."use_user_offer"("p_redemption_code" "text", "p_user_id" "uuid", "p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."use_user_offer"("p_redemption_code" "text", "p_user_id" "uuid", "p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."use_user_offer"("p_redemption_code" "text", "p_user_id" "uuid", "p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_acceptance"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_acceptance"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_acceptance"("p_booking_id" "uuid", "p_table_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_restaurant_loyalty_balance"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_restaurant_loyalty_balance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_restaurant_loyalty_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_table_combination"("p_table_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_table_combination"("p_table_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_table_combination"("p_table_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_customer_statistics"("p_restaurant_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_customer_statistics"("p_restaurant_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_customer_statistics"("p_restaurant_id" "uuid") TO "service_role";












GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "service_role";















GRANT ALL ON TABLE "public"."active_dining_bookings" TO "anon";
GRANT ALL ON TABLE "public"."active_dining_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."active_dining_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."booking_archive" TO "anon";
GRANT ALL ON TABLE "public"."booking_archive" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_archive" TO "service_role";



GRANT ALL ON TABLE "public"."booking_attendees" TO "anon";
GRANT ALL ON TABLE "public"."booking_attendees" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_attendees" TO "service_role";



GRANT ALL ON TABLE "public"."booking_invites" TO "anon";
GRANT ALL ON TABLE "public"."booking_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_invites" TO "service_role";



GRANT ALL ON TABLE "public"."booking_status_history" TO "anon";
GRANT ALL ON TABLE "public"."booking_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."booking_tables" TO "anon";
GRANT ALL ON TABLE "public"."booking_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_tables" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."customer_notes" TO "anon";
GRANT ALL ON TABLE "public"."customer_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_notes" TO "service_role";



GRANT ALL ON TABLE "public"."customer_preferences" TO "anon";
GRANT ALL ON TABLE "public"."customer_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."customer_relationships" TO "anon";
GRANT ALL ON TABLE "public"."customer_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."customer_tag_assignments" TO "anon";
GRANT ALL ON TABLE "public"."customer_tag_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_tag_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."customer_tags" TO "anon";
GRANT ALL ON TABLE "public"."customer_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_tags" TO "service_role";



GRANT ALL ON TABLE "public"."data_export_requests" TO "anon";
GRANT ALL ON TABLE "public"."data_export_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."data_export_requests" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."floor_plans" TO "anon";
GRANT ALL ON TABLE "public"."floor_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."floor_plans" TO "service_role";



GRANT ALL ON TABLE "public"."friend_requests" TO "anon";
GRANT ALL ON TABLE "public"."friend_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."friend_requests" TO "service_role";



GRANT ALL ON TABLE "public"."friends" TO "anon";
GRANT ALL ON TABLE "public"."friends" TO "authenticated";
GRANT ALL ON TABLE "public"."friends" TO "service_role";



GRANT ALL ON TABLE "public"."kitchen_assignments" TO "anon";
GRANT ALL ON TABLE "public"."kitchen_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."kitchen_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."kitchen_display_settings" TO "anon";
GRANT ALL ON TABLE "public"."kitchen_display_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."kitchen_display_settings" TO "service_role";



GRANT ALL ON TABLE "public"."kitchen_stations" TO "anon";
GRANT ALL ON TABLE "public"."kitchen_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."kitchen_stations" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_activities" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_activities" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_rewards" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_rewards" TO "service_role";



GRANT ALL ON TABLE "public"."menu_categories" TO "anon";
GRANT ALL ON TABLE "public"."menu_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_categories" TO "service_role";



GRANT ALL ON TABLE "public"."menu_item_stations" TO "anon";
GRANT ALL ON TABLE "public"."menu_item_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_item_stations" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."notification_delivery_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_delivery_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_delivery_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notification_outbox" TO "anon";
GRANT ALL ON TABLE "public"."notification_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_modifications" TO "anon";
GRANT ALL ON TABLE "public"."order_modifications" TO "authenticated";
GRANT ALL ON TABLE "public"."order_modifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."playlist_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_items" TO "anon";
GRANT ALL ON TABLE "public"."playlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_items" TO "service_role";



GRANT ALL ON TABLE "public"."playlist_stats" TO "anon";
GRANT ALL ON TABLE "public"."playlist_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."playlist_stats" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_images" TO "anon";
GRANT ALL ON TABLE "public"."post_images" TO "authenticated";
GRANT ALL ON TABLE "public"."post_images" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."post_tags" TO "anon";
GRANT ALL ON TABLE "public"."post_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."post_tags" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."posts_with_details" TO "anon";
GRANT ALL ON TABLE "public"."posts_with_details" TO "authenticated";
GRANT ALL ON TABLE "public"."posts_with_details" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_availability" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_availability" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_closures" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_closures" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_customers" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_customers" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_hours" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_hours" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_hours_summary" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_hours_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_hours_summary" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_loyalty_balance" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_loyalty_balance" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_loyalty_balance" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_loyalty_rules" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_loyalty_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_loyalty_rules" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_loyalty_transactions" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_loyalty_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_loyalty_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_loyalty_analytics" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_loyalty_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_loyalty_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_playlists" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_playlists" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_playlists" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_special_hours" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_special_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_special_hours" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_staff" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_staff" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_tables" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_tables" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_turn_times" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_turn_times" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_turn_times" TO "service_role";



GRANT ALL ON TABLE "public"."restaurant_vip_users" TO "anon";
GRANT ALL ON TABLE "public"."restaurant_vip_users" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurant_vip_users" TO "service_role";



GRANT ALL ON TABLE "public"."review_replies" TO "anon";
GRANT ALL ON TABLE "public"."review_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."review_replies" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."special_offers" TO "anon";
GRANT ALL ON TABLE "public"."special_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."special_offers" TO "service_role";



GRANT ALL ON TABLE "public"."staff_permission_templates" TO "anon";
GRANT ALL ON TABLE "public"."staff_permission_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_permission_templates" TO "service_role";



GRANT ALL ON TABLE "public"."table_availability" TO "anon";
GRANT ALL ON TABLE "public"."table_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."table_availability" TO "service_role";



GRANT ALL ON TABLE "public"."table_combinations" TO "anon";
GRANT ALL ON TABLE "public"."table_combinations" TO "authenticated";
GRANT ALL ON TABLE "public"."table_combinations" TO "service_role";



GRANT ALL ON TABLE "public"."tier_benefits" TO "anon";
GRANT ALL ON TABLE "public"."tier_benefits" TO "authenticated";
GRANT ALL ON TABLE "public"."tier_benefits" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



GRANT ALL ON TABLE "public"."user_loyalty_rule_usage" TO "anon";
GRANT ALL ON TABLE "public"."user_loyalty_rule_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."user_loyalty_rule_usage" TO "service_role";



GRANT ALL ON TABLE "public"."user_offers" TO "anon";
GRANT ALL ON TABLE "public"."user_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_offers" TO "service_role";



GRANT ALL ON TABLE "public"."user_privacy_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_privacy_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_privacy_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."user_rating_history" TO "anon";
GRANT ALL ON TABLE "public"."user_rating_history" TO "authenticated";
GRANT ALL ON TABLE "public"."user_rating_history" TO "service_role";



GRANT ALL ON TABLE "public"."v_bookings_with_tables" TO "anon";
GRANT ALL ON TABLE "public"."v_bookings_with_tables" TO "authenticated";
GRANT ALL ON TABLE "public"."v_bookings_with_tables" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";









GRANT ALL ON TABLE "public"."mv_table_availability" TO "anon";
GRANT ALL ON TABLE "public"."mv_table_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_table_availability" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
