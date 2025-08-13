# Notification System Testing Guide

This guide provides comprehensive testing scenarios for the Expo notifications system implemented in the Booklet app.

## Prerequisites

1. **Physical Device Required**: Notifications only work on physical devices, not simulators/emulators
2. **Permissions**: Ensure notification permissions are granted
3. **Network**: Active internet connection for push notifications
4. **Authentication**: User must be logged in (not guest mode)

## Testing Scenarios

### 1. Initialization Testing

#### Test 1.1: App Launch with Notifications
- **Steps**:
  1. Fresh install the app
  2. Sign up/login with a new account
  3. Grant notification permissions when prompted
- **Expected Result**:
  - Permission dialog appears
  - Push token is registered
  - No errors in console

#### Test 1.2: Permission Denied Scenario
- **Steps**:
  1. Deny notification permissions
  2. Navigate to notifications screen
  3. Try to enable notifications from settings
- **Expected Result**:
  - App handles gracefully
  - User can manually enable in device settings

### 2. Notification Types Testing

#### Test 2.1: Booking Notifications
```typescript
// Test booking confirmation
await NotificationHelpers.createBookingNotification({
  bookingId: 'test-booking-123',
  restaurantId: 'test-restaurant-456',
  restaurantName: 'Test Restaurant',
  date: '2024-01-15',
  time: '7:00 PM',
  partySize: 4,
  action: 'confirmed',
  priority: 'high',
});
```

- **Expected Result**:
  - Notification appears in notification center
  - Shows in app notifications screen
  - Tapping navigates to booking details

#### Test 2.2: Waitlist Notifications
```typescript
// Test waitlist available
await NotificationHelpers.createWaitlistNotification({
  entryId: 'test-entry-123',
  restaurantId: 'test-restaurant-456',
  restaurantName: 'Test Restaurant',
  requestedDate: '2024-01-15',
  timeSlotStart: '7:00 PM',
  timeSlotEnd: '8:00 PM',
  partySize: 2,
  action: 'available',
  priority: 'high',
});
```

- **Expected Result**:
  - High priority notification
  - Tapping navigates to restaurant page

#### Test 2.3: Offer Notifications
```typescript
// Test new offer
await NotificationHelpers.createOfferNotification({
  offerId: 'test-offer-123',
  restaurantId: 'test-restaurant-456',
  restaurantName: 'Test Restaurant',
  offerTitle: '20% Off Dinner',
  offerDescription: 'Get 20% off your dinner',
  action: 'new_offer',
  discountPercentage: 20,
});
```

#### Test 2.4: Loyalty Notifications
```typescript
// Test points earned
await NotificationHelpers.createLoyaltyNotification({
  restaurantId: 'test-restaurant-456',
  restaurantName: 'Test Restaurant',
  points: 100,
  action: 'points_earned',
});
```

#### Test 2.5: Review Reminders
```typescript
// Test review reminder
await NotificationHelpers.createReviewNotification({
  restaurantId: 'test-restaurant-456',
  restaurantName: 'Test Restaurant',
  visitDate: '2024-01-10',
  action: 'reminder',
  scheduledFor: new Date(Date.now() + 5000), // 5 seconds from now
});
```

### 3. App State Testing

#### Test 3.1: Foreground Notifications
- **Steps**:
  1. Keep app open and active
  2. Trigger a notification
- **Expected Result**:
  - Notification appears in app
  - Added to notifications list
  - No system notification shown

#### Test 3.2: Background Notifications
- **Steps**:
  1. Put app in background
  2. Trigger a notification
  3. Check notification center
- **Expected Result**:
  - System notification appears
  - Tapping opens app to correct screen

#### Test 3.3: App Closed Notifications
- **Steps**:
  1. Force close the app
  2. Send push notification from server
  3. Tap notification
- **Expected Result**:
  - App launches
  - Navigates to appropriate screen

### 4. Navigation Testing

#### Test 4.1: Notification Tap Navigation
- **Test each notification type**:
  - Booking → `/booking/[id]` or `/bookings`
  - Waitlist → `/restaurant/[id]` or `/my-waitlists`
  - Offer → `/restaurant/[id]` or `/offers`
  - Review → `/restaurant/[id]`
  - Loyalty → `/profile/loyalty`
  - System → `/profile/notifications`

#### Test 4.2: Deep Link Handling
- **Steps**:
  1. App is closed
  2. Tap notification with specific data
  3. Verify correct screen opens with data

### 5. Notification Management Testing

#### Test 5.1: Mark as Read
- **Steps**:
  1. Receive notifications
  2. Tap individual notifications
  3. Use "Mark All Read" button
- **Expected Result**:
  - Read status updates correctly
  - Unread count decreases

#### Test 5.2: Notification Persistence
- **Steps**:
  1. Receive notifications
  2. Close and reopen app
- **Expected Result**:
  - Notifications persist
  - Read/unread status maintained

#### Test 5.3: Notification Limits
- **Steps**:
  1. Generate 105+ notifications
- **Expected Result**:
  - Only 100 most recent kept
  - Older notifications removed

### 6. Scheduled Notifications Testing

#### Test 6.1: Booking Reminders
```typescript
// Schedule reminder for 1 minute from now
const reminderTime = new Date(Date.now() + 60000);
await NotificationHelpers.scheduleBookingReminder({
  restaurantName: 'Test Restaurant',
  date: '2024-01-15',
  time: '7:00 PM',
  bookingId: 'test-booking-123',
}, reminderTime);
```

#### Test 6.2: Review Reminders
```typescript
// Schedule review reminder for 2 days after dining
const reminderTime = new Date(Date.now() + (2 * 24 * 60 * 60 * 1000));
await NotificationHelpers.scheduleReviewReminder({
  restaurantId: 'test-restaurant-456',
  restaurantName: 'Test Restaurant',
  visitDate: '2024-01-10',
  action: 'reminder',
}, reminderTime);
```

### 7. Error Handling Testing

#### Test 7.1: Network Errors
- **Steps**:
  1. Disable internet
  2. Try to register push token
- **Expected Result**:
  - Graceful error handling
  - Retry when network restored

#### Test 7.2: Invalid Data
- **Steps**:
  1. Send notification with missing required fields
- **Expected Result**:
  - Error logged
  - App doesn't crash

### 8. Performance Testing

#### Test 8.1: Multiple Notifications
- **Steps**:
  1. Send 20+ notifications rapidly
- **Expected Result**:
  - App remains responsive
  - All notifications processed

#### Test 8.2: Large Notification Data
- **Steps**:
  1. Send notification with large data payload
- **Expected Result**:
  - Handles gracefully
  - No memory issues

## Manual Testing Commands

Add these to your test file or run in development:

```typescript
// Test all notification types
export const testAllNotifications = async () => {
  // Booking
  await NotificationHelpers.createBookingNotification({
    bookingId: 'test-1',
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    date: '2024-01-15',
    time: '7:00 PM',
    partySize: 4,
    action: 'confirmed',
  });

  // Waitlist
  await NotificationHelpers.createWaitlistNotification({
    entryId: 'entry-1',
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    requestedDate: '2024-01-15',
    timeSlotStart: '7:00 PM',
    timeSlotEnd: '8:00 PM',
    partySize: 2,
    action: 'available',
  });

  // Offer
  await NotificationHelpers.createOfferNotification({
    offerId: 'offer-1',
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    offerTitle: '20% Off',
    offerDescription: 'Limited time offer',
    action: 'new_offer',
  });

  // Loyalty
  await NotificationHelpers.createLoyaltyNotification({
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    points: 100,
    action: 'points_earned',
  });

  // System
  await NotificationHelpers.createSystemNotification({
    title: 'App Update',
    message: 'New features available!',
    category: 'app_update',
  });
};
```

## Verification Checklist

- [ ] Notifications appear in system notification center
- [ ] Notifications appear in app notifications screen
- [ ] Tapping notifications navigates correctly
- [ ] Read/unread status works
- [ ] Scheduled notifications fire at correct time
- [ ] Push tokens are registered with backend
- [ ] Permissions are handled correctly
- [ ] App doesn't crash with invalid data
- [ ] Performance is acceptable with many notifications
- [ ] Notifications persist across app restarts

## Troubleshooting

### Common Issues:
1. **No notifications on simulator**: Use physical device
2. **Permissions denied**: Check device settings
3. **Token registration fails**: Check network and Supabase connection
4. **Navigation not working**: Verify route definitions
5. **Scheduled notifications not firing**: Check device settings for background app refresh

### Debug Commands:
```typescript
// Check notification service status
const service = NotificationService.getInstance();
console.log('Initialized:', service.isServiceInitialized());
console.log('Push Token:', service.getPushToken());

// Check store state
const { notifications, getUnreadCount } = useAppStore.getState();
console.log('Notifications:', notifications.length);
console.log('Unread:', getUnreadCount());
```
