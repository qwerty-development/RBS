-- Content Moderation Migration
-- Add support for content flagging, user blocking, and content moderation

-- Create enum types for content moderation
CREATE TYPE content_flag_reason AS ENUM (
    'inappropriate_language',
    'harassment',
    'spam',
    'fake_review',
    'hate_speech',
    'violence_threats',
    'sexual_content',
    'discrimination',
    'other'
);

CREATE TYPE moderation_action AS ENUM (
    'pending',
    'approved',
    'removed',
    'warning_issued',
    'user_suspended',
    'user_banned'
);

-- Content flags table - for reporting objectionable content
CREATE TABLE content_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flagged_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content_type text NOT NULL CHECK (content_type IN ('review', 'post', 'comment', 'playlist')),
    content_id uuid NOT NULL,
    reason content_flag_reason NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid REFERENCES profiles(id),
    reviewer_notes text,
    
    -- Ensure user can't flag the same content multiple times
    UNIQUE(flagged_by_user_id, content_type, content_id)
);

-- User blocks table - for blocking abusive users
CREATE TABLE user_blocks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    blocking_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reason text,
    created_at timestamp with time zone DEFAULT now(),
    
    -- Ensure user can't block the same user multiple times
    UNIQUE(blocking_user_id, blocked_user_id),
    
    -- Ensure user can't block themselves
    CHECK(blocking_user_id != blocked_user_id)
);

-- Content moderation actions table - for tracking moderation decisions
CREATE TABLE content_moderation_actions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type text NOT NULL CHECK (content_type IN ('review', 'post', 'comment', 'playlist')),
    content_id uuid NOT NULL,
    flag_id uuid REFERENCES content_flags(id),
    action moderation_action NOT NULL,
    reason text,
    moderator_id uuid REFERENCES profiles(id),
    automated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone, -- For temporary suspensions
    
    -- Index for content lookups
    INDEX idx_content_moderation_content (content_type, content_id)
);

-- User suspensions table - for tracking user account suspensions
CREATE TABLE user_suspensions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    suspended_by uuid REFERENCES profiles(id),
    reason text NOT NULL,
    suspension_type text NOT NULL CHECK (suspension_type IN ('warning', 'temporary', 'permanent')),
    starts_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone, -- NULL for permanent bans
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Terms acceptance table - track when users accepted current terms
CREATE TABLE terms_acceptance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    terms_version text NOT NULL DEFAULT '1.0',
    accepted_at timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    
    -- Ensure one acceptance record per user per version
    UNIQUE(user_id, terms_version)
);

-- Add moderation status to existing content tables
ALTER TABLE reviews ADD COLUMN moderation_status text DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'removed'));
ALTER TABLE posts ADD COLUMN moderation_status text DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'removed'));
ALTER TABLE post_comments ADD COLUMN moderation_status text DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'removed'));
ALTER TABLE restaurant_playlists ADD COLUMN moderation_status text DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'removed'));

-- Add indexes for performance
CREATE INDEX idx_content_flags_content ON content_flags(content_type, content_id);
CREATE INDEX idx_content_flags_status ON content_flags(status);
CREATE INDEX idx_user_blocks_blocking ON user_blocks(blocking_user_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_user_id);
CREATE INDEX idx_user_suspensions_user ON user_suspensions(user_id);
CREATE INDEX idx_user_suspensions_active ON user_suspensions(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_terms_acceptance_user ON terms_acceptance(user_id);

-- Add RLS policies for content moderation tables

-- Content flags - users can only see their own flags
ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_flags_user_policy ON content_flags 
    FOR ALL USING (flagged_by_user_id = auth.uid());

-- Moderators can see all flags (assuming we have a moderator role)
CREATE POLICY content_flags_moderator_policy ON content_flags 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (profiles.id IN (SELECT user_id FROM rbs_admins))
        )
    );

-- User blocks - users can manage their own blocks
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_blocks_policy ON user_blocks 
    FOR ALL USING (blocking_user_id = auth.uid());

-- Content moderation actions - only moderators can see
ALTER TABLE content_moderation_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY content_moderation_actions_policy ON content_moderation_actions 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (profiles.id IN (SELECT user_id FROM rbs_admins))
        )
    );

-- User suspensions - users can see their own, moderators can see all
ALTER TABLE user_suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_suspensions_user_policy ON user_suspensions 
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY user_suspensions_moderator_policy ON user_suspensions 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (profiles.id IN (SELECT user_id FROM rbs_admins))
        )
    );

-- Terms acceptance - users can see their own
ALTER TABLE terms_acceptance ENABLE ROW LEVEL SECURITY;
CREATE POLICY terms_acceptance_policy ON terms_acceptance 
    FOR ALL USING (user_id = auth.uid());

-- Function to check if user is suspended
CREATE OR REPLACE FUNCTION is_user_suspended(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_suspensions 
        WHERE user_id = user_uuid 
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    );
END;
$$;

-- Function to check if content is flagged/moderated
CREATE OR REPLACE FUNCTION is_content_moderated(content_type_param text, content_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM content_moderation_actions 
        WHERE content_type = content_type_param 
        AND content_id = content_id_param
        AND action IN ('removed', 'user_suspended', 'user_banned')
    );
END;
$$;

-- Function to get user's current suspension
CREATE OR REPLACE FUNCTION get_user_suspension(user_uuid uuid)
RETURNS user_suspensions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    suspension user_suspensions;
BEGIN
    SELECT * INTO suspension 
    FROM user_suspensions 
    WHERE user_id = user_uuid 
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC 
    LIMIT 1;
    
    RETURN suspension;
END;
$$;

-- Function to check if user has blocked another user
CREATE OR REPLACE FUNCTION is_user_blocked(blocking_user_uuid uuid, blocked_user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_blocks 
        WHERE blocking_user_id = blocking_user_uuid 
        AND blocked_user_id = blocked_user_uuid
    );
END;
$$;