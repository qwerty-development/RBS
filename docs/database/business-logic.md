# Business Logic Reference

## Booking System

### Booking Policies

#### Instant Booking
- **Policy**: `restaurant.booking_policy = 'instant'`
- **Behavior**: Immediate confirmation upon table availability
- **Status Flow**: `pending` → `confirmed` (automatic)
- **Time Limits**: No approval required
- **Loyalty Points**: Awarded immediately upon confirmation

#### Request Booking
- **Policy**: `restaurant.booking_policy = 'request'`
- **Behavior**: Restaurant approval required
- **Status Flow**: `pending` → `confirmed`/`declined_by_restaurant`
- **Time Limits**: 2-hour response window (auto-decline after)
- **Loyalty Points**: Awarded only after confirmation

### Booking Status Lifecycle

```
pending → confirmed → completed
    ↓         ↓           ↑
    ↓    cancelled_by_user ↓
    ↓         ↓           ↓
declined_by_restaurant  no_show
```

#### Status Transitions
- **pending**: Initial state for all bookings
- **confirmed**: Restaurant approved (instant or manual)
- **completed**: Auto-set 2 hours after booking end time
- **no_show**: Auto-set 30 minutes after booking time if not checked in
- **cancelled_by_user**: User cancellation
- **declined_by_restaurant**: Restaurant rejection

### Table Management

#### Table Assignment Logic
1. **Single Table Priority**: Find closest capacity match
2. **Combination Fallback**: Combine compatible tables if needed
3. **Priority Scoring**: Lower score = higher priority
4. **Capacity Constraints**: Respect min/max capacity limits

#### Table Combination Rules
- Both tables must have `is_combinable = true`
- Combined capacity must accommodate party size
- No excessive over-capacity (max +4 guests over party size)
- Tables must be available for entire booking duration

#### Turn Time Calculation
```sql
CASE
  WHEN party_size <= 2 THEN 90 minutes
  WHEN party_size <= 4 THEN 120 minutes
  WHEN party_size <= 6 THEN 150 minutes
  ELSE 180 minutes
END
```

### Booking Windows

#### Standard Users
- **Default**: 30 days ahead
- **Configurable**: Per restaurant (`booking_window_days`)
- **Minimum**: 15 minutes in advance

#### VIP Users
- **Extended Window**: 60 days (configurable per VIP)
- **Priority Booking**: Access before general users
- **Special Privileges**: Early access to premium time slots

## Loyalty System

### Restaurant Loyalty Model

#### Point Economy
- **Restaurant Funded**: Restaurants purchase loyalty points
- **User Earned**: Users earn points from completed bookings
- **Rule Based**: Flexible earning criteria

#### Balance Management
```sql
-- Restaurant purchases points
INSERT INTO restaurant_loyalty_balance (restaurant_id, total_purchased, current_balance)

-- Points awarded to user
UPDATE restaurant_loyalty_balance SET current_balance = current_balance - points_awarded
UPDATE profiles SET loyalty_points = loyalty_points + points_awarded
```

#### Rule Evaluation
Rules are evaluated based on:
- **Time**: Applicable days of week, time ranges
- **Party Size**: Minimum/maximum party size
- **Usage Limits**: Per-rule total and per-user limits
- **Priority**: Higher priority rules evaluated first
- **Balance**: Restaurant must have sufficient points

### User Tier System

#### Tier Calculation
```sql
CASE
  WHEN points >= 3000 THEN 'platinum'
  WHEN points >= 1500 THEN 'gold'
  WHEN points >= 500 THEN 'silver'
  ELSE 'bronze'
END
```

#### Tier Benefits
- **Bronze**: Base earning rate (1.0x multiplier)
- **Silver**: 10% bonus (1.1x multiplier)
- **Gold**: 20% bonus (1.2x multiplier)
- **Platinum**: 50% bonus (1.5x multiplier)

### Point Lifecycle

#### Earning Process
1. **Booking Creation**: Rule validation, balance check
2. **Booking Confirmation**: Points reserved (for request bookings)
3. **Booking Completion**: Points awarded to user
4. **Balance Deduction**: Restaurant balance reduced

#### Refund Process
1. **Cancellation Detection**: Status change to cancelled
2. **Point Refund**: User points deducted
3. **Balance Restoration**: Restaurant balance increased
4. **Usage Reset**: Rule usage counters decremented

## User Rating System

### Rating Calculation
```sql
base_rating := 5.0
completion_bonus := (completion_rate - 0.7) * 1.0  -- if > 70%
cancellation_penalty := cancellation_rate * 1.5
no_show_penalty := no_show_rate * 2.5
recent_behavior_weight := calculated from last 10 bookings

final_rating := GREATEST(1.0, LEAST(5.0, 
  base_rating + completion_bonus - cancellation_penalty - no_show_penalty + recent_behavior_weight
))
```

### Rating Categories
- **5.0**: Perfect record
- **4.5-4.9**: Excellent reliability
- **4.0-4.4**: Very reliable
- **3.5-3.9**: Good reliability
- **3.0-3.4**: Fair reliability
- **1.0-2.9**: Needs improvement

### Behavioral Impact
- **Recent Behavior**: Last 10 bookings weighted more heavily
- **Completion Rate**: Rewards consistent completion
- **Cancellation Pattern**: Penalizes frequent cancellations
- **No-Show Impact**: Heaviest penalty for no-shows

## Customer Management

### Customer Record Creation
- **Automatic**: Created on first booking
- **Unified**: Handles both registered users and guests
- **Deduplication**: Prevents duplicate records via email/user_id

### Customer Statistics
- **Total Bookings**: Confirmed and completed only
- **Visit Tracking**: First and last visit dates
- **Behavior Metrics**: No-shows, cancellations, average party size
- **Spending Patterns**: Total spent (if integrated with POS)

### VIP Management
- **Automatic Promotion**: Based on booking frequency/value
- **Manual Assignment**: Restaurant staff designation
- **Benefits**: Extended booking window, priority access
- **Blacklisting**: For problematic customers

## Availability System

### Real-time Availability
- **Cache Strategy**: Materialized views for performance
- **Conflict Detection**: Checks overlapping bookings
- **Instant Updates**: Triggers refresh availability cache
- **Capacity Management**: Tracks table utilization

### Availability Factors
1. **Table Status**: Active, inactive, maintenance
2. **Existing Bookings**: Confirmed and pending (for request restaurants)
3. **Operating Hours**: Restaurant opening/closing times
4. **Special Events**: Holiday closures, private events
5. **Maintenance Windows**: Scheduled downtime

### Waitlist Management
- **Automatic Notification**: When tables become available
- **Time Window Matching**: Flexible time slot preferences
- **Priority Queue**: First-come, first-served basis
- **Conversion Tracking**: Waitlist to booking success rate

## Review System

### Review Aggregation
```sql
-- Overall rating
average_rating = AVG(rating)

-- Detailed breakdowns
food_avg = AVG(food_rating)
service_avg = AVG(service_rating)
ambiance_avg = AVG(ambiance_rating)
value_avg = AVG(value_rating)

-- Recommendation percentage
recommendation_percentage = (COUNT(recommend_to_friend = true) / COUNT(*)) * 100
```

### Review Validation
- **Booking Requirement**: Must have completed booking
- **One Review**: Per booking (enforced by unique constraint)
- **Time Window**: Reviews allowed within reasonable timeframe
- **Content Moderation**: Automated and manual review processes

## Offer System

### Offer Types
- **Percentage Discount**: `discount_percentage` field
- **Fixed Amount**: Could be added with `discount_amount` field
- **Special Menu**: Linked to specific menu items
- **Experience Offers**: Bundled services

### Offer Lifecycle
1. **Creation**: Restaurant creates offer
2. **User Claim**: User claims offer (creates `user_offers` record)
3. **Redemption**: User applies offer to booking
4. **Expiration**: Automatic expiry based on time limits

### Redemption Logic
- **Single Use**: Each offer can only be redeemed once
- **Time Limits**: 30 days from claim or offer expiry (whichever is sooner)
- **Booking Integration**: Applied during booking confirmation
- **Discount Calculation**: Applied to final bill amount

## Notification System

### Notification Types
- **Booking Reminders**: 24h and 2h before booking
- **Status Updates**: Confirmation, cancellation, completion
- **Social**: Friend requests, playlist shares
- **Loyalty**: Point earnings, tier upgrades
- **Marketing**: Special offers, new restaurant features

### Delivery Channels
- **Push Notifications**: Real-time mobile alerts
- **Email**: Detailed notifications with links
- **In-App**: Notification center within app
- **SMS**: Critical notifications only (opt-in)

## Data Archival

### Archival Strategy
- **Retention Period**: 90 days for active bookings
- **Archive Tables**: Separate tables for historical data
- **Performance**: Keeps main tables lean for better performance
- **Compliance**: Supports data retention policies

### Archived Data Access
- **Reporting**: Historical analytics and trends
- **Dispute Resolution**: Access to past booking records
- **Audit Requirements**: Regulatory compliance
- **Customer History**: Long-term relationship tracking

## Security Model

### Row Level Security (RLS)
- **User Data**: Users can only access their own records
- **Restaurant Data**: Staff can only access their restaurant's data
- **Admin Access**: Full access for system administrators
- **Guest Access**: Limited read access for public information

### Data Privacy
- **Personal Information**: Encrypted storage of sensitive data
- **Anonymization**: Guest data anonymized after retention period
- **Consent Management**: Tracking user privacy preferences
- **GDPR Compliance**: Right to erasure and data portability
