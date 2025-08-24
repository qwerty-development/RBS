# Database Operations Guide

## Common Query Patterns

### Booking Queries

#### Get User's Upcoming Bookings
```sql
SELECT 
  b.*,
  r.name as restaurant_name,
  r.address,
  r.phone_number,
  array_agg(rt.table_number) as table_numbers
FROM bookings b
JOIN restaurants r ON b.restaurant_id = r.id
LEFT JOIN booking_tables bt ON b.id = bt.booking_id
LEFT JOIN restaurant_tables rt ON bt.table_id = rt.id
WHERE b.user_id = $1
  AND b.booking_time >= NOW()
  AND b.status IN ('confirmed', 'pending')
GROUP BY b.id, r.name, r.address, r.phone_number
ORDER BY b.booking_time ASC;
```

#### Find Available Time Slots
```sql
WITH time_slots AS (
  SELECT generate_series(
    '11:00'::time,
    '22:00'::time,
    '30 minutes'::interval
  ) AS slot_time
),
available_slots AS (
  SELECT 
    ts.slot_time,
    quick_availability_check(
      $1, -- restaurant_id
      $2::date + ts.slot_time, -- start_time
      $2::date + ts.slot_time + interval '2 hours', -- end_time
      $3 -- party_size
    ) as is_available
  FROM time_slots ts
)
SELECT slot_time
FROM available_slots
WHERE is_available = true;
```

#### Get Restaurant Booking Statistics
```sql
SELECT 
  DATE(booking_time) as booking_date,
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
  COUNT(*) FILTER (WHERE status LIKE 'cancelled%') as cancelled,
  AVG(party_size) as avg_party_size
FROM bookings
WHERE restaurant_id = $1
  AND booking_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(booking_time)
ORDER BY booking_date DESC;
```

### Loyalty Queries

#### Get User's Loyalty Activity
```sql
SELECT 
  la.*,
  b.confirmation_code,
  r.name as restaurant_name
FROM loyalty_activities la
LEFT JOIN bookings b ON la.related_booking_id = b.id
LEFT JOIN restaurants r ON b.restaurant_id = r.id
WHERE la.user_id = $1
ORDER BY la.created_at DESC
LIMIT 50;
```

#### Restaurant Loyalty Dashboard
```sql
SELECT 
  rlb.current_balance,
  rlb.total_purchased,
  COUNT(rlt.id) as total_transactions,
  SUM(CASE WHEN rlt.transaction_type = 'deduction' THEN rlt.points ELSE 0 END) as points_awarded,
  COUNT(DISTINCT rlt.user_id) as unique_users_rewarded
FROM restaurant_loyalty_balance rlb
LEFT JOIN restaurant_loyalty_transactions rlt ON rlb.restaurant_id = rlt.restaurant_id
WHERE rlb.restaurant_id = $1
GROUP BY rlb.current_balance, rlb.total_purchased;
```

### Table Management Queries

#### Get Table Layout
```sql
SELECT 
  rt.*,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM booking_tables bt
      JOIN bookings b ON bt.booking_id = b.id
      WHERE bt.table_id = rt.id
        AND b.status IN ('confirmed', 'pending')
        AND b.booking_time <= $2 -- end_time
        AND b.booking_time + (b.turn_time_minutes || ' minutes')::interval > $1 -- start_time
    ) THEN 'occupied'
    ELSE 'available'
  END as status
FROM restaurant_tables rt
WHERE rt.restaurant_id = $3
  AND rt.is_active = true
ORDER BY rt.priority_score, rt.table_number;
```

#### Table Utilization Analysis
```sql
SELECT 
  rt.table_number,
  rt.capacity,
  COUNT(b.id) as bookings_count,
  AVG(b.party_size) as avg_party_size,
  (AVG(b.party_size) / rt.capacity::float) * 100 as utilization_percentage
FROM restaurant_tables rt
LEFT JOIN booking_tables bt ON rt.id = bt.table_id
LEFT JOIN bookings b ON bt.booking_id = b.id
  AND b.status = 'completed'
  AND b.booking_time >= CURRENT_DATE - INTERVAL '30 days'
WHERE rt.restaurant_id = $1
GROUP BY rt.id, rt.table_number, rt.capacity
ORDER BY utilization_percentage DESC;
```

### Customer Analysis Queries

#### Top Customers Report
```sql
SELECT 
  rc.*,
  p.full_name,
  p.phone_number,
  p.loyalty_points,
  p.membership_tier
FROM restaurant_customers rc
LEFT JOIN profiles p ON rc.user_id = p.id
WHERE rc.restaurant_id = $1
  AND rc.total_bookings >= 5
ORDER BY rc.total_bookings DESC, rc.total_spent DESC
LIMIT 50;
```

#### Customer Behavior Analysis
```sql
SELECT 
  CASE 
    WHEN rc.total_bookings >= 20 THEN 'VIP'
    WHEN rc.total_bookings >= 10 THEN 'Loyal'
    WHEN rc.total_bookings >= 5 THEN 'Regular'
    WHEN rc.total_bookings >= 2 THEN 'Repeat'
    ELSE 'New'
  END as customer_segment,
  COUNT(*) as customer_count,
  AVG(rc.total_bookings) as avg_bookings,
  AVG(rc.average_party_size) as avg_party_size,
  AVG(rc.no_show_count::float / NULLIF(rc.total_bookings, 0)) * 100 as avg_no_show_rate
FROM restaurant_customers rc
WHERE rc.restaurant_id = $1
GROUP BY customer_segment
ORDER BY avg_bookings DESC;
```

## Maintenance Operations

### Daily Maintenance Script
```sql
-- Run booking status updates
SELECT update_booking_statuses();

-- Archive old bookings (keep 90 days)
SELECT archive_old_bookings(90);

-- Expire old redemptions
SELECT expire_old_redemptions();

-- Expire old user offers
SELECT expire_old_user_offers();

-- Clean up old notifications
SELECT cleanup_old_notifications();

-- Update customer statistics (if needed)
-- SELECT update_all_customer_statistics();

-- Refresh availability cache
SELECT refresh_table_availability();

-- Health check
SELECT check_booking_system_health();
```

### Data Integrity Checks
```sql
-- Check for bookings without tables
SELECT b.id, b.confirmation_code
FROM bookings b
LEFT JOIN booking_tables bt ON b.id = bt.booking_id
WHERE bt.booking_id IS NULL
  AND b.status IN ('confirmed', 'pending')
  AND b.created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Check for loyalty rule violations
SELECT b.id, b.applied_loyalty_rule_id, rlr.points_to_award, rlb.current_balance
FROM bookings b
JOIN restaurant_loyalty_rules rlr ON b.applied_loyalty_rule_id = rlr.id
JOIN restaurant_loyalty_balance rlb ON b.restaurant_id = rlb.restaurant_id
WHERE b.loyalty_points_earned > 0
  AND rlb.current_balance < rlr.points_to_award;

-- Check for orphaned customer records
SELECT rc.id, rc.guest_email, rc.user_id
FROM restaurant_customers rc
LEFT JOIN bookings b ON (
  (rc.user_id = b.user_id AND rc.restaurant_id = b.restaurant_id) OR
  (rc.guest_email = b.guest_email AND rc.restaurant_id = b.restaurant_id)
)
WHERE b.id IS NULL;
```

### Performance Optimization

#### Index Recommendations
```sql
-- Booking queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_upcoming ON bookings(user_id, booking_time) WHERE status IN ('confirmed', 'pending');
CREATE INDEX IF NOT EXISTS idx_bookings_restaurant_date ON bookings(restaurant_id, booking_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status_time ON bookings(status, booking_time);

-- Availability queries
CREATE INDEX IF NOT EXISTS idx_booking_tables_table_booking ON booking_tables(table_id, booking_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_restaurant_active ON restaurant_tables(restaurant_id, is_active);

-- Loyalty queries
CREATE INDEX IF NOT EXISTS idx_loyalty_activities_user_created ON loyalty_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_loyalty_transactions_restaurant ON restaurant_loyalty_transactions(restaurant_id, created_at DESC);

-- Customer queries
CREATE INDEX IF NOT EXISTS idx_restaurant_customers_restaurant ON restaurant_customers(restaurant_id, total_bookings DESC);
```

#### Query Performance Monitoring
```sql
-- Slow query analysis
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
WHERE query LIKE '%bookings%'
  OR query LIKE '%restaurants%'
  OR query LIKE '%availability%'
ORDER BY total_time DESC
LIMIT 10;
```

## Backup and Recovery

### Backup Strategy
```sql
-- Full database backup
pg_dump -h localhost -U postgres -d plate_production > backup_$(date +%Y%m%d_%H%M%S).sql

-- Table-specific backups for critical data
pg_dump -h localhost -U postgres -d plate_production -t bookings > bookings_backup.sql
pg_dump -h localhost -U postgres -d plate_production -t profiles > profiles_backup.sql
pg_dump -h localhost -U postgres -d plate_production -t restaurants > restaurants_backup.sql
```

### Recovery Procedures
```sql
-- Point-in-time recovery for specific tables
-- (Requires transaction log replay)

-- Restore specific booking
INSERT INTO bookings SELECT * FROM booking_archive WHERE id = $1;
INSERT INTO booking_tables SELECT * FROM booking_tables_archive WHERE booking_id = $1;

-- Restore customer data
-- Use verify_customer_statistics() to check integrity
-- Use update_all_customer_statistics() to recalculate if needed
```

## Monitoring and Alerts

### System Health Queries
```sql
-- Booking system health
SELECT check_booking_system_health();

-- Database size monitoring
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Connection monitoring
SELECT 
  datname,
  numbackends,
  xact_commit,
  xact_rollback,
  blks_read,
  blks_hit,
  tup_returned,
  tup_fetched
FROM pg_stat_database
WHERE datname = 'plate_production';
```

### Performance Metrics
```sql
-- Table statistics
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Security Operations

### User Access Management
```sql
-- Create restaurant staff user
INSERT INTO restaurant_staff (restaurant_id, user_id, role, permissions)
VALUES ($1, $2, 'manager', ARRAY['view_bookings', 'confirm_bookings', 'view_reports']);

-- Revoke access
UPDATE restaurant_staff 
SET is_active = false, terminated_at = NOW()
WHERE user_id = $1 AND restaurant_id = $2;
```

### Data Privacy Operations
```sql
-- User data export (GDPR compliance)
SELECT * FROM profiles WHERE id = $1;
SELECT * FROM bookings WHERE user_id = $1;
SELECT * FROM loyalty_activities WHERE user_id = $1;
SELECT * FROM reviews WHERE user_id = $1;

-- User data deletion (Right to erasure)
-- Note: This should be done carefully, considering business requirements
UPDATE profiles SET 
  full_name = 'Deleted User',
  phone_number = NULL,
  avatar_url = NULL,
  allergies = NULL,
  dietary_restrictions = NULL
WHERE id = $1;

-- Anonymize guest bookings after retention period
UPDATE bookings SET
  guest_name = 'Anonymous Guest',
  guest_email = NULL,
  guest_phone = NULL
WHERE guest_email IS NOT NULL
  AND created_at < NOW() - INTERVAL '2 years';
```
