# Waiting List Schema Analysis & Recommendations

## Current Schema Assessment: **GOOD with Room for Improvement** ⭐⭐⭐⭐☆

### ✅ Strengths
1. **Solid Foundation**: Proper UUID keys, foreign key relationships, basic lifecycle
2. **Enhanced Flexibility**: Time ranges and party size ranges (v2.0 features)
3. **Status Management**: Complete status lifecycle with proper constraints
4. **User Experience**: Supports preferences, occasions, dietary notes
5. **Conversion Tracking**: Links successful bookings back to waitlist entries

### ⚠️ Areas Needing Enhancement

#### 1. **Queue Management & Performance**
```sql
-- Add these columns to existing waiting_list table
ALTER TABLE waiting_list ADD COLUMN queue_position INTEGER;
ALTER TABLE waiting_list ADD COLUMN estimated_wait_time INTERVAL;
ALTER TABLE waiting_list ADD COLUMN priority_score DECIMAL(5,2) DEFAULT 1.0;

-- Performance indexes
CREATE INDEX idx_waiting_list_active_restaurant_time 
ON waiting_list(restaurant_id, status, time_slot_start, time_slot_end) 
WHERE status = 'active';

CREATE INDEX idx_waiting_list_queue_position 
ON waiting_list(restaurant_id, queue_position) 
WHERE status = 'active';
```

#### 2. **Expiration & Time Management**
```sql
-- Better expiration handling
ALTER TABLE waiting_list ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE waiting_list ADD COLUMN notification_expires_at TIMESTAMP WITH TIME ZONE;

-- Auto-calculate expiration times
CREATE OR REPLACE FUNCTION set_waitlist_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Default 24-hour expiration for active entries
  NEW.expires_at = NEW.created_at + INTERVAL '24 hours';
  
  -- 15-minute window for notified entries
  IF NEW.status = 'notified' THEN
    NEW.notification_expires_at = NOW() + INTERVAL '15 minutes';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_set_waitlist_expiration
  BEFORE INSERT OR UPDATE ON waiting_list
  FOR EACH ROW
  EXECUTE FUNCTION set_waitlist_expiration();
```

#### 3. **Enhanced Matching Intelligence**
```sql
-- Better user preference tracking
ALTER TABLE waiting_list ADD COLUMN time_flexibility_level TEXT 
  CHECK (time_flexibility_level IN ('tight', 'moderate', 'flexible')) DEFAULT 'moderate';
  
ALTER TABLE waiting_list ADD COLUMN party_size_flexibility_level TEXT 
  CHECK (party_size_flexibility_level IN ('exact', 'smaller', 'larger', 'both')) DEFAULT 'exact';

-- Analytics for ML/optimization
ALTER TABLE waiting_list ADD COLUMN attempts_count INTEGER DEFAULT 0;
ALTER TABLE waiting_list ADD COLUMN last_attempted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE waiting_list ADD COLUMN conversion_probability DECIMAL(3,2);
```

#### 4. **Data Integrity Constraints**
```sql
-- Add logical validation constraints
ALTER TABLE waiting_list ADD CONSTRAINT valid_time_range 
  CHECK (time_slot_start <= time_slot_end);

ALTER TABLE waiting_list ADD CONSTRAINT valid_party_range 
  CHECK (min_party_size <= party_size);

ALTER TABLE waiting_list ADD CONSTRAINT valid_max_party 
  CHECK (max_party_size IS NULL OR max_party_size >= party_size);

ALTER TABLE waiting_list ADD CONSTRAINT reasonable_time_window 
  CHECK (time_slot_end - time_slot_start <= INTERVAL '4 hours');

ALTER TABLE waiting_list ADD CONSTRAINT valid_requested_date 
  CHECK (requested_date >= CURRENT_DATE);
```

## 🎯 **Critical Missing Functions**

### 1. **Intelligent Waitlist Matching**
```sql
CREATE OR REPLACE FUNCTION find_waitlist_matches(
  p_restaurant_id UUID,
  p_available_time TIMESTAMP WITH TIME ZONE,
  p_table_capacity INTEGER
) RETURNS TABLE(
  waitlist_id UUID,
  user_id UUID,
  match_score DECIMAL(3,2),
  time_preference_match BOOLEAN,
  party_size_fit BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wl.id,
    wl.user_id,
    -- Enhanced scoring algorithm
    (
      -- Perfect time match (within their desired window)
      CASE 
        WHEN p_available_time::TIME BETWEEN wl.time_slot_start AND wl.time_slot_end 
        THEN 2.0  -- Higher weight for time match
        ELSE 0.0
      END +
      -- Party size compatibility scoring
      CASE 
        WHEN p_table_capacity = wl.party_size THEN 1.5  -- Perfect size match
        WHEN p_table_capacity BETWEEN wl.min_party_size AND COALESCE(wl.max_party_size, 999)
        THEN 1.0  -- Acceptable size
        ELSE 0.0
      END +
      -- Queue position bonus (earlier = better)
      CASE 
        WHEN wl.queue_position IS NOT NULL 
        THEN (1.0 - (LEAST(wl.queue_position, 100)::DECIMAL / 100.0)) 
        ELSE 0.5 
      END +
      -- Time proximity bonus (closer to preferred time = better)
      CASE 
        WHEN wl.requested_time IS NOT NULL 
        THEN 1.0 - (ABS(EXTRACT(EPOCH FROM (p_available_time::TIME - wl.requested_time))) / 3600.0)
        ELSE 0.0
      END
    ) as match_score,
    -- Boolean flags for easy filtering
    (p_available_time::TIME BETWEEN wl.time_slot_start AND wl.time_slot_end) as time_preference_match,
    (p_table_capacity BETWEEN wl.min_party_size AND COALESCE(wl.max_party_size, 999)) as party_size_fit
  FROM waiting_list wl
  WHERE wl.restaurant_id = p_restaurant_id
    AND wl.status = 'active'
    AND wl.requested_date = p_available_time::DATE
    -- Must fit party size requirements
    AND p_table_capacity >= wl.min_party_size
    AND (wl.max_party_size IS NULL OR p_table_capacity <= wl.max_party_size)
    -- Must be within their time window
    AND p_available_time::TIME BETWEEN wl.time_slot_start AND wl.time_slot_end
    -- Must not be expired
    AND (wl.expires_at IS NULL OR wl.expires_at > NOW())
  ORDER BY match_score DESC, wl.created_at ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
```

### 2. **Queue Position Management**
```sql
CREATE OR REPLACE FUNCTION update_queue_positions(p_restaurant_id UUID)
RETURNS VOID AS $$
BEGIN
  WITH ranked_waitlist AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY 
          priority_score DESC,
          created_at ASC
      ) as new_position
    FROM waiting_list
    WHERE restaurant_id = p_restaurant_id
      AND status = 'active'
      AND expires_at > NOW()
  )
  UPDATE waiting_list wl
  SET queue_position = rw.new_position
  FROM ranked_waitlist rw
  WHERE wl.id = rw.id;
END;
$$ LANGUAGE plpgsql;
```

### 3. **Automatic Cleanup**
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_waitlist()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  -- Expire old active entries
  UPDATE waiting_list 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' 
    AND expires_at <= NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  
  -- Expire notified entries that weren't acted upon
  UPDATE waiting_list 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'notified' 
    AND notification_expires_at <= NOW();
  
  GET DIAGNOSTICS expired_count = expired_count + ROW_COUNT;
  
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;
```

## 📊 **Performance Recommendations**

### 1. **Essential Indexes**
```sql
-- Primary performance indexes
CREATE INDEX idx_waiting_list_restaurant_active 
ON waiting_list(restaurant_id, status, requested_date) 
WHERE status = 'active';

CREATE INDEX idx_waiting_list_user_status 
ON waiting_list(user_id, status, created_at DESC) 
WHERE status IN ('active', 'notified');

CREATE INDEX idx_waiting_list_expiration 
ON waiting_list(expires_at) 
WHERE status IN ('active', 'notified');

-- Time range overlap queries
CREATE INDEX idx_waiting_list_time_range 
ON waiting_list(restaurant_id, requested_date, time_slot_start, time_slot_end)
WHERE status = 'active';
```

### 2. **Materialized View for Dashboard**
```sql
CREATE MATERIALIZED VIEW waitlist_summary AS
SELECT 
  restaurant_id,
  requested_date,
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  COUNT(*) FILTER (WHERE status = 'notified') as notified_count,
  COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
  AVG(conversion_probability) as avg_conversion_rate,
  MIN(created_at) as oldest_entry,
  MAX(queue_position) as max_queue_position
FROM waiting_list
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY restaurant_id, requested_date;

-- Refresh hourly
CREATE INDEX ON waitlist_summary(restaurant_id, requested_date);
```

## 🎯 **Overall Assessment: GOOD Foundation, Needs Optimization**

### Score: **4/5 Stars** ⭐⭐⭐⭐☆

**Strengths:**
- ✅ Solid core schema with proper relationships
- ✅ Enhanced flexibility features (time ranges, party size ranges)  
- ✅ Complete status lifecycle management
- ✅ Good user experience considerations

**Critical Improvements Needed:**
- 🔧 Queue position and priority management
- 🔧 Performance indexes for matching queries
- 🔧 Expiration automation and cleanup
- 🔧 Better constraint validation
- 🔧 Analytics and conversion tracking

**Recommendation:** The current schema is **production-ready for basic functionality** but would benefit significantly from the performance and intelligence enhancements outlined above. Implement the queue management and indexing improvements first, then add the advanced matching algorithm for optimal user experience.

### Implementation Priority:
1. **High Priority**: Add indexes and queue position management
2. **Medium Priority**: Implement expiration automation and cleanup
3. **Nice to Have**: Add ML-based conversion prediction and advanced matching
