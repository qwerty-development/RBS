# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

```bash
# Development
npm start                    # Start Expo dev server
npm run android             # Run on Android
npm run ios                 # Run on iOS

# Code Quality & Testing
npm run lint                # ESLint with auto-fix
npm run type-check          # TypeScript checking
npm run test                # Run Jest tests
npm run test:watch          # Jest in watch mode
npm run test:coverage       # Jest with coverage reports (70% threshold)

# Build & Deploy
npm run build:apk           # Build Android APK (cloud)
npm run build:apk:local     # Build Android APK (local)
npm run build:production    # Build for app stores
npm run builds:status       # Check build status
```

## Architecture Overview

This is a **React Native + Expo restaurant booking app** with sophisticated business logic:

### Core Stack
- **Expo Router** - File-based routing (`/app` directory)
- **Supabase** - Authentication + PostgreSQL database
- **Zustand** - State management with persistence
- **NativeWind** - Tailwind CSS for React Native
- **TypeScript** - Full type safety throughout

### Key Business Features
- Restaurant discovery with PostGIS location queries
- Table reservation system with real-time availability
- Loyalty points per restaurant with configurable rules
- AI chat assistant for restaurant recommendations
- Social features (playlists, reviews, friend invitations)
- Calendar integration for booking management
- VIP and waiting list systems

## File Structure Patterns

```
app/(protected)/            # Authenticated routes only
├── (tabs)/                # Tab-based navigation
├── booking/               # Booking flow screens
├── restaurant/            # Restaurant details
└── profile/               # User profile sections

components/
├── ui/                    # Base components (Button, Text, Card)
├── booking/               # Booking-specific components  
├── restaurant/            # Restaurant display components
└── skeletons/             # Loading state components

hooks/                     # Custom hooks (40+ hooks)
stores/index.ts           # Zustand stores with persistence
types/supabase.ts         # Generated database types
```

## Database Schema Knowledge

**⚠️ CRITICAL: Always consult `db/schema.sql` as the single source of truth for database schema before writing any queries, defining types, or working with database operations.**

### Schema Verification Workflow
1. **FIRST**: Read `db/schema.sql` to understand table structure
2. **VERIFY**: Column names, types, constraints, and relationships
3. **VALIDATE**: Foreign key relationships and RLS policies
4. **IMPLEMENT**: Write queries based on actual schema

### Critical Tables & Relationships
- **bookings** ↔ **restaurants** + **profiles** (core reservation flow)
- **booking_attendees** + **booking_invites** (group booking system)
- **booking_status_history** (audit trail for status changes)
- **booking_archive** (historical booking data)
- **loyalty_activities** + **restaurant_loyalty_rules** (configurable points system)  
- **restaurant_playlists** + **playlist_items** + **playlist_collaborators** (social curation)
- **reviews** (verified reviews linked to completed bookings)
- **waiting_list** + **waiting_list_notifications** (queue management)
- **restaurant_tables** + **table_availability** (table management & real-time availability)

### Location & Spatial Data
- Uses **PostGIS** with `geometry(Point, 4326)` for precise location queries
- **restaurant_availability** manages capacity by time slots
- Always reference actual PostGIS functions in schema for location-based queries

### Database Best Practices
```tsx
// ALWAYS verify table structure in db/schema.sql first
const { data } = await supabase
  .from('bookings')  // ✅ Verify 'bookings' table exists
  .select(`
    id,
    booking_time,        // ✅ Check exact column name
    party_size,          // ✅ Verify data type constraints  
    status,              // ✅ Check enum values allowed
    restaurant:restaurants(name, cuisine_type),
    user:profiles(full_name, avatar_url)
  `)
  .eq('user_id', userId);  // ✅ Verify RLS policy allows this
```

## State Management Patterns

### Zustand Store Architecture
```tsx
// All stores use this pattern:
export const useAuthStore = create<AuthState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // state and actions with Immer mutations
        }))
      )
    )
  )
);
```

### Key Stores
- **useAuthStore** - Authentication + user profile
- **useAppStore** - Network status, location, notifications
- **useRestaurantStore** - Favorites, cache, recently viewed
- **useBookingStore** - Current booking flow + history

## Component Development Rules

### Styling Patterns
- **ALWAYS use NativeWind classes** instead of StyleSheet
- **Use expo-image** instead of React Native Image
- **Follow compound variants pattern** with `class-variance-authority`

### Type Safety Requirements
- **Generate types** from Supabase schema regularly
- **Use Database types**: `Database["public"]["Tables"]["table_name"]["Row"]`
- **Add explicit TypeScript types** to all parameters and return values

### Performance Optimizations
- **Network-aware requests** with `useNetworkAwareRequest` hook
- **Debounced search** for restaurant filtering  
- **Background network monitoring** with state persistence
- **Image optimization** with expo-image's `contentFit`

## Authentication & Security

### Supabase Integration
- **Custom SecureStorage class** with memory fallback
- **Row Level Security** enforced on all database tables
- **Guest mode support** via `useGuestGuard` hook
- **Auto-refresh tokens** with PKCE flow

### Permission Patterns
Always check permissions before using native APIs:
```tsx
// Calendar permissions
const { status } = await Calendar.requestCalendarPermissionsAsync();

// Location permissions  
const { status } = await Location.requestForegroundPermissionsAsync();
```

## AI Integration

### Restaurant Assistant
- **Location**: `/ai/AI_Agent.py` (LangChain + Google Generative AI)
- **Response format**: `RESTAURANTS_TO_SHOW: id1,id2,id3`
- **TypeScript interface**: `/ai/AI_Agent.ts`
- **Direct Supabase integration** for real-time restaurant data

## Testing Guidelines

### Jest Configuration
- **Coverage threshold**: 70% across all metrics  
- **Test files**: `**/__tests__/**/*.(ts|tsx|js)` or `**/*.(test|spec).(ts|tsx|js)`
- **Setup**: Custom `jest.setup.js` with extended matchers
- **Timeout**: 30 seconds for complex tests

### Testing Strategy
- Focus on business logic in hooks and utilities
- Test component interactions, not implementation details
- Mock Supabase calls and external API dependencies

## 🚨 CRITICAL RULES - DO NOT VIOLATE

**These rules are ABSOLUTE and must NEVER be compromised:**

1. **NEVER create mock/simplified components** - Fix existing code, debug root causes
2. **NEVER replace complex components** - Debug and fix the actual problem  
3. **ALWAYS work with existing codebase** - No new simplified alternatives ever
4. **ALWAYS add explicit TypeScript types** to all parameters and return values
5. **Fix all linter/TypeScript errors immediately** - Zero tolerance policy
6. **When in doubt, always ask first** - Never assume or guess requirements

**Database Schema Rule:**
- **MANDATORY**: Consult `db/schema.sql` before ANY database operation
- Verify table names, column types, constraints, and relationships
- Never assume schema structure - always verify first

**Code Quality Standards:**
- All functions must have explicit return types
- All parameters must have explicit types  
- No `any` types unless absolutely necessary with justification
- All async operations must handle errors properly
- All network requests must use network-aware patterns

## Common Gotchas & Solutions

### Database Queries
```tsx
// CORRECT: Use joins and RLS-aware queries
const { data } = await supabase
  .from('bookings')
  .select(`
    *,
    restaurant:restaurants(*),
    user:profiles(*)
  `)
  .eq('user_id', userId);
```

### Calendar Integration
- Always request permissions first
- Let users choose calendar app instead of auto-selecting
- Create events with proper duration and reminders

### Network Handling  
- Use `useNetworkAwareRequest` for all API calls
- Implement graceful degradation for offline scenarios
- Show network status banners for poor connections

## Build & Deployment

### EAS Build Commands
```bash
npm run build:apk              # Cloud APK build
npm run build:apk:local        # Local APK build  
npm run build:android:preview  # Preview AAB
npm run build:production       # Store-ready AAB
```

Refer to `BUILD_GUIDE.md` for detailed build instructions and troubleshooting.

## 🔧 Development Workflow - MANDATORY PROCESS

**Before ANY code changes:**

1. **Schema First**: Read `db/schema.sql` to verify database structure
2. **Understand Context**: Read existing code to understand patterns and architecture  
3. **Type Safety**: Ensure all new code has explicit TypeScript types
4. **Fix, Don't Replace**: Debug existing complex components, never create simplified versions
5. **Test Thoroughly**: Run `npm run lint` and `npm run type-check` before completing tasks

**Core Development Principles:**

1. **Follow existing Zustand + Supabase patterns** religiously - never deviate
2. **Use NativeWind classes, never StyleSheet** objects - maintain consistency
3. **Test permission flows** for all native API usage - handle edge cases properly
4. **Handle network states and offline scenarios** - use network-aware request patterns
5. **Maintain component complexity** - fix bugs in existing components, don't simplify
6. **Ask before major changes** - when uncertain, always ask for clarification first

**Quality Assurance Checklist:**
- ✅ All TypeScript errors resolved
- ✅ All ESLint warnings fixed  
- ✅ Database schema verified in `db/schema.sql`
- ✅ Network-aware patterns used for API calls
- ✅ Proper error handling implemented
- ✅ Guest mode and offline scenarios considered