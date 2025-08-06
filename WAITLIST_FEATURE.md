# Waitlist Feature Implementation

## Overview
The waitlist feature allows users to join a waitlist when no tables are available for their desired time range. When a table becomes available, users will be notified and given the opportunity to book.

## Components Added

### 1. `WaitlistConfirmationModal.tsx`
- **Purpose**: Displays a confirmation modal where users can review and edit their waitlist request details
- **Features**:
  - Shows current search parameters (date, time range, restaurant)
  - Allows editing of party size and special requests
  - Displays how the waitlist works
  - Validates input before submission

### 2. `useWaitlist.ts` Hook
- **Purpose**: Handles all waitlist-related database operations
- **Functions**:
  - `joinWaitlist(entry: WaitlistEntry)`: Adds user to waitlist
  - `getUserWaitlistEntries(userId?: string)`: Retrieves user's waitlist entries
  - `removeFromWaitlist(waitlistId: string)`: Removes entry from waitlist
  - `updateWaitlistStatus(waitlistId: string, status)`: Updates waitlist entry status

### 3. Enhanced `TimeRangeSelector.tsx`
- **New Features**:
  - "Join Waitlist" button appears when no tables are available
  - Only shows for authenticated users
  - Opens the waitlist confirmation modal
  - Integrated with the existing search flow

## Database Schema
The waitlist feature uses the existing `waitlist` table with the following structure:
```sql
- id: uuid (primary key)
- user_id: uuid (foreign key to profiles)
- restaurant_id: uuid (foreign key to restaurants)
- desired_date: date
- desired_time_range: tstzrange (PostgreSQL time range)
- party_size: integer
- status: enum ('active', 'notified', 'booked', 'expired')
- created_at: timestamp
```

## User Flow

1. **Search for Tables**: User performs a time range search
2. **No Results**: If no tables are available, "Join Waitlist" button appears
3. **Authentication Check**: System verifies user is signed in
4. **Confirmation Modal**: User reviews and can edit their request details:
   - Party size (editable)
   - Special requests (editable)
   - Date, time, restaurant (display only)
5. **Submit**: User confirms and joins the waitlist
6. **Success**: User receives confirmation and modal closes

## Technical Details

### Type Definitions
```typescript
export interface WaitlistEntry {
  restaurantId: string;
  userId: string;
  desiredDate: string; // YYYY-MM-DD format
  desiredTimeRange: string; // PostgreSQL tstzrange format: [HH:mm,HH:mm)
  partySize: number;
  tableTypes?: string[]; // Optional table type preferences
  specialRequests?: string; // Optional special requests
}
```

### Integration Points
- **TimeRangeSelector**: Shows waitlist button when no results found
- **Auth System**: Uses `useAuthStore` to check user authentication
- **Supabase**: Direct integration with database using `supabase` client
- **UI Components**: Uses existing design system components

## Error Handling
- Authentication required errors
- Database operation errors
- Validation errors (party size, etc.)
- Network errors with proper user feedback

## Future Enhancements
- Real-time notifications when tables become available
- Waitlist position tracking
- Automatic removal of expired entries
- Restaurant dashboard for managing waitlists
- Push notifications integration

## Usage Example
```tsx
// In availability.tsx, pass restaurantId prop
<TimeRangeSelector
  // ... other props
  restaurantId={params.restaurantId || ''}
/>
```

The feature is fully integrated and ready for testing. Users will see the waitlist option automatically when performing time range searches that return no results.
