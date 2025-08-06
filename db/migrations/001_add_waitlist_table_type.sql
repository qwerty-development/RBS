-- Update the waitlist table to add table_type column if it doesn't exist
-- This migration script adds the table_type column to the existing waitlist table

-- First, create the table_type enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE table_type AS ENUM ('any', 'booth', 'window', 'patio', 'standard', 'bar', 'private');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the waiting_status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE waiting_status AS ENUM ('active', 'notified', 'booked', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the waitlist table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  restaurant_id uuid NOT NULL,
  desired_date date NOT NULL,
  desired_time_range tstzrange NOT NULL,
  party_size integer NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  status waiting_status NOT NULL DEFAULT 'active'::waiting_status,
  table_type table_type NOT NULL DEFAULT 'any'::table_type,
  CONSTRAINT waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES restaurants (id),
  CONSTRAINT waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id)
);

-- Add table_type column if it doesn't exist (for existing tables)
DO $$ BEGIN
    ALTER TABLE public.waitlist ADD COLUMN table_type table_type NOT NULL DEFAULT 'any'::table_type;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON public.waitlist USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date ON public.waitlist USING btree (restaurant_id, desired_date);
CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date_status_created ON public.waitlist USING btree (restaurant_id, desired_date, status, created_at);
