# Database Triggers Reference

## Booking Management Triggers

### generate_booking_confirmation
**Table**: `public.bookings`  
**Event**: `BEFORE INSERT`  
**Function**: `generate_confirmation_code()`  
**Purpose**: Automatically generates unique confirmation codes for new bookings.

### trigger_update_user_rating
**Table**: `public.bookings`  
**Event**: `AFTER UPDATE`  
**Function**: `trigger_update_user_rating()`  
**Purpose**: Updates user reliability rating when booking status changes.

### booking_status_change_trigger
**Table**: `public.bookings`  
**Event**: `AFTER UPDATE OF status`  
**Function**: `handle_booking_status_change()`  
**Purpose**: Handles loyalty point awards/refunds when booking status changes.

### validate_loyalty_balance_trigger
**Table**: `public.bookings`  
**Event**: `BEFORE INSERT`  
**Function**: `validate_restaurant_loyalty_balance()`  
**Purpose**: Validates restaurant has sufficient loyalty points before booking creation.

### booking_cancelled_notify_waitlist
**Table**: `public.bookings`  
**Event**: `AFTER UPDATE`  
**Function**: `notify_waiting_list()`  
**Purpose**: Notifies waiting list users when bookings are cancelled.

### trigger_manage_restaurant_customers
**Table**: `public.bookings`  
**Event**: `AFTER INSERT OR UPDATE`  
**Function**: `manage_restaurant_customers()`  
**Purpose**: Automatically creates/updates customer records from bookings.

## Availability Management Triggers

### refresh_availability_on_booking
**Table**: `public.bookings`  
**Event**: `AFTER INSERT OR DELETE OR UPDATE`  
**Function**: `trigger_refresh_availability()`  
**Purpose**: Refreshes availability cache when bookings change.

### refresh_availability_on_booking_tables
**Table**: `public.booking_tables`  
**Event**: `AFTER INSERT OR DELETE OR UPDATE`  
**Function**: `trigger_refresh_availability()`  
**Purpose**: Refreshes availability cache when table assignments change.

## Review and Rating Triggers

### update_restaurant_rating_trigger
**Table**: `public.reviews`  
**Event**: `AFTER INSERT OR UPDATE`  
**Function**: `update_restaurant_rating()`  
**Purpose**: Updates restaurant average rating when reviews are added/modified.

### trigger_update_restaurant_review_summary
**Table**: `public.reviews`  
**Event**: `AFTER INSERT OR DELETE OR UPDATE`  
**Function**: `update_restaurant_review_summary()`  
**Purpose**: Updates comprehensive review summary with detailed breakdowns.

## Loyalty System Triggers

### loyalty_transaction_audit_trigger
**Table**: `public.restaurant_loyalty_transactions`  
**Event**: `AFTER INSERT`  
**Function**: `log_loyalty_transaction()`  
**Purpose**: Creates audit log entries for all loyalty transactions.

### update_restaurant_loyalty_balance_timestamp
**Table**: `public.restaurant_loyalty_balance`  
**Event**: `BEFORE UPDATE`  
**Function**: `update_restaurant_loyalty_balance_timestamp()`  
**Purpose**: Updates timestamp when loyalty balance changes.

## User Management Triggers

### on_auth_user_created
**Table**: `auth.users`  
**Event**: `AFTER INSERT`  
**Function**: `handle_new_user()`  
**Purpose**: Creates profile record when new user registers.

### on_auth_user_login
**Table**: `auth.users`  
**Event**: `AFTER UPDATE`  
**Condition**: `old.last_sign_in_at IS DISTINCT FROM new.last_sign_in_at`  
**Function**: `update_staff_last_login()`  
**Purpose**: Updates staff login timestamp for restaurant staff members.

### trigger_sync_customer_names
**Table**: `public.profiles`  
**Event**: `AFTER UPDATE`  
**Function**: `sync_customer_names()`  
**Purpose**: Syncs customer names when profile names are updated.

## Social Features Triggers

### on_friend_request_accepted
**Table**: `public.friend_requests`  
**Event**: `AFTER UPDATE OF status`  
**Function**: `handle_accepted_friend_request()`  
**Purpose**: Creates bidirectional friendship when request is accepted.

### on_booking_invite_accepted
**Table**: `public.booking_invites`  
**Event**: `AFTER UPDATE OF status`  
**Function**: `handle_accepted_booking_invite()`  
**Purpose**: Adds user to booking attendees when invite is accepted.

## Offers and Playlists Triggers

### trigger_set_user_offer_expiry
**Table**: `public.user_offers`  
**Event**: `BEFORE INSERT`  
**Function**: `set_user_offer_expiry()`  
**Purpose**: Sets expiry date and redemption code for claimed offers.

### trigger_set_share_code
**Table**: `public.restaurant_playlists`  
**Event**: `BEFORE INSERT OR UPDATE`  
**Function**: `set_share_code()`  
**Purpose**: Generates share codes for public playlists.

## Timestamp Management Triggers

### update_review_replies_updated_at
**Table**: `public.review_replies`  
**Event**: `BEFORE UPDATE`  
**Function**: `update_updated_at_column()`  
**Purpose**: Updates timestamp on record modification.

## Storage Triggers

### update_objects_updated_at
**Table**: `storage.objects`  
**Event**: `BEFORE UPDATE`  
**Function**: `storage.update_updated_at_column()`  
**Purpose**: Updates timestamp for storage objects.

## Realtime and Subscription Triggers

### tr_check_filters
**Table**: `realtime.subscription`  
**Event**: `BEFORE INSERT OR UPDATE`  
**Function**: `realtime.subscription_check_filters()`  
**Purpose**: Validates subscription filters for realtime updates.

## Cron Job Triggers

### cron_job_cache_invalidate
**Table**: `cron.job`  
**Event**: `AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE`  
**Function**: `cron.job_cache_invalidate()`  
**Purpose**: Invalidates cron job cache when schedules change.

## Trigger Categories by Purpose

### Data Integrity
- `generate_booking_confirmation` - Ensures unique confirmation codes
- `validate_loyalty_balance_trigger` - Prevents over-allocation of points
- `trigger_sync_customer_names` - Maintains data consistency

### Business Logic Automation
- `booking_status_change_trigger` - Handles loyalty point lifecycle
- `booking_cancelled_notify_waitlist` - Implements waitlist notifications
- `trigger_manage_restaurant_customers` - Automates customer record management

### Performance Optimization
- `refresh_availability_on_booking` - Maintains availability cache
- `refresh_availability_on_booking_tables` - Updates table availability

### User Experience
- `on_friend_request_accepted` - Seamless social connections
- `trigger_set_share_code` - Enables playlist sharing
- `trigger_set_user_offer_expiry` - Automatic offer management

### Analytics and Reporting
- `update_restaurant_rating_trigger` - Real-time rating updates
- `trigger_update_restaurant_review_summary` - Comprehensive review analytics
- `loyalty_transaction_audit_trigger` - Financial audit trail

## Security Considerations

### Row Level Security (RLS)
- Most triggers respect RLS policies
- `SECURITY DEFINER` functions bypass RLS where needed for system operations

### Data Privacy
- Profile sync triggers maintain privacy settings
- Customer data triggers anonymize guest information appropriately

### Audit Trail
- All loyalty transactions are logged
- Booking status changes are tracked
- User rating changes are recorded with reasons

## Performance Impact

### High-Frequency Triggers
- `refresh_availability_*` - Can impact performance during peak booking times
- `trigger_manage_restaurant_customers` - Runs on every booking change

### Optimization Strategies
- Asynchronous processing for non-critical updates
- Batch processing for maintenance operations
- Selective triggering based on actual field changes

## Error Handling

### Graceful Degradation
- Triggers use exception handling to prevent transaction rollbacks
- Non-critical operations log warnings instead of failing

### Recovery Mechanisms
- Failed loyalty point awards can be retried manually
- Customer statistics can be recalculated via maintenance functions
