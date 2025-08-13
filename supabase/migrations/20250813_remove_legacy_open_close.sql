-- Migration: Remove or relax legacy opening_time/closing_time on restaurants
-- Date: 2025-08-13
-- Note: If other environments still rely on these columns, prefer making them nullable instead of dropping.

BEGIN;

-- Option A: Make columns nullable (safe default)
ALTER TABLE public.restaurants ALTER COLUMN opening_time DROP NOT NULL;
ALTER TABLE public.restaurants ALTER COLUMN closing_time DROP NOT NULL;

-- Option B (commented): Remove columns entirely once confirmed safe
-- ALTER TABLE public.restaurants DROP COLUMN IF EXISTS opening_time;
-- ALTER TABLE public.restaurants DROP COLUMN IF EXISTS closing_time;

COMMIT;

