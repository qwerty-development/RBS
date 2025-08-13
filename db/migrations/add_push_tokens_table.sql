-- Migration: Add user_push_tokens table for notification system
-- This table stores push notification tokens for users

CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    push_token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    device_id TEXT,
    device_name TEXT,
    app_version TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one token per user per platform
    UNIQUE(user_id, platform)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_platform ON user_push_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_active ON user_push_tokens(is_active);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_push_tokens_updated_at 
    BEFORE UPDATE ON user_push_tokens 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only access their own push tokens
CREATE POLICY "Users can view their own push tokens" ON user_push_tokens
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push tokens" ON user_push_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push tokens" ON user_push_tokens
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push tokens" ON user_push_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON user_push_tokens TO authenticated;
GRANT USAGE ON SEQUENCE user_push_tokens_id_seq TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE user_push_tokens IS 'Stores push notification tokens for users across different platforms';
COMMENT ON COLUMN user_push_tokens.user_id IS 'Reference to the user who owns this token';
COMMENT ON COLUMN user_push_tokens.push_token IS 'The actual push notification token from Expo/FCM/APNS';
COMMENT ON COLUMN user_push_tokens.platform IS 'Platform where the token was generated (ios, android, web)';
COMMENT ON COLUMN user_push_tokens.device_id IS 'Unique device identifier if available';
COMMENT ON COLUMN user_push_tokens.device_name IS 'Human-readable device name';
COMMENT ON COLUMN user_push_tokens.app_version IS 'App version when token was registered';
COMMENT ON COLUMN user_push_tokens.is_active IS 'Whether this token is currently active and should receive notifications';
