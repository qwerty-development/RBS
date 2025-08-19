-- Make booking reminders idempotent per window to prevent repeated sends
-- Date: 2025-08-14

BEGIN;

-- Redefine enqueue_booking_reminders to use distinct types per window
-- and NOT EXISTS checks against notifications to avoid duplicates.
CREATE OR REPLACE FUNCTION public.enqueue_booking_reminders()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

COMMIT;

