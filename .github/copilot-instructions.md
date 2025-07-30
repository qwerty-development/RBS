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
npm run type-check    # TypeScript checking
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

## 🔐 Authentication & Data Patterns

### Supabase Integration
- **Custom SecureStorage class** with memory fallback
- **Row Level Security** enforced on all tables
- **Guest mode support** (useGuestGuard hook)
- **Auto-refresh tokens** with PKCE flow

### Database Access Pattern
```tsx
// Always use typed queries
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    restaurant:restaurants(*)
  `)
  .eq('user_id', userId);
```

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
- `expo-secure-store` for auth tokens
- `expo-notifications` for booking updates

### Navigation Pattern
```tsx
// File-based routing with protection
app/(protected)/bookings.tsx  // Requires auth
app/sign-in.tsx              // Public route
```

## 🤖 AI Integration

**Restaurant assistant** at `/ai/AI_Agent.py`:
- LangChain + Google Generative AI
- Specialized for restaurant recommendations
- Custom response format: `RESTAURANTS_TO_SHOW: id1,id2,id3`
- Direct Supabase integration for restaurant data

## ⚠️ Common Patterns & Gotchas

### Type Safety
- **Generate types** from Supabase schema regularly
- **Database type**: Use `Database["public"]["Tables"]["table_name"]["Row"]`
- **Compound types**: Restaurant + booking joins are common

### Performance
- **Optimized lists** with `useOptimizedList` hook
- **Image optimization** with expo-image's `contentFit`
- **Debounced search** for restaurant filtering
- **Background network monitoring** with state persistence

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
