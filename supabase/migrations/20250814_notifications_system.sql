-- Notifications Infrastructure Migration
-- Date: 2025-08-14

BEGIN;

-- 1) Device registry for push tokens
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  expo_push_token text,
  platform text CHECK (platform IN ('ios','android','web')),
  app_version text,
  locale text,
  timezone text,
  enabled boolean DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  UNIQUE (user_id, device_id)
);

-- 2) Expand notifications to support categories and richer data
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS deeplink text;

-- Extend type values if needed (do not error if already exists); relaxed by removing CHECK and replacing with domain-like validation via category.
-- Note: For safety, we won't drop the existing CHECK here. Instead, allow category to represent new kinds, and continue writing to notifications with type values compatible or use generic values.

-- 3) Outbox for channel delivery (push/email/sms/inapp)
CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('push','email','sms','inapp')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  attempts int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- 4) Delivery logs (one per send attempt)
CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id uuid NOT NULL REFERENCES public.notification_outbox(id) ON DELETE CASCADE,
  provider text,
  status text,
  error text,
  provider_message_id text,
  created_at timestamptz DEFAULT now()
);

-- 5) Preferences table (category-level) if not present already; we keep user_privacy_settings but add granular categories
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking boolean DEFAULT true,
  booking_reminders boolean DEFAULT true,
  waitlist boolean DEFAULT true,
  offers boolean DEFAULT true,
  reviews boolean DEFAULT true,
  loyalty boolean DEFAULT true,
  marketing boolean DEFAULT false,
  system boolean DEFAULT true,
  security boolean DEFAULT true,
  quiet_hours jsonb DEFAULT '{"enabled": false, "start": "22:00", "end": "08:00"}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 6) Helper: upsert preferences from existing privacy settings
CREATE OR REPLACE FUNCTION public.sync_notification_prefs_from_privacy()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_notification_prefs ON public.user_privacy_settings;
CREATE TRIGGER trg_sync_notification_prefs
AFTER INSERT OR UPDATE ON public.user_privacy_settings
FOR EACH ROW EXECUTE FUNCTION public.sync_notification_prefs_from_privacy();

-- 7) Enqueue convenience function
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id uuid,
  p_category text,
  p_type text,
  p_title text,
  p_message text,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_deeplink text DEFAULT NULL,
  p_channels text[] DEFAULT ARRAY['inapp','push']
) RETURNS uuid AS $$
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
$$ LANGUAGE plpgsql;

-- 8) Booking triggers (confirm, cancel, modify)
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
  IF (TG_OP = 'UPDATE') THEN
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
        PERFORM public.enqueue_notification(NEW.user_id, 'booking', v_type, v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push','email']);
      END IF;
    END IF;

    -- modification: time/party size change
    IF (OLD.booking_time IS DISTINCT FROM NEW.booking_time OR OLD.party_size IS DISTINCT FROM NEW.party_size) THEN
      v_title := 'Booking Updated';
      v_msg := 'Your booking details have changed.';
      v_type := 'booking_modified';
      v_data := jsonb_build_object('bookingId', NEW.id, 'restaurantId', NEW.restaurant_id, 'oldTime', OLD.booking_time, 'newTime', NEW.booking_time, 'oldParty', OLD.party_size, 'newParty', NEW.party_size);
      PERFORM public.enqueue_notification(NEW.user_id, 'booking', v_type, v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push','email']);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_booking_update ON public.bookings;
CREATE TRIGGER trg_notify_booking_update
AFTER UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_booking_update();

-- 9) Waitlist triggers (available/notified, position changes, expired)
CREATE OR REPLACE FUNCTION public.tg_notify_waitlist_update()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_waitlist_update ON public.waitlist;
CREATE TRIGGER trg_notify_waitlist_update
AFTER UPDATE ON public.waitlist
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_waitlist_update();

-- 10) Offers: new promotions assigned, expiring, redemptions used
CREATE OR REPLACE FUNCTION public.tg_notify_user_offers()
RETURNS trigger AS $$
DECLARE
  v_title text;
  v_msg text;
  v_type text;
  v_data jsonb;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_title := 'New Offer Available';
    v_msg := 'You have a new promotion you can use.';
    v_type := 'offer_assigned';
    v_data := jsonb_build_object('userOfferId', NEW.id, 'offerId', NEW.offer_id, 'expiresAt', NEW.expires_at);
    PERFORM public.enqueue_notification(NEW.user_id, 'offers', v_type, v_title, v_msg, v_data, 'app://profile/my-rewards', ARRAY['inapp','push','email']);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.used_at IS NULL AND NEW.used_at IS NOT NULL) THEN
      v_title := 'Offer Redeemed';
      v_msg := 'You redeemed an offer.';
      v_type := 'offer_redeemed';
      v_data := jsonb_build_object('userOfferId', NEW.id, 'offerId', NEW.offer_id, 'bookingId', NEW.booking_id);
      PERFORM public.enqueue_notification(NEW.user_id, 'offers', v_type, v_title, v_msg, v_data, 'app://profile/my-rewards', ARRAY['inapp','push','email']);
    ELSIF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'expired') THEN
      v_title := 'Offer Expired';
      v_msg := 'One of your offers has expired.';
      v_type := 'offer_expired';
      v_data := jsonb_build_object('userOfferId', NEW.id, 'offerId', NEW.offer_id);
      PERFORM public.enqueue_notification(NEW.user_id, 'offers', v_type, v_title, v_msg, v_data, 'app://profile/my-rewards', ARRAY['inapp']);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_user_offers_ins ON public.user_offers;
CREATE TRIGGER trg_notify_user_offers_ins
AFTER INSERT ON public.user_offers
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_user_offers();

DROP TRIGGER IF EXISTS trg_notify_user_offers_upd ON public.user_offers;
CREATE TRIGGER trg_notify_user_offers_upd
AFTER UPDATE ON public.user_offers
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_user_offers();

-- 11) Reviews: reminder (scheduled), restaurant responses, featured reviews (manual)
-- Response trigger
CREATE OR REPLACE FUNCTION public.tg_notify_review_response()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_review_response ON public.review_replies;
CREATE TRIGGER trg_notify_review_response
AFTER INSERT ON public.review_replies
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_review_response();

-- 12) Loyalty: points earned, milestones, rewards
CREATE OR REPLACE FUNCTION public.tg_notify_loyalty_activity()
RETURNS trigger AS $$
DECLARE
  v_title text;
  v_msg text;
  v_type text := 'loyalty_points';
  v_data jsonb;
BEGIN
  v_title := 'Loyalty Points Update';
  v_msg := 'Your loyalty balance has changed.';
  v_data := jsonb_build_object('activityId', NEW.id, 'points', NEW.points_earned, 'activityType', NEW.activity_type);
  PERFORM public.enqueue_notification(NEW.user_id, 'loyalty', v_type, v_title, v_msg, v_data, 'app://profile/loyalty', ARRAY['inapp','push','email']);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_loyalty_activity ON public.loyalty_activities;
CREATE TRIGGER trg_notify_loyalty_activity
AFTER INSERT ON public.loyalty_activities
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_loyalty_activity();

-- 13) Booking reminders scheduler helper (24h and 2h)
CREATE OR REPLACE FUNCTION public.enqueue_booking_reminders()
RETURNS void AS $$
DECLARE
  r record;
  v_title text;
  v_msg text;
  v_data jsonb;
  v_deeplink text;
BEGIN
  -- 24h reminders
  FOR r IN
    SELECT b.* FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.booking_time BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
  LOOP
    v_title := 'Upcoming Booking (Tomorrow)';
    v_msg := 'Reminder: You have a booking tomorrow.';
    v_deeplink := concat('app://booking/', r.id::text);
    v_data := jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id, 'time', r.booking_time);
    PERFORM public.enqueue_notification(r.user_id, 'booking', 'booking_reminder', v_title, v_msg, v_data, v_deeplink, ARRAY['inapp','push','email']);
  END LOOP;

  -- 2h reminders
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
END;
$$ LANGUAGE plpgsql;

COMMIT;

