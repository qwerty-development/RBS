-- Add shared table support for communal dining experiences
-- This migration adds support for tables where multiple parties can book seats simultaneously

-- Step 1: Add 'shared' to the table_type enum in restaurant_tables
ALTER TABLE public.restaurant_tables 
DROP CONSTRAINT restaurant_tables_table_type_check;

ALTER TABLE public.restaurant_tables 
ADD CONSTRAINT restaurant_tables_table_type_check 
CHECK (table_type = ANY (ARRAY['booth'::text, 'window'::text, 'patio'::text, 'standard'::text, 'bar'::text, 'private'::text, 'shared'::text]));

-- Step 2: Add seats_occupied column to booking_tables to track how many seats each booking uses
ALTER TABLE public.booking_tables 
ADD COLUMN seats_occupied INTEGER NOT NULL DEFAULT 1 
CHECK (seats_occupied > 0);

-- Step 3: Add comment to explain the new column
COMMENT ON COLUMN public.booking_tables.seats_occupied IS 'Number of seats this booking occupies at the table (for shared tables)';

-- Step 4: Add is_shared_booking flag to bookings table for easier querying
ALTER TABLE public.bookings 
ADD COLUMN is_shared_booking BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.bookings.is_shared_booking IS 'Indicates if this booking is for a shared table where multiple parties can sit together';

-- Step 5: Add index for performance on shared table queries
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_shared_type ON public.restaurant_tables(table_type) WHERE table_type = 'shared';

-- Step 6: Add index for booking_tables seats_occupied for availability queries
CREATE INDEX IF NOT EXISTS idx_booking_tables_seats_occupied ON public.booking_tables(seats_occupied);

-- Step 7: Create a function to calculate available seats for shared tables
CREATE OR REPLACE FUNCTION get_shared_table_available_seats(
    table_id_param UUID,
    booking_time_param TIMESTAMP WITH TIME ZONE,
    turn_time_minutes_param INTEGER DEFAULT 120
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_capacity INTEGER;
    occupied_seats INTEGER;
    booking_start TIMESTAMP WITH TIME ZONE;
    booking_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get table capacity
    SELECT capacity INTO table_capacity
    FROM public.restaurant_tables 
    WHERE id = table_id_param AND table_type = 'shared';
    
    IF table_capacity IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Calculate time window for overlapping bookings
    booking_start := booking_time_param;
    booking_end := booking_time_param + (turn_time_minutes_param || ' minutes')::INTERVAL;
    
    -- Calculate currently occupied seats for this time window
    SELECT COALESCE(SUM(bt.seats_occupied), 0) INTO occupied_seats
    FROM public.booking_tables bt
    JOIN public.bookings b ON bt.booking_id = b.id
    WHERE bt.table_id = table_id_param
    AND b.status IN ('pending', 'confirmed', 'arrived', 'seated', 'ordered', 'appetizers', 'main_course', 'dessert')
    AND b.booking_time < booking_end
    AND (b.booking_time + COALESCE(b.turn_time_minutes, turn_time_minutes_param) * INTERVAL '1 minute') > booking_start;
    
    RETURN GREATEST(0, table_capacity - occupied_seats);
END;
$$;

-- Step 8: Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION get_shared_table_available_seats(UUID, TIMESTAMP WITH TIME ZONE, INTEGER) TO authenticated, anon;

-- Step 9: Add RLS policy for shared table bookings
-- Users can see shared bookings at tables they have bookings for (for social features)
CREATE POLICY "Users can view shared table bookings for their tables" ON public.bookings
FOR SELECT USING (
    is_shared_booking = TRUE AND
    EXISTS (
        SELECT 1 FROM public.booking_tables bt1
        JOIN public.booking_tables bt2 ON bt1.table_id = bt2.table_id
        JOIN public.bookings b2 ON bt2.booking_id = b2.id
        WHERE bt1.booking_id = id AND b2.user_id = auth.uid()
    )
);