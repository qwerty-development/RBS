-- =====================================================
-- ROLLBACK SCRIPT FOR REVIEW NOTIFICATION SYSTEM
-- =====================================================
-- Created: September 22, 2025
-- Purpose: Revert all changes made to implement review notification system
-- 
-- WARNING: This script will:
-- 1. Remove 'review_reminder' and 'booking_completed' from notification types
-- 2. Revert the booking update trigger to original state
-- 3. Delete test notifications and bookings created during implementation
-- 4. Clean up any orphaned notification_outbox entries
--
-- BACKUP RECOMMENDATION: 
-- Take a database backup before running this script!
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Clean up test data created during implementation
-- =====================================================

ROLLBACK; -- End the transaction to start with proper error handling

DO $$
DECLARE
    rollback_error_occurred BOOLEAN := FALSE;
    error_message TEXT;
BEGIN
    -- Start the actual rollback process
    RAISE NOTICE 'Starting rollback of review notification system...';
    
    -- =====================================================
    -- STEP 1: Clean up test notifications and outbox entries
    -- =====================================================
    
    RAISE NOTICE 'Step 1: Cleaning up test notifications...';
    
    -- Delete test notification_outbox entries for review reminders and booking completions
    DELETE FROM public.notification_outbox 
    WHERE type IN ('review_reminder', 'booking_completed');
    
    -- Delete test notifications created during implementation
    DELETE FROM public.notifications 
    WHERE type IN ('review_reminder', 'booking_completed')
      AND created_at > '2025-09-22 13:00:00+00'; -- Only delete recent test notifications
    
    -- Delete the specific test booking created during implementation
    DELETE FROM public.bookings 
    WHERE id = '875a0e6c-00bd-46d5-83d0-68da618f2e3b';
    
    RAISE NOTICE 'Test data cleanup completed.';
    
    -- =====================================================
    -- STEP 2: Revert the booking update trigger function
    -- =====================================================
    
    RAISE NOTICE 'Step 2: Reverting booking update trigger...';
    
    -- Restore the original trigger function (without booking completion logic)
    CREATE OR REPLACE FUNCTION public.tg_notify_booking_update()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $trigger$
    BEGIN
      -- Only handle basic status changes (original functionality)
      IF NEW.status != OLD.status THEN
        INSERT INTO public.notifications (user_id, type, title, message, data)
        VALUES (
          NEW.user_id,
          CASE 
            WHEN NEW.status = 'confirmed' THEN 'booking_confirmed'
            WHEN NEW.status = 'cancelled' THEN 'booking_cancelled' 
            ELSE 'system'
          END,
          CASE 
            WHEN NEW.status = 'confirmed' THEN 'Booking Confirmed'
            WHEN NEW.status = 'cancelled' THEN 'Booking Cancelled'
            ELSE 'System Notification'
          END,
          CASE 
            WHEN NEW.status = 'confirmed' THEN 'Your booking has been confirmed.'
            WHEN NEW.status = 'cancelled' THEN 'Your booking has been cancelled.'
            ELSE 'Notification'
          END,
          jsonb_build_object('booking_id', NEW.id)
        );
      END IF;

      RETURN NEW;
    END;
    $trigger$;
    
    RAISE NOTICE 'Booking update trigger reverted to original state.';
    
    -- =====================================================
    -- STEP 3: Revert notification_outbox constraint
    -- =====================================================
    
    RAISE NOTICE 'Step 3: Reverting notification_outbox constraint...';
    
    -- Remove the enhanced constraint and restore original
    ALTER TABLE public.notification_outbox 
    DROP CONSTRAINT IF EXISTS notification_outbox_type_check;

    -- Restore original constraint (without review_reminder and booking_completed)
    ALTER TABLE public.notification_outbox 
    ADD CONSTRAINT notification_outbox_type_check 
    CHECK (type IN ('booking_confirmed', 'booking_cancelled', 'booking_reminder', 'system', 'promotional'));
    
    RAISE NOTICE 'Notification outbox constraint reverted to original state.';
    
    -- =====================================================
    -- STEP 4: Verify rollback success
    -- =====================================================
    
    RAISE NOTICE 'Step 4: Verifying rollback...';
    
    -- Check that no review_reminder or booking_completed notifications remain
    IF EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE type IN ('review_reminder', 'booking_completed')
    ) THEN
        RAISE WARNING 'Some review/completion notifications still exist in the database!';
    END IF;
    
    -- Check that no review_reminder or booking_completed outbox entries remain  
    IF EXISTS (
        SELECT 1 FROM public.notification_outbox 
        WHERE type IN ('review_reminder', 'booking_completed')
    ) THEN
        RAISE WARNING 'Some review/completion outbox entries still exist in the database!';
    END IF;
    
    -- Test the constraint works
    BEGIN
        INSERT INTO public.notification_outbox (notification_id, type, channel, payload)
        VALUES (gen_random_uuid(), 'review_reminder', 'push', '{}');
        
        RAISE WARNING 'ROLLBACK FAILED: Constraint still allows review_reminder type!';
        rollback_error_occurred := TRUE;
        
    EXCEPTION WHEN check_violation THEN
        RAISE NOTICE 'SUCCESS: Constraint properly prevents review_reminder type.';
    END;
    
    -- Final success message
    IF NOT rollback_error_occurred THEN
        RAISE NOTICE '✅ ROLLBACK COMPLETED SUCCESSFULLY!';
        RAISE NOTICE 'All review notification system changes have been reverted.';
    ELSE
        RAISE NOTICE '❌ ROLLBACK HAD ISSUES - Please check warnings above.';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
    RAISE NOTICE '❌ ROLLBACK FAILED WITH ERROR: %', error_message;
    RAISE NOTICE 'You may need to manually review and fix the database state.';
    RAISE;
END $$;

-- =====================================================
-- MANUAL VERIFICATION QUERIES
-- =====================================================
-- Run these queries after the rollback to verify success:

-- 1. Check no review notifications remain:
-- SELECT count(*) FROM public.notifications WHERE type IN ('review_reminder', 'booking_completed');

-- 2. Check constraint is restored:
-- SELECT conname, consrc FROM pg_constraint WHERE conname = 'notification_outbox_type_check';

-- 3. Check trigger function is reverted:
-- SELECT prosrc FROM pg_proc WHERE proname = 'tg_notify_booking_update';

-- =====================================================
-- END OF ROLLBACK SCRIPT
-- =====================================================