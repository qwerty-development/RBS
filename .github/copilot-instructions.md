# TableReserve (Plate) - AI Coding Agent Instructions

## 🏗️ Architecture Overview

React Native + Expo restaurant booking app with sophisticated business logic.
## 📱 Platform Integration

- **Expo APIs** - Calendar, location, notifications, biometrics
- **File-based routing** with authentication guards
- **Native optimizations** for Android/iOS only
- **Permission handling** - Always request/handle properly

```tsx
// Protected routes pattern
app/(protected)/bookings.tsx  // Requires auth
app/sign-in.tsx              // Public route
```*
- **Expo 53** - File-based routing, Android/iOS only (no web)
- **Supabase** - Auth + PostgreSQL with PostGIS + Edge Functions  
- **Zustand + Immer** - State management with persistence
- **NativeWind 4.1** - Tailwind CSS styling
- **TypeScript 5.8** - Strict type safety, 70% test coverage
- **React Native 0.79.5** - Latest with React 19

**Key Features:**
- Real-time table reservations with availability tracking
- Advanced time range search + table type filtering  
- Waitlist system with notifications
- AI chat assistant (LangChain + Google GenAI)
- Social features (playlists, reviews, loyalty points)
- Calendar integration + performance monitoring

## 🔧 Essential Commands

```bash
# Development
npm start                    # Expo dev server
npm run android             # Android device/emulator 
npm run ios                 # iOS device/simulator
npm run lint                # ESLint with auto-fix
npm run test                # Jest tests (70% coverage)
npm run type-check          # TypeScript checking

# Build & Deploy
npm run build:apk           # Android APK (EAS)
npm run build:production    # Production builds
npm run builds:status       # Check build status

# Supabase (Use MCP instead when possible)
npm run supabase:start      # Local Supabase
npm run supabase:migrate    # Push migrations
npm run supabase:gen-types  # Generate types
```

## 🗂️ Project Structure

```
app/(protected)/            # Auth-required routes
├── (tabs)/                # Home, search, bookings, profile
├── booking/               # Booking flow
├── restaurant/            # Restaurant details
├── playlist/              # Social playlists
├── waiting-list.tsx       # Waitlist management
└── offers.tsx             # Promotions

components/
├── ui/                    # Base components (Button, Text, Card)
├── booking/               # Booking components
├── restaurant/            # Restaurant displays
├── search/                # Search & filtering
├── network/               # Offline handling
└── skeletons/             # Loading states

hooks/                     # 45+ custom hooks
├── useTimeRangeSearch.ts  # Advanced search
├── useWaitlist.ts         # Waitlist management
├── useNetworkAwareRequest.ts # Offline handling
├── useBiometricAuth.ts    # Face/Touch ID
└── usePerformanceMonitor.ts # Analytics

stores/index.ts            # Zustand + Immer + persistence
types/supabase.ts          # Generated DB types (primary)
db/schema.sql              # Schema source of truth
```
## 🎨 Code Patterns

### Component Styling (NativeWind + CVA)
```tsx
const buttonVariants = cva(
  "group flex items-center justify-center rounded-3xl", 
  {
    variants: {
      variant: {
        default: "bg-primary shadow-md active:shadow-sm",
        outline: "border border-input bg-background"
      },
      size: { default: "h-10 px-4 py-2", sm: "h-9 rounded-lg px-3" }
    }
  }
);
```

### State Management (Zustand + Immer)
```tsx
export const useAuthStore = create<AuthState>()(
  devtools(subscribeWithSelector(persist(immer((set) => ({
    session: null,
    setSession: (session) => set((state) => { state.session = session; })
  })))))
);
```

### Database Queries (Typed Supabase)
```tsx
const { data } = await supabase
  .from('bookings')
  .select(`*, restaurant:restaurants(*), user:profiles(*)`)
  .eq('user_id', userId);
```

## 🗄️ Database Schema

**Always reference `db/schema.sql` as source of truth**

### Key Tables
- **`bookings`** - Reservations with status tracking
- **`restaurant_tables`** - Table layout + positioning
- **`table_availability`** - Real-time availability (PostGIS)
- **`waitlist`** - User waitlist entries with notifications
- **`loyalty_activities`** - Points per restaurant
- **`booking_attendees`** - Group dining participants
- **`restaurant_playlists`** - Social collections

### PostGIS Location Queries
```tsx
const { data } = await supabase.rpc('restaurants_within_radius', {
  lat: userLocation.latitude,
  lng: userLocation.longitude, 
  radius_km: 5
});
```

## 🔐 Auth & Network

- **Supabase Auth** - PKCE flow with SecureStorage + memory fallback
- **Row Level Security** on all user tables
- **Guest mode** via `useGuestGuard` hook
- **Network-aware requests** with `useNetworkAwareRequest` for offline handling
- **Biometric auth** - Face ID/Touch ID via `useBiometricAuth`

```tsx
const result = useNetworkAwareRequest(async () => {
  return await supabase.from('restaurants').select('*');
});
```

## 🧪 Testing

- **Jest** with 70% coverage threshold
- **React Native Testing Library** for components
- **Detox** for E2E testing
- **Mock setup** in `jest.setup.js`

```tsx
describe('RestaurantCard', () => {
  it('handles booking press', () => {
    const { getByText } = render(<RestaurantCard {...props} />);
    fireEvent.press(getByText('Book Now'));
    expect(mockOnPress).toHaveBeenCalledWith(restaurant);
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

- **LangChain + Google GenAI** for restaurant recommendations
- **Custom response format**: `RESTAURANTS_TO_SHOW: id1,id2,id3`
- **Direct Supabase integration** with session management
- **Backend API spec** in `AI_BACKEND_API_SPECIFICATION.md`

## 🆕 Latest Features

### Time Range Search & Waitlist
- **Time Range Selector** - Search across time windows with table type filtering
- **Smart Waitlist** - Auto-suggest when no tables available
- **Real-time notifications** when tables become available
- **6 table types** with visual icons (Booth, Window, Patio, etc.)

### Enhanced Auth & Performance
- **Biometric authentication** (Face ID/Touch ID)
- **Network-aware requests** for offline handling
- **Performance monitoring** and error tracking
- **Social features** (playlists, reviews, loyalty points)

## 🧠 MCP Integration

### Core MCPs
- **Sequential Thinking** - Complex problem solving & multi-step planning
- **Knowledge Graph Memory** - Store relationships & architectural decisions  
- **Memory Bank** - Detailed documentation & code examples
- **Supabase MCP** - Primary tool for ALL database operations
- **Playwright** - Web automation & testing external integrations

### Key Usage Patterns
- **Always use Supabase MCP** for database operations (not CLI)
- **Use Sequential Thinking** for complex refactoring & debugging
- **Store solutions in Knowledge Graph** for relationships & patterns
- **Document comprehensive guides** in Memory Bank
- **Test external integrations** with Playwright

### Database-First Development with Supabase MCP
- Schema analysis before changes
- Type generation after modifications  
- Development branch testing
- Cross-project operations
- Performance monitoring
## ⚠️ Critical Development Rules

### Type Safety & Code Quality
- **Always generate types** from Supabase schema: Use Supabase MCP for `generate_typescript_types`
- **Use database types**: `Database["public"]["Tables"]["table_name"]["Row"]`
- **Reference `db/schema.sql`** and use Supabase MCP to analyze current schema before writing queries
- **Strict TypeScript** - All functions must have explicit parameter and return types
- **ESLint compliance** - Fix all linting errors immediately with `npm run lint`
- **Test coverage** - Maintain 70% coverage threshold across all metrics

### Database Operations & Schema Management
- **Use Supabase MCP for all database operations** instead of manual CLI commands
- **Use `execute_sql` for queries** and `apply_migration` for schema changes
- **Always check logs** with Supabase MCP after database operations
- **Use development branches** via Supabase MCP for testing schema changes
- **Generate fresh types** after any schema modifications using Supabase MCP
- **PostGIS queries** for all location-based operations (restaurant proximity, etc.)
- **Row Level Security** - Ensure all user data tables have proper RLS policies

### Performance & Patterns
- **Use NativeWind classes**, not StyleSheet.create
- **Network-aware requests** with `useNetworkAwareRequest` for offline handling
- **Debounced search** for restaurant filtering with `use-debounce`
- **PostGIS location queries** for proximity searches
- **Image optimization** with expo-image's `contentFit`
- **React.memo** for expensive components (TimeRangeSelector, RestaurantCard)
- **Zustand with Immer** for all state mutations
- **Persistent storage** for critical user data (auth, favorites, search history)

### Mobile Platform Focus
- **Android & iOS ONLY** - Ignore web development concerns completely
- **Native APIs** - Leverage Expo APIs for calendar, location, notifications, biometrics
- **Offline-first** - All critical features must work offline
- **Permission handling** - Always request and handle permissions properly
- **Platform-specific optimizations** - Use platform checks when needed
- **Gesture handling** - Implement proper touch gestures with react-native-gesture-handler

### Feature Implementation Standards
- **Waitlist Integration** - Use `useWaitlist` hook for all waitlist operations
- **Time Range Search** - Use `useTimeRangeSearch` for advanced search functionality
- **Authentication Guards** - Use `useGuestGuard` for protected features
- **Error Boundaries** - Wrap complex components with ErrorBoundary
- **Loading States** - Implement skeleton components for all async operations
- **Accessibility** - Use `useAccessibility` hook and semantic labels

### MCP Integration Rules
- **Use Sequential Thinking** for complex multi-step problems before coding
- **Store solutions in Knowledge Graph Memory** for relationships and entities
- **Store detailed documentation in Memory Bank** for comprehensive records
- **Use Supabase MCP** for all database operations, schema changes, and Edge Functions
- **Use Playwright** for web automation, testing, and browser-based tasks
- **Document architectural decisions** using both memory systems as appropriate
- **Leverage MCPs proactively** - don't wait to be asked

### Database-First Development with Supabase MCP
- **Schema Analysis**: Always use Supabase MCP to examine current schema before changes
- **Type Generation**: Use Supabase MCP to generate TypeScript types after schema modifications
- **Data Operations**: Use Supabase MCP for complex queries instead of writing manual SQL
- **Migration Management**: Plan and execute migrations through Supabase MCP
- **Edge Functions**: Deploy and manage restaurant AI agent functions via Supabase MCP
- **Development Workflow**: Create branches, test changes, merge via Supabase MCP
- **Cross-Project Operations**: Use Supabase MCP to compare and sync across multiple projects
- **Performance Monitoring**: Access logs and advisors through Supabase MCP for optimization

### Absolute Rules - DO NOT VIOLATE
- **NEVER create mock/simplified components** - fix existing code
- **NEVER replace complex components** - debug and fix root cause  
- **ALWAYS work with existing codebase** - no new simplified alternatives
- **ALWAYS add explicit TypeScript types** to all parameters and return values
- **Fix all linter/TypeScript errors immediately**
- **USE MCPs strategically** to enhance problem-solving and maintain comprehensive project knowledge
- **USE Supabase MCP for all database operations** - don't use manual CLI commands when MCP can handle it
- **FOCUS ONLY ON ANDROID & iOS** - ignore web development concerns
- **NEVER modify core database schema** without using development branches first
- **ALWAYS test authentication flows** with both guest and authenticated states
- **MAINTAIN backwards compatibility** when updating existing features
- **IMPLEMENT proper error handling** for all network operations
- **USE existing patterns** - don't reinvent solutions for solved problems
