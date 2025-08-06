# Time Range Search Feature

## Overview

The Time Range Search feature allows users to search for available tables within a specific time range and filter by table types. This provides more flexibility than the standard time slot selection.

## How it Works

### 1. User Interface
- **Advanced Time Search Button**: Added to the availability screen in the time selection step
- **Time Range Selector Modal**: Full-screen modal with intuitive time range and table type selection
- **Search Results**: Clear display of available times with table information

### 2. Key Components

#### `TimeRangeSelector.tsx`
- Modal interface for time range selection
- Table type filtering with visual icons
- Search results with detailed table information
- Optimized for performance with React.memo

#### `useTimeRangeSearch.ts`
- Hook for managing time range search logic
- Integrates with existing AvailabilityService
- Handles loading states and error management

#### Enhanced `AvailabilityService.ts`
- New `searchTimeRange()` method
- Efficiently searches across multiple time slots
- Filters by table types when specified
- Returns comprehensive results with table options

### 3. User Flow

1. **Access**: User taps "Search Time Range" button on availability screen
2. **Configure**: Select start time, end time, and optional table types
3. **Search**: System searches all available slots in the range
4. **Results**: Display matching time slots with table details
5. **Select**: User chooses a result and proceeds to experience selection

### 4. Features

#### Time Range Selection
- **From/To Time Selectors**: Easy dropdown selection
- **Validation**: Ensures end time is after start time
- **Time Options**: 30-minute intervals from 11:00 to 22:30

#### Table Type Filtering
- **6 Table Types**: Booth, Window, Patio, Standard, Bar, Private
- **Visual Icons**: Each type has a distinct emoji icon
- **Optional Filtering**: Leave empty to see all table types
- **Multi-Selection**: Choose multiple table types

#### Search Results
- **Time Slot Display**: Clear time presentation
- **Table Information**: Shows table count and capacity
- **Matching Types**: Displays which table types match filters
- **Experience Preview**: Shows primary dining experience
- **Combination Indicator**: Shows if tables need to be combined

### 5. Technical Implementation

#### Service Layer
```typescript
// Enhanced AvailabilityService with time range search
async searchTimeRange(params: {
  restaurantId: string;
  date: Date;
  startTime: string;
  endTime: string;
  partySize: number;
  tableTypes?: string[];
}): Promise<TimeRangeResult[]>
```

#### Component Integration
```typescript
// Added to availability screen
const { createSearchFunction } = useTimeRangeSearch();
const searchFunction = createSearchFunction(restaurantId);
```

#### Result Processing
- **Efficient Filtering**: Uses existing time slot data
- **Table Type Matching**: Filters options by selected types
- **Sorted Results**: Returns results ordered by time
- **Error Handling**: Graceful fallback for failed slot requests

### 6. Performance Optimizations

- **Cached Data**: Leverages existing availability cache
- **Batched Requests**: Efficient slot option fetching
- **React.memo**: Optimized component rendering
- **Background Processing**: Non-blocking search execution

### 7. User Experience Enhancements

#### Visual Design
- **Gradient Backgrounds**: Eye-catching button and modal design
- **Intuitive Icons**: Clear visual representation of features
- **Status Indicators**: Loading states and availability badges
- **Responsive Layout**: Works well on all screen sizes

#### Accessibility
- **Screen Reader Support**: Proper labels and hints
- **Haptic Feedback**: Touch feedback for interactions
- **Error Messages**: Clear error communication
- **Keyboard Navigation**: Supports keyboard input

#### Error Handling
- **Network Awareness**: Handles offline scenarios
- **Graceful Degradation**: Continues search even if some slots fail
- **User Feedback**: Clear error messages and retry options
- **Validation**: Prevents invalid time range selections

### 8. Integration with Existing Features

#### Booking Flow
- **Seamless Integration**: Results flow into existing experience selection
- **Loyalty Points**: Compatible with loyalty point calculation
- **Offers**: Works with preselected offers
- **Confirmation**: Uses existing booking confirmation process

#### Data Consistency
- **Real-time Data**: Uses live availability information
- **Cache Management**: Integrates with existing cache system
- **State Management**: Maintains booking state throughout flow

### 9. Future Enhancements

#### Potential Improvements
- **Date Range Search**: Extend to search across multiple dates
- **Advanced Filters**: Add cuisine type, price range filters
- **Saved Searches**: Allow users to save preferred search criteria
- **Smart Suggestions**: AI-powered time suggestions based on preferences

#### Analytics Integration
- **Search Metrics**: Track popular time ranges and table types
- **Conversion Tracking**: Measure search-to-booking conversion
- **User Preferences**: Learn user patterns for personalization

## Usage Example

```typescript
// User selects time range 18:00-20:00 with booth and window tables
const searchParams = {
  timeRange: { startTime: '18:00', endTime: '20:00' },
  selectedTableTypes: ['booth', 'window'],
  partySize: 4,
  date: selectedDate
};

// Results might include:
// - 18:00: 2 booths available, seats 8 total
// - 18:30: 1 window table + 1 booth, seats 6 total
// - 19:00: 3 window tables available, seats 12 total
```

This feature significantly enhances the booking experience by giving users more control and flexibility in finding their perfect dining time and table type.
