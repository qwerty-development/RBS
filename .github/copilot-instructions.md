# TableReserve (Plate) - AI Coding Agent Instructions

## 🏗️ Architecture Overview

React Native + Expo restaurant booking app with sophisticated business logic:

**Core Stack:**
- **Expo Router** - File-based routing (`/app` directory)
- **Supabase** - Auth + PostgreSQL with PostGIS
- **Zustand** - State management with persistence + subscriptions
- **NativeWind** - Tailwind CSS for React Native
- **TypeScript** - Full type safety throughout

**Key Business Features:**
- Real-time table reservation system with availability tracking
- Loyalty points per restaurant with configurable rules
- AI chat assistant for restaurant recommendations
- Social features (playlists, reviews, friend invitations)
- Calendar integration for booking management

## 🔧 Essential Development Commands

```bash
# Development
npm start                    # Expo dev server
npm run android             # Run on Android  
npm run ios                 # Run on iOS

# Code Quality & Testing
npm run lint                # ESLint with auto-fix
npm run type-check          # TypeScript checking
npm run test                # Jest tests (70% coverage threshold)
npm run test:watch          # Jest in watch mode
npm run test:coverage       # Coverage reports

# Supabase Integration  
npm run supabase:start      # Start local Supabase (requires Docker)
npm run supabase:status     # Check service status
npm run supabase:migrate    # Push migrations to remote
npm run supabase:gen-types  # Generate TypeScript types
```

## 🗂️ File Structure Patterns

```
app/(protected)/            # Authenticated routes only
├── (tabs)/                # Tab-based navigation
├── booking/               # Booking flow screens
└── restaurant/            # Restaurant details

components/
├── ui/                    # Base components (Button, Text, Card)
├── booking/               # Booking-specific components  
├── restaurant/            # Restaurant display components
└── skeletons/             # Loading state components

hooks/                     # Custom hooks (40+ hooks)
stores/index.ts           # Zustand stores with persistence
types/supabase.ts         # Generated database types
db/schema.sql             # Source of truth for database schema
```
## 🎨 UI Component Patterns

### NativeWind + CVA Pattern
```tsx
// Define variants with class-variance-authority
const buttonVariants = cva(
  "group flex items-center justify-center rounded-3xl", 
  {
    variants: {
      variant: {
        default: "bg-primary shadow-md active:shadow-sm",
        outline: "border border-input bg-background"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3"
      }
    }
  }
);

// Use with proper TypeScript
interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
}
```

### Zustand Store Architecture
```tsx
export const useAuthStore = create<AuthState>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          // state mutations with Immer
          setSession: (session) => set((state) => {
            state.session = session;
          })
        }))
      )
    )
  )
);
```

**Key Stores:**
- `useAuthStore` - Authentication + user profile
- `useAppStore` - Network status, location, notifications  
- `useRestaurantStore` - Favorites, cache, recently viewed
- `useBookingStore` - Current booking flow + history

## 🗄️ Database Schema & Business Logic

**Always reference `db/schema.sql` as source of truth for table definitions**

### Core Entity Relationships
```
profiles (auth.users) ← bookings → restaurants
                    ↓
                 reviews, favorites, loyalty_activities
                    ↓
            restaurant_playlists → playlist_items
```

### Critical Business Tables
- **`bookings`** - Core reservation data with status tracking (`pending`, `confirmed`, `completed`, etc.)
- **`restaurant_tables`** - Table layout with x/y positioning for floor plans
- **`table_availability`** - Real-time availability with PostGIS time ranges
- **`loyalty_activities`** - Point earning events with configurable rules per restaurant
- **`booking_attendees`** - Group booking participants for social dining

### Database Query Patterns
```tsx
// Always use typed queries with proper joins
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    restaurant:restaurants(*),
    user:profiles(*),
    booking_attendees(*, user:profiles(*))
  `)
  .eq('user_id', userId);

// PostGIS proximity queries for restaurant discovery
const { data } = await supabase.rpc('restaurants_within_radius', {
  lat: userLocation.latitude,
  lng: userLocation.longitude, 
  radius_km: 5
});
```

## 🔐 Authentication & Network Patterns

### Supabase Configuration
- **Custom SecureStorage** with memory fallback for auth tokens
- **PKCE flow** with auto-refresh tokens
- **Row Level Security** enforced on all user data tables
- **Guest mode support** via `useGuestGuard` hook

### Network-Aware Development
```tsx
// Use network-aware requests for offline scenarios
const { isOnline, connectionQuality } = useNetworkMonitor({
  showOfflineAlert: true,
  alertDelay: 5000
});

// Custom hook for offline-aware data fetching
const result = useNetworkAwareRequest(async () => {
  return await supabase.from('restaurants').select('*');
});
```

## 🧪 Testing Strategy

### Jest Configuration
- **Coverage threshold**: 70% across branches, functions, lines, statements
- **Test files**: `**/__tests__/**/*.(ts|tsx|js)` or `**/*.(test|spec).(ts|tsx|js)`
- **Custom setup**: `jest.setup.js` with mocked Expo modules and Supabase

### Testing Patterns
```tsx
// Component testing with React Native Testing Library
import { render, fireEvent } from '@testing-library/react-native';

describe('RestaurantCard', () => {
  it('handles booking press correctly', () => {
    const { getByText } = render(<RestaurantCard {...props} />);
    fireEvent.press(getByText('Book Now'));
    expect(mockOnPress).toHaveBeenCalledWith(restaurant);
  });
});

// Hook testing with renderHook
import { renderHook, waitFor } from '@testing-library/react-native';

describe('useAvailability', () => {
  it('fetches time slots correctly', async () => {
    const { result } = renderHook(() => useAvailability({
      restaurantId: 'test-id',
      date: new Date(),
      partySize: 2
    }));
    
    await waitFor(() => {
      expect(result.current.timeSlots).toHaveLength(8);
    });
  });
});
```

## 📱 Platform Integration Patterns

### Expo APIs
- **`expo-calendar`** - Always check permissions first, let user choose calendar app
- **`expo-location`** - PostGIS integration for restaurant directions
- **`expo-secure-store`** - Auth token storage with memory fallback
- **`expo-notifications`** - Booking confirmations and reminders

### Navigation with Protection
```tsx
// File-based routing with authentication guards
app/(protected)/bookings.tsx  // Requires auth
app/sign-in.tsx              // Public route
app/(protected)/(tabs)/      // Tab-based protected routes
```

## 🤖 AI Integration

- **LangChain + Google Generative AI** at `/ai/AI_Agent.py`
- **Custom response format**: `RESTAURANTS_TO_SHOW: id1,id2,id3`
- **Direct Supabase integration** for real-time restaurant data
- **TypeScript interface** at `/ai/AI_Agent.ts` for frontend integration

## ⚠️ Critical Development Rules

### Type Safety
- **Always generate types** from Supabase schema: `npm run supabase:gen-types`
- **Use database types**: `Database["public"]["Tables"]["table_name"]["Row"]`
- **Reference `db/schema.sql`** before writing queries or defining relationships

### Performance & Patterns
- **Use NativeWind classes**, not StyleSheet.create
- **Network-aware requests** with `useNetworkAwareRequest` for offline handling
- **Debounced search** for restaurant filtering
- **PostGIS location queries** for proximity searches
- **Image optimization** with expo-image's `contentFit`

### Absolute Rules - DO NOT VIOLATE
- **NEVER create mock/simplified components** - fix existing code
- **NEVER replace complex components** - debug and fix root cause  
- **ALWAYS work with existing codebase** - no new simplified alternatives
- **ALWAYS add explicit TypeScript types** to all parameters and return values
- **Fix all linter/TypeScript errors immediately**
