-- Migration: Add notification triggers for automatic push notifications
-- This creates database triggers that automatically send notifications when relevant data changes

-- First, create a notification logs table to track sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    tokens_sent INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notification logs" ON notification_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON notification_logs TO authenticated;
GRANT USAGE ON SEQUENCE notification_logs_id_seq TO authenticated;

-- Function to send push notification via Edge Function with preference checking
-- Note: This function will be updated in add_notification_preferences.sql to include preference checking
CREATE OR REPLACE FUNCTION send_push_notification(
    p_user_id UUID,
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT NULL,
    p_priority TEXT DEFAULT 'default',
    p_notification_type TEXT DEFAULT 'general'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    function_url TEXT;
    payload JSONB;
    response TEXT;
BEGIN
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
    -- Note: This requires the pg_net extension to be enabled
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

-- Trigger function for booking status changes
CREATE OR REPLACE FUNCTION notify_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Trigger function for waitlist status changes
CREATE OR REPLACE FUNCTION notify_waitlist_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Trigger function for loyalty points changes
CREATE OR REPLACE FUNCTION notify_loyalty_points_change()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- Create triggers
DROP TRIGGER IF EXISTS booking_status_notification_trigger ON bookings;
CREATE TRIGGER booking_status_notification_trigger
    AFTER UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_booking_status_change();

DROP TRIGGER IF EXISTS waitlist_status_notification_trigger ON waitlist;
CREATE TRIGGER waitlist_status_notification_trigger
    AFTER UPDATE ON waitlist
    FOR EACH ROW
    EXECUTE FUNCTION notify_waitlist_status_change();

DROP TRIGGER IF EXISTS loyalty_points_notification_trigger ON profiles;
CREATE TRIGGER loyalty_points_notification_trigger
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION notify_loyalty_points_change();

-- Add comments for documentation
COMMENT ON FUNCTION send_push_notification IS 'Sends push notifications via Edge Function';
COMMENT ON FUNCTION notify_booking_status_change IS 'Trigger function to send notifications when booking status changes';
COMMENT ON FUNCTION notify_waitlist_status_change IS 'Trigger function to send notifications when waitlist status changes';
COMMENT ON FUNCTION notify_loyalty_points_change IS 'Trigger function to send notifications when loyalty points increase';
COMMENT ON TABLE notification_logs IS 'Logs all sent push notifications for tracking and debugging';
