# TableReserve (RBS) - AI Coding Agent Instructions

## 🏗️ Architecture Overview

This is a **React Native + Expo restaurant booking app** built with:
- **Expo Router** (file-based routing in `/app`)
- **Supabase** (auth + database) 
- **Zustand** (state management with persistence)
- **NativeWind** (Tailwind CSS for React Native)
- **TypeScript** throughout

**Key Pattern**: This follows an opinionated Expo+Supabase starter architecture with custom booking/restaurant business logic layered on top.

## 🎯 Core Business Domain

**Restaurant Booking Platform** with:
- User auth (guest mode supported)
- Restaurant discovery with filters
- Table reservations with confirmation codes
- Loyalty points system per restaurant
- Reviews and ratings
- AI chat assistant for restaurant recommendations
- Calendar integration for bookings

## 🗂️ Critical File Structure

```
app/                    # Expo Router screens (file-based routing)
├── (protected)/        # Authenticated routes
├── auth-*.tsx         # Auth flows
└── _layout.tsx        # Root layout with providers

components/
├── ui/                # Base UI components (Button, Text, etc.)
├── booking/           # BookingCard, booking-specific components
├── restaurant/        # Restaurant display components
└── [feature]/         # Feature-specific components

stores/index.ts        # Zustand stores (auth, ui, network state)
config/supabase.ts     # Supabase client with SecureStore
types/supabase.ts      # Generated DB types (700+ lines)
hooks/                 # Custom hooks (useBookings, useLocation, etc.)
```

## 🔧 Development Workflows

### Essential Commands
```bash
npm start              # Expo dev server
npm run android        # Run on Android
npm run ios           # Run on iOS  
npm run lint          # ESLint with auto-fix
npm run test          # Jest tests
npm run test:watch     # Jest in watch mode
npm run test:coverage  # Jest with coverage reports
npm run type-check    # TypeScript checking
npm run generate-colors # Generate color constants from Tailwind
```

### Testing Strategy
- **Jest + React Native Testing Library**
- Coverage thresholds: 70% across all metrics
- Test files: `**/__tests__/**/*.(ts|tsx|js)` or `**/*.(test|spec).(ts|tsx|js)`
- Setup: Custom jest.setup.js with extended matchers

## 🎨 UI & Styling Patterns

### Component Architecture
- **Compound variants pattern** using `class-variance-authority`
- **Polymorphic components** with TypeScript discrimination
- **NativeWind classes** instead of StyleSheet
- **Expo Image** instead of React Native Image

### Example Button Pattern:
```tsx
// Define variants with cva
const buttonVariants = cva("base-classes", {
  variants: { variant: { default: "...", destructive: "..." } }
});

// Use in component with proper TypeScript
interface ButtonProps extends VariantProps<typeof buttonVariants> {
  // other props
}
```

### State Management Pattern
```tsx
// Zustand with immer, persist, and subscriptions
export const useAuthStore = create<AuthState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // state and actions
        }))
      )
    )
  )
);
```

## �️ Database Schema & Patterns

- **Schema Verification**: Always use the `db/schema.sql` file as the source of truth for the database schema. Reference it to validate table definitions, columns, types, constraints, and relationships before writing queries or defining types.

### Core Entity Relationships
```
profiles (auth.users) ← bookings → restaurants
                    ↓
                 reviews, favorites, loyalty_activities
                    ↓
            restaurant_playlists → playlist_items
                    ↓
              friends, friend_requests
```

### Key Tables & Business Logic

**Bookings Flow:**
- `bookings` - Core reservation data with status tracking
- `booking_attendees` - Group booking participants  
- `booking_invites` - Social sharing invitations
- `booking_status_history` - Audit trail for status changes
- `booking_archive` - Completed/cancelled booking history

**Restaurant Management:**
- `restaurants` - Core restaurant data with PostGIS location
- `restaurant_tables` - Table layout with x/y positioning
- `table_availability` - Real-time availability tracking
- `restaurant_availability` - Capacity management by time slot
- `menu_categories` + `menu_items` - Full menu system

**Loyalty & Rewards:**
- `loyalty_activities` - Point earning events
- `restaurant_loyalty_rules` - Configurable point rules per restaurant
- `loyalty_rewards` - Redeemable rewards catalog
- `loyalty_redemptions` - Redemption tracking with codes

**Social Features:**
- `restaurant_playlists` - User-created restaurant lists
- `playlist_collaborators` - Shared playlist permissions
- `posts` - Social sharing of dining experiences
- `friends` + `friend_requests` - Social connections

### Database Access Patterns
```tsx
// Always use typed queries with joins
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    restaurant:restaurants(*),
    user:profiles(*),
    booking_attendees(*, user:profiles(*))
  `)
  .eq('user_id', userId);

// Use RLS-aware queries 
const { data } = await supabase
  .from('favorites')
  .select('*, restaurant:restaurants(*)')
  .eq('user_id', userId); // RLS auto-enforces this
```

## 🔐 Authentication & Data Patterns

### Supabase Integration
- **Custom SecureStorage class** with memory fallback
- **Row Level Security** enforced on all tables
- **Guest mode support** (useGuestGuard hook)
- **Auto-refresh tokens** with PKCE flow

### Error Handling
- **Network-aware requests** (useNetworkAwareRequest)
- **Error boundaries** at route level
- **Graceful degradation** for offline scenarios
- **Toast notifications** for user feedback

## 📱 Platform-Specific Considerations

### Expo APIs Used
- `expo-calendar` for calendar integration
- `expo-location` for restaurant directions  
- `expo-haptics` for feedback
- `expo-secure-store` for auth tokens with memory fallback
- `expo-notifications` for booking updates
- `@react-native-community/netinfo` for network monitoring
- `@sentry/react-native` for error tracking

### Navigation Pattern
```tsx
// File-based routing with protection
app/(protected)/bookings.tsx  # Requires auth
app/sign-in.tsx              # Public route
app/(protected)/(tabs)/      # Tab-based protected routes
```

## 🤖 AI Integration

**Restaurant assistant** at `/ai/AI_Agent.py`:
- LangChain + Google Generative AI with LangGraph state management
- Specialized for restaurant recommendations with Supabase integration
- Custom response format: `RESTAURANTS_TO_SHOW: id1,id2,id3`
- Direct Supabase integration for real-time restaurant data
- TypeScript interface available at `/ai/AI_Agent.ts` for frontend integration

## ⚠️ Common Patterns & Gotchas

### Type Safety
- **Generate types** from Supabase schema regularly
- **Database type**: Use `Database["public"]["Tables"]["table_name"]["Row"]`
- **Compound types**: Restaurant + booking joins are common
- **Key relationships**: `bookings` → `restaurants` + `profiles`, `reviews` → `bookings`

### Performance
- **Network-aware requests** with `useNetworkAwareRequest` hook for offline handling
- **Image optimization** with expo-image's `contentFit`
- **Debounced search** for restaurant filtering
- **Background network monitoring** with state persistence and quality detection
- **PostGIS location queries** for restaurant proximity searches

### Calendar Integration
- **Always check permissions first** (Calendar.requestCalendarPermissionsAsync)
- **User choice for calendar apps** instead of auto-selecting default
- **Event creation** with reminders and proper duration

When working on this codebase:
1. **Follow the existing Zustand + Supabase patterns**
2. **Use NativeWind classes, not StyleSheet**
3. **Maintain type safety with generated Supabase types** 
4. **Test permission flows for native APIs**
5. **Handle network states and offline scenarios**

## 🛡️ Critical Rules - DO NOT VIOLATE

- **NEVER create mock/simplified components** - fix existing code
- **NEVER replace complex components** - debug and fix root cause
- **ALWAYS work with existing codebase** - no new simplified alternatives
- **ALWAYS add explicit TypeScript types** to all parameters and return values
- **Fix all linter/TypeScript errors immediately**
- **When in doubt, always ask first**
