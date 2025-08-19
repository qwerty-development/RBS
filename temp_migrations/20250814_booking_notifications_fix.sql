-- Booking notifications fixes: handle INSERT events and add 1-hour reminder window
-- Date: 2025-08-14

BEGIN;

-- 1) Update booking trigger function to also run on INSERT
CREATE OR REPLACE FUNCTION public.tg_notify_booking_update()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

-- Recreate trigger to fire on INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_notify_booking_update ON public.bookings;
CREATE TRIGGER trg_notify_booking_update
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_booking_update();

-- 2) Add a 1-hour reminder window to scheduled reminders
CREATE OR REPLACE FUNCTION public.enqueue_booking_reminders()
RETURNS void AS $$
DECLARE
  r record;
  v_title text;
  v_msg text;
  v_data jsonb;
  v_deeplink text;
BEGIN
  -- 24h reminders (existing)
  FOR r IN
    SELECT b.* FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
  LOOP
    v_title := 'Upcoming Booking (Tomorrow)';
    v_msg := 'Reminder: You have a booking tomorrow.';
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
  END LOOP;

  -- 2h reminders (existing)
  FOR r IN
    SELECT b.* FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '110 minutes' AND now() + interval '130 minutes'
  LOOP
    v_title := 'Upcoming Booking (2 hours)';
    v_msg := 'Reminder: Your booking is in about 2 hours.';
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
  END LOOP;

  -- 1h reminders (new)
  FOR r IN
    SELECT b.* FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '50 minutes' AND now() + interval '70 minutes'
  LOOP
    v_title := 'Upcoming Booking (1 hour)';
    v_msg := 'Reminder: Your booking is in about 1 hour.';
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push']);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMIT;

