-- Relax notifications.type check constraint to allow new types
-- Date: 2025-08-14

BEGIN;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'notifications'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%type%'
  ) LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Optional: add a minimal check to ensure non-empty type
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_nonempty CHECK (length(type) > 0);

COMMIT;

