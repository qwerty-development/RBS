# Complete Notification System Integration Guide

## Overview

The Booklet app now has a fully integrated notification system that automatically sends push notifications for all major user interactions. This guide covers the complete implementation including client-side integration, server-side Edge Functions, database triggers, and user preferences.

## 🎯 What's Implemented

### ✅ Client-Side Integration
- **Booking System**: Notifications for confirmations, cancellations, reminders
- **Waitlist System**: Notifications for table availability, position updates, expiration
- **Review System**: Notifications for review reminders, restaurant responses
- **Loyalty System**: Notifications for points earned, milestones, rewards
- **Offer System**: Notifications for special offers, expiring deals

### ✅ Server-Side Infrastructure
- **Supabase Edge Functions**: For sending push notifications via Expo Push API
- **Database Triggers**: Automatic notifications on data changes
- **Notification Preferences**: User-controlled notification settings
- **Notification Logging**: Complete audit trail of sent notifications

### ✅ User Experience
- **Notification Preferences Screen**: Full control over notification types
- **Quiet Hours**: Disable notifications during specified times
- **Real-time Updates**: Notifications appear instantly in the app
- **Smart Navigation**: Tapping notifications opens relevant screens

## 🚀 How It Works

### 1. Client-Side Flow

When a user performs an action (e.g., makes a booking):

```typescript
// In useBookingConfirmation.ts
await NotificationHelpers.createBookingNotification({
  bookingId: bookingResult.booking.id,
  restaurantId: restaurantId,
  restaurantName: restaurant.name,
  date: bookingDate,
  time: bookingTimeStr,
  partySize: partySize,
  action: 'confirmed',
  priority: 'high',
});
```

This:
1. Adds notification to local store (immediate UI update)
2. Sends push notification via NotificationService
3. Schedules any follow-up notifications (e.g., reminders)

### 2. Server-Side Flow

Database triggers automatically send notifications when data changes:

```sql
-- When booking status changes
CREATE TRIGGER booking_status_notification_trigger
    AFTER UPDATE ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION notify_booking_status_change();
```

This:
1. Detects status changes in the database
2. Checks user notification preferences
3. Calls Edge Function to send push notification
4. Logs the notification attempt

### 3. Edge Functions

Two main Edge Functions handle push notifications:

- **`send-push-notification`**: Single user notifications
- **`send-batch-notifications`**: Multiple user notifications

```typescript
// Example Edge Function call
POST /functions/v1/send-push-notification
{
  "userId": "user-uuid",
  "title": "Booking Confirmed",
  "body": "Your table is confirmed for tonight at 7:00 PM",
  "data": {
    "type": "booking",
    "bookingId": "booking-uuid"
  },
  "priority": "high"
}
```

## 📱 Notification Types

### Booking Notifications
- **Confirmation**: When booking is confirmed
- **Cancellation**: When booking is cancelled
- **Reminder**: 2 hours before reservation
- **Modification**: When booking details change
- **Declined**: When restaurant declines request

### Waitlist Notifications
- **Available**: When table becomes available
- **Position Update**: When position in queue changes
- **Expired**: When waitlist entry expires
- **Joined**: When added to waitlist
- **Removed**: When removed from waitlist

### Offer Notifications
- **New Offer**: When special promotion is available
- **Expiring Soon**: When offer is about to expire
- **Expired**: When offer has expired
- **Redeemed**: When offer is successfully used

### Review Notifications
- **Reminder**: To write review after dining (24h later)
- **Response**: When restaurant responds to review
- **Featured**: When review is featured
- **Helpful**: When review receives likes

### Loyalty Notifications
- **Points Earned**: When points are awarded
- **Points Redeemed**: When points are used
- **Milestone**: When loyalty level increases
- **Reward Available**: When new reward unlocked
- **Reward Expiring**: When reward about to expire

### System Notifications
- **App Updates**: New features available
- **Maintenance**: Scheduled maintenance notices
- **Security**: Important security updates

## ⚙️ Configuration

### 1. Database Setup

Run the migration files to set up the notification system:

```bash
# Create push tokens table
psql -f db/migrations/add_push_tokens_table.sql

# Create notification triggers
psql -f db/migrations/add_notification_triggers.sql

# Create notification preferences
psql -f db/migrations/add_notification_preferences.sql
```

### 2. Environment Variables

Set these in your Supabase project:

```bash
# In Supabase Dashboard > Settings > API
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For Edge Functions
app.supabase_url=your-supabase-url
app.service_role_key=your-service-role-key
```

### 3. Deploy Edge Functions

```bash
# Deploy notification functions
supabase functions deploy send-push-notification
supabase functions deploy send-batch-notifications
```

## 🎛️ User Preferences

Users can control their notification preferences through the settings screen:

```typescript
// Access notification preferences
const {
  preferences,
  updatePreference,
  toggleAllNotifications,
} = useNotificationPreferences();

// Update a specific preference
await updatePreference('booking_confirmations', false);

// Disable all notifications
await toggleAllNotifications(false);
```

### Preference Categories

- **Booking**: Confirmations, reminders, cancellations
- **Waitlist**: Available tables, position updates, expiration
- **Offers**: Special offers, loyalty offers, expiring offers
- **Reviews**: Reminders, responses, featured reviews
- **Loyalty**: Points earned, milestones, rewards
- **System**: App updates, maintenance, security alerts

### Advanced Settings

- **Quiet Hours**: Disable notifications during specified times
- **Platform Filtering**: iOS/Android specific preferences
- **Priority Levels**: High priority notifications bypass quiet hours

## 🧪 Testing

### Manual Testing

Use the test script to verify all notification types:

```bash
npx tsx scripts/test-notification-integration.ts
```

### Testing on Device

1. **Install on physical device** (notifications don't work on simulators)
2. **Grant notification permissions** when prompted
3. **Test each notification type** using the app features
4. **Verify navigation** by tapping notifications
5. **Check preferences** in notification settings

### Testing Server-Side

1. **Test Edge Functions** directly via Supabase dashboard
2. **Verify database triggers** by updating records manually
3. **Check notification logs** for delivery status
4. **Test preference filtering** with different user settings

## 🔧 Troubleshooting

### Common Issues

1. **No notifications on simulator**: Use physical device
2. **Permissions denied**: Check device notification settings
3. **Token registration fails**: Verify network and Supabase connection
4. **Navigation not working**: Check route definitions
5. **Preferences not saving**: Verify RLS policies

### Debug Tools

```typescript
// Check notification service status
const service = NotificationService.getInstance();
console.log('Initialized:', service.isServiceInitialized());
console.log('Push Token:', service.getPushToken());

// Check store state
const { notifications, getUnreadCount } = useAppStore.getState();
console.log('Notifications:', notifications.length);
console.log('Unread:', getUnreadCount());

// Check preferences
const { preferences } = useNotificationPreferences();
console.log('Preferences:', preferences);
```

## 📊 Analytics & Monitoring

### Notification Logs

All notifications are logged in the `notification_logs` table:

```sql
SELECT 
  title,
  body,
  tokens_sent,
  success_count,
  error_count,
  created_at
FROM notification_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Performance Metrics

- **Delivery Rate**: `success_count / tokens_sent`
- **Error Rate**: `error_count / tokens_sent`
- **User Engagement**: Notification tap rates
- **Preference Adoption**: Users with custom preferences

## 🔮 Future Enhancements

### Planned Features

1. **Rich Notifications**: Images and action buttons
2. **Notification Categories**: Better organization
3. **Custom Sounds**: Per notification type
4. **A/B Testing**: Optimize notification content
5. **Analytics Dashboard**: Real-time metrics
6. **Smart Scheduling**: ML-based optimal timing

### Integration Opportunities

1. **Calendar Integration**: Add bookings to calendar
2. **Location-Based**: Notifications when near restaurant
3. **Social Features**: Friend activity notifications
4. **Personalization**: AI-powered content optimization

## 📞 Support

For issues or questions about the notification system:

1. Check the troubleshooting section above
2. Review the test results from the integration script
3. Verify all migration files have been run
4. Check Supabase Edge Function logs
5. Ensure proper environment variables are set

The notification system is designed to be robust and user-friendly, providing a seamless experience for all Booklet users while giving them full control over their notification preferences.
