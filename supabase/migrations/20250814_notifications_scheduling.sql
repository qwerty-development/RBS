-- Additional scheduling helpers for reviews and offer expiry
-- Date: 2025-08-14

BEGIN;

-- Review reminder: after booking completed, but no review after X hours
CREATE OR REPLACE FUNCTION public.enqueue_review_reminders()
RETURNS void AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT b.id, b.user_id, b.restaurant_id, b.booking_time
    FROM public.bookings b
    LEFT JOIN public.reviews rv ON rv.booking_id = b.id
    WHERE b.status = 'completed'
      AND rv.id IS NULL
      AND b.booking_time BETWEEN now() - interval '72 hours' AND now() - interval '24 hours'
  LOOP
    PERFORM public.enqueue_notification(
      r.user_id,
      'reviews',
      'review_reminder',
      'How was your visit?',
      'Leave a quick review to help others and earn points.',
      jsonb_build_object('bookingId', r.id, 'restaurantId', r.restaurant_id),
      'app://profile/reviews',
      ARRAY['inapp','push','email']
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Offer expiry warnings: 2 days before
CREATE OR REPLACE FUNCTION public.enqueue_offer_expiry_notices()
RETURNS void AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT uo.id, uo.user_id, uo.offer_id, uo.expires_at
    FROM public.user_offers uo
    WHERE uo.status = 'active'
      AND uo.expires_at BETWEEN now() + interval '36 hours' AND now() + interval '60 hours'
  LOOP
    PERFORM public.enqueue_notification(
      r.user_id,
      'offers',
      'offer_expiry_warning',
      'Offer expiring soon',
      'One of your offers is expiring soon. Don\'t miss out.',
      jsonb_build_object('userOfferId', r.id, 'offerId', r.offer_id, 'expiresAt', r.expires_at),
      'app://profile/my-rewards',
      ARRAY['inapp','push','email']
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMIT;

