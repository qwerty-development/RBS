# Complete Notifications System Implementation

## Overview
This document contains the complete implementation of a server-driven notifications system for the RBS (Restaurant Booking System) app. The system supports push notifications, in-app notifications, and real-time badge updates.

## Architecture

### Components
1. **Database Layer**: Tables, triggers, functions for notification management
2. **Edge Functions**: Delivery pipeline for push notifications
3. **Client App**: Push registration, notification center, real-time badges
4. **Scheduling**: Automated cron jobs for reminders and delivery

### Flow
```
Trigger Event → Database Trigger → enqueue_notification() → notification_outbox → 
Edge Function (notify) → Expo Push API → Device → In-app notification center
```

## Database Schema

### Core Tables
- `user_devices`: Device registry with Expo push tokens
- `notifications`: Enhanced with category, deeplink, read_at
- `notification_outbox`: Queue for delivery across channels (push, email, SMS, in-app)
- `notification_delivery_logs`: Per-attempt delivery tracking
- `notification_preferences`: User preferences per category

### Notification Categories
- `booking`: Confirmations, cancellations, modifications, reminders
- `waitlist`: Available tables, expiry, conversions
- `offers`: New offers, expiry warnings, redemptions
- `reviews`: Restaurant responses, review reminders
- `loyalty`: Points earned, tier changes
- `system`: Test notifications, announcements

## Key Functions

### enqueue_notification()
Central function that:
- Checks user preferences
- Creates notification record
- Queues delivery in outbox for selected channels
- Respects user notification settings

### Trigger Functions
- `tg_notify_booking_update()`: Booking status changes and modifications
- `tg_notify_waitlist_update()`: Waitlist status changes
- `tg_notify_user_offers()`: Offer assignments and redemptions
- `tg_notify_review_response()`: Restaurant review replies
- `tg_notify_loyalty_activity()`: Loyalty point activities

### Scheduled Functions
- `enqueue_booking_reminders()`: 24h, 2h, 1h booking reminders
- `enqueue_review_reminders()`: Post-visit review prompts
- `enqueue_offer_expiry_notices()`: Offer expiry warnings

## Edge Functions

### notify (supabase/functions/notify/index.ts)
- Drains notification_outbox
- Sends push notifications via Expo Push API
- Logs delivery results
- Handles in-app, email, SMS channels (email/SMS currently skipped)

### schedule-reminders (supabase/functions/schedule-reminders/index.ts)
- Calls booking, review, and offer reminder functions
- Runs on cron schedule (every 5 minutes recommended)

## Client Implementation

### Push Setup (lib/notifications/setup.ts)
- `ensurePushPermissionsAndToken()`: Request permissions and get token
- `registerDeviceForPush()`: Store device info in user_devices table
- `initializeNotificationHandlers()`: Handle foreground notifications and deep-links

### Notification Center (app/(protected)/profile/notifications.tsx)
- Fetches from notifications table
- Real-time updates via Supabase subscriptions
- Mark as read functionality
- Deep-link navigation
- Test notification buttons

### Real-time Badge (hooks/useNotificationsBadge.ts)
- Tracks unread count from database
- Subscribes to real-time changes
- Updates tab badge immediately

## Installation & Setup

See the complete setup instructions in the next file.
