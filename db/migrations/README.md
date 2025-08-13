# Database Migrations for Notification System

This directory contains all the database migrations needed to set up the complete notification system for the Booklet app.

## Migration Order

**IMPORTANT**: Run these migrations in the exact order listed below to avoid dependency issues.

### 1. Push Tokens Table
```bash
psql -d your_database -f add_push_tokens_table.sql
```

Creates the `user_push_tokens` table to store Expo push notification tokens for users.

### 2. Notification Triggers
```bash
psql -d your_database -f add_notification_triggers.sql
```

Creates:
- `notification_logs` table for tracking sent notifications
- `send_push_notification()` function (basic version)
- Database triggers for automatic notifications
- Trigger functions for booking, waitlist, and loyalty notifications

### 3. Notification Preferences
```bash
psql -d your_database -f add_notification_preferences.sql
```

Creates:
- `notification_preferences` table for user preferences
- Enhanced `send_push_notification()` function with preference checking
- `should_send_notification()` function for preference validation
- Updated trigger functions to use notification types

## What Each Migration Does

### add_push_tokens_table.sql
- Creates `user_push_tokens` table
- Sets up RLS policies
- Creates indexes for performance
- Adds proper constraints and triggers

### add_notification_triggers.sql
- Creates `notification_logs` table
- Creates basic `send_push_notification()` function
- Creates trigger functions for:
  - Booking status changes
  - Waitlist status changes  
  - Loyalty points changes
- Sets up database triggers

### add_notification_preferences.sql
- Creates `notification_preferences` table
- Creates preference management functions
- Updates `send_push_notification()` to check preferences
- Updates trigger functions to use notification types
- Adds quiet hours and preference filtering

## Required Extensions

Make sure these PostgreSQL extensions are enabled:

```sql
-- For HTTP requests to Edge Functions (optional but recommended)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- For UUID generation (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Environment Variables

After running migrations, set these in your Supabase project settings:

```bash
# In Supabase Dashboard > Settings > API
app.supabase_url=your-supabase-url
app.service_role_key=your-service-role-key
```

## Verification

After running all migrations, verify the setup:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_push_tokens', 'notification_logs', 'notification_preferences');

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('send_push_notification', 'should_send_notification');

-- Check triggers exist
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name LIKE '%notification%';
```

## Rollback

If you need to rollback the migrations:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS booking_status_notification_trigger ON bookings;
DROP TRIGGER IF EXISTS waitlist_status_notification_trigger ON waitlist;
DROP TRIGGER IF EXISTS loyalty_points_notification_trigger ON profiles;

-- Drop functions
DROP FUNCTION IF EXISTS send_push_notification;
DROP FUNCTION IF EXISTS should_send_notification;
DROP FUNCTION IF EXISTS get_user_notification_preferences;
DROP FUNCTION IF EXISTS notify_booking_status_change;
DROP FUNCTION IF EXISTS notify_waitlist_status_change;
DROP FUNCTION IF EXISTS notify_loyalty_points_change;

-- Drop tables (be careful - this will delete all data)
DROP TABLE IF EXISTS notification_preferences;
DROP TABLE IF EXISTS notification_logs;
DROP TABLE IF EXISTS user_push_tokens;
```

## Troubleshooting

### Common Issues

1. **Permission denied**: Make sure you're running as a superuser or have the necessary privileges
2. **Function already exists**: The migrations use `CREATE OR REPLACE` so this shouldn't happen
3. **Table already exists**: Use `CREATE TABLE IF NOT EXISTS` - check the migration files
4. **Extension not found**: Install required extensions first

### Debug Queries

```sql
-- Check notification logs
SELECT * FROM notification_logs ORDER BY created_at DESC LIMIT 10;

-- Check user preferences
SELECT * FROM notification_preferences WHERE user_id = 'your-user-id';

-- Check push tokens
SELECT * FROM user_push_tokens WHERE is_active = true;

-- Test notification function
SELECT send_push_notification(
    'user-id'::uuid,
    'Test Title',
    'Test Body',
    '{"test": true}'::jsonb,
    'default',
    'general'
);
```

## Next Steps

After running migrations:

1. Deploy the Edge Functions (`send-push-notification`, `send-batch-notifications`)
2. Test the notification system with the integration script
3. Configure your app to use the notification system
4. Set up monitoring and analytics

For detailed implementation guide, see `docs/complete-notification-system-guide.md`.
