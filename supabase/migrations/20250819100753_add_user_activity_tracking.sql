-- Add last activity tracking to profiles table
ALTER TABLE public.profiles ADD COLUMN last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.last_activity_at IS 'Timestamp when user was last active in the application';

-- Optional: Add index for performance if you'll query by this often
-- CREATE INDEX idx_profiles_last_activity_at ON public.profiles(last_activity_at);
