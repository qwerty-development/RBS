-- Migration: Add notification preferences system
-- This allows users to control which types of notifications they want to receive

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Booking notifications
    booking_confirmations BOOLEAN DEFAULT true,
    booking_reminders BOOLEAN DEFAULT true,
    booking_cancellations BOOLEAN DEFAULT true,
    booking_modifications BOOLEAN DEFAULT true,
    
    -- Waitlist notifications
    waitlist_available BOOLEAN DEFAULT true,
    waitlist_position_updates BOOLEAN DEFAULT true,
    waitlist_expired BOOLEAN DEFAULT true,
    
    -- Offer notifications
    special_offers BOOLEAN DEFAULT true,
    loyalty_offers BOOLEAN DEFAULT true,
    expiring_offers BOOLEAN DEFAULT true,
    
    -- Review notifications
    review_reminders BOOLEAN DEFAULT true,
    review_responses BOOLEAN DEFAULT true,
    review_featured BOOLEAN DEFAULT true,
    
    -- Loyalty notifications
    points_earned BOOLEAN DEFAULT true,
    milestone_reached BOOLEAN DEFAULT true,
    rewards_available BOOLEAN DEFAULT true,
    rewards_expiring BOOLEAN DEFAULT true,
    
    -- System notifications
    app_updates BOOLEAN DEFAULT false,
    maintenance_notices BOOLEAN DEFAULT true,
    security_alerts BOOLEAN DEFAULT true,
    
    -- General settings
    push_notifications_enabled BOOLEAN DEFAULT true,
    email_notifications_enabled BOOLEAN DEFAULT true,
    quiet_hours_enabled BOOLEAN DEFAULT false,
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preference record per user
    UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences" ON notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" ON notification_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences" ON notification_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON notification_preferences TO authenticated;
GRANT USAGE ON SEQUENCE notification_preferences_id_seq TO authenticated;

-- Function to get user notification preferences with defaults
CREATE OR REPLACE FUNCTION get_user_notification_preferences(p_user_id UUID)
RETURNS notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    prefs notification_preferences;
BEGIN
    -- Try to get existing preferences
    SELECT * INTO prefs
    FROM notification_preferences
    WHERE user_id = p_user_id;
    
    -- If no preferences exist, create default ones
    IF NOT FOUND THEN
        INSERT INTO notification_preferences (user_id)
        VALUES (p_user_id)
        RETURNING * INTO prefs;
    END IF;
    
    RETURN prefs;
END;
$$;

-- Function to check if user should receive a specific notification type
CREATE OR REPLACE FUNCTION should_send_notification(
    p_user_id UUID,
    p_notification_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    prefs notification_preferences;
    current_time TIME;
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
        current_time := CURRENT_TIME;
        
        -- Handle quiet hours that span midnight
        IF prefs.quiet_hours_start > prefs.quiet_hours_end THEN
            -- Quiet hours span midnight (e.g., 22:00 to 08:00)
            IF current_time >= prefs.quiet_hours_start OR current_time <= prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        ELSE
            -- Normal quiet hours (e.g., 01:00 to 06:00)
            IF current_time >= prefs.quiet_hours_start AND current_time <= prefs.quiet_hours_end THEN
                RETURN false;
            END IF;
        END IF;
    END IF;
    
    -- Check specific notification type preferences
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

-- Update the send_push_notification function to check preferences
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

-- Update trigger functions to use notification types
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
    notification_type TEXT;
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
    
    -- Determine notification content and type based on status
    CASE NEW.status
        WHEN 'confirmed' THEN
            notification_title := '✅ Booking Confirmed!';
            notification_body := format('Your table for %s at %s is confirmed for %s at %s.',
                NEW.party_size, restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'confirmed');
            notification_type := 'booking_confirmation';
            
        WHEN 'cancelled' THEN
            notification_title := '❌ Booking Cancelled';
            notification_body := format('Your booking at %s for %s at %s has been cancelled.',
                restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'cancelled');
            notification_type := 'booking_cancellation';
            
        WHEN 'declined' THEN
            notification_title := '😔 Booking Declined';
            notification_body := format('%s couldn''t accommodate your request for %s at %s. Try booking a different time.',
                restaurant_name, booking_date, booking_time);
            notification_data := notification_data || jsonb_build_object('action', 'declined');
            notification_type := 'booking_cancellation';
            
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
        notification_type
    );
    
    RETURN NEW;
END;
$$;

-- Add comments
COMMENT ON TABLE notification_preferences IS 'User preferences for different types of notifications';
COMMENT ON FUNCTION get_user_notification_preferences IS 'Gets user notification preferences, creating defaults if none exist';
COMMENT ON FUNCTION should_send_notification IS 'Checks if a user should receive a specific type of notification based on their preferences';
