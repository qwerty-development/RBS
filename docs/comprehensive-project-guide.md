# 📱 Plate - Comprehensive Developer Guide

_A complete guide for developers joining the project_

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [Technology Stack](#️-technology-stack)
3. [Architecture & Structure](#️-architecture--structure)
4. [Authentication System](#-authentication-system)
5. [Navigation & Routing](#-navigation--routing)
6. [Core Features](#-core-features)
7. [Data Management](#️-data-management)
8. [UI/UX Design System](#-uiux-design-system)
9. [Development Setup](#-development-setup)
10. [Performance & Security](#-performance--security)
11. [Best Practices](#-best-practices)
12. [Contributing](#-contributing)

---

## 🎯 Project Overview

### What is Plate?

Plate is a mobile application built with React Native and Expo that allows users to discover, book, and manage restaurant reservations. Think of it as a combination of OpenTable and Resy.

### Core Functionality

- **Restaurant Discovery**: Browse and search restaurants with advanced filters
- **Reservation Management**: Make, modify, and cancel bookings
- **User Profiles**: Manage personal preferences, dietary restrictions, and loyalty points
- **Location Services**: Find nearby restaurants using GPS
- **Favorites System**: Save and quick-book favorite restaurants
- **Special Offers**: View and redeem restaurant promotions

### Target Platforms

- iOS (iPhone/iPad)
- Android phones and tablets
- Web (Progressive Web App)

---

## 🛠️ Technology Stack

### Frontend Framework

- **React Native 0.79.2**: Cross-platform mobile development
- **Expo SDK 53**: Development platform and toolchain
- **TypeScript 5.8.3**: Static type checking for JavaScript
- **Expo Router 5.0.7**: File-based navigation system

### Backend & Database

- **Supabase**: Backend-as-a-Service platform
  - PostgreSQL database
  - Real-time subscriptions
  - Authentication & authorization
  - Storage for images
  - Edge Functions for server-side logic

### Styling & UI

- **NativeWind 4.1.23**: Tailwind CSS for React Native
- **Tailwind CSS 3.4.17**: Utility-first CSS framework
- **Lucide React Native**: Consistent icon library
- **React Native Reusables**: shadcn/ui inspired components

### Form Handling & Validation

- **React Hook Form 7.55.0**: Performant form library
- **Zod 3.24.3**: TypeScript-first schema validation
- **@hookform/resolvers**: Connect React Hook Form with Zod

### Device Features

- **Expo Location**: GPS and geocoding services
- **Expo Image**: Optimized image handling
- **React Native Maps**: Interactive maps
- **Expo Secure Store**: Encrypted local storage

### Development Tools

- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting
- **Metro**: React Native bundler
- **TypeScript**: Static type checking

---

## 🏗️ Architecture & Structure

### Project Structure

```
Plate/
├── app/                          # File-based routing (Expo Router)
│   ├── _layout.tsx              # Root layout with auth provider
│   ├── welcome.tsx              # Landing page for unauthenticated users
│   ├── sign-in.tsx              # Login screen
│   ├── sign-up.tsx              # Registration screen
│   ├── (protected)/             # Protected routes (auth required)
│   │   ├── _layout.tsx          # Protected layout with auth guards
│   │   ├── (tabs)/              # Main app with bottom navigation
│   │   │   ├── _layout.tsx      # Tab navigation setup
│   │   │   ├── index.tsx        # Home screen
│   │   │   ├── search.tsx       # Restaurant search
│   │   │   ├── bookings.tsx     # User bookings
│   │   │   ├── favorites.tsx    # Saved restaurants
│   │   │   └── profile.tsx      # User profile
│   │   ├── booking/             # Booking-related screens
│   │   ├── restaurant/          # Restaurant details
│   │   └── profile/             # Profile management
│   └── +not-found.tsx           # 404 page
├── components/                   # Reusable UI components
│   ├── ui/                      # Base UI components
│   │   ├── button.tsx           # Button component
│   │   ├── input.tsx            # Form inputs
│   │   ├── text.tsx             # Typography
│   │   └── ...
│   ├── restaurant/              # Restaurant-specific components
│   ├── booking/                 # Booking-specific components
│   └── home/                    # Home screen components
├── config/                      # Configuration files
│   └── supabase.ts              # Supabase client setup
├── context/                     # React Context providers
│   └── supabase-provider.tsx    # Authentication context
├── hooks/                       # Custom React hooks
│   ├── useRestaurants.ts        # Restaurant data management
│   ├── useBookings.ts           # Booking operations
│   ├── useLocation.ts           # Location services
│   └── ...
├── lib/                         # Utility libraries
│   ├── utils.ts                 # Helper functions
│   └── useColorScheme.ts        # Theme management
├── types/                       # TypeScript type definitions
│   └── supabase.ts              # Database types
├── constants/                   # App constants
│   └── colors.ts                # Color palette
└── docs/                        # Documentation
    └── *.md                     # Various documentation files
```

### Architectural Patterns

#### 1. **Component-Based Architecture**

- Small, reusable components
- Single responsibility principle
- Props-based data flow
- Composition over inheritance

#### 2. **Custom Hooks Pattern**

- Separation of business logic from UI
- Reusable data fetching logic
- Centralized error handling
- Consistent loading states

#### 3. **Context Provider Pattern**

- Global state management
- Authentication state sharing
- Theme and user preferences
- Avoiding prop drilling

---

## 🔐 Authentication System

### Authentication Flow

The app follows this authentication flow:

1. **App Launch** → Check if user session exists
2. **Valid Session** → Load user profile → Navigate to main app
3. **No Session** → Show welcome screen → Sign In/Sign Up
4. **Post Authentication** → Create/load profile → Navigate to main app

### User Data Structure

#### Auth User (Supabase Auth)

```typescript
interface User {
  id: string;
  email: string;
  email_confirmed_at?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}
```

#### User Profile (Custom Table)

```typescript
interface Profile {
  id: string; // Matches auth user ID
  full_name: string;
  phone_number?: string;
  avatar_url?: string;

  // Preferences
  allergies?: string[];
  favorite_cuisines?: string[];
  dietary_restrictions?: string[];
  preferred_party_size?: number;

  // Notifications
  notification_preferences?: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };

  // Loyalty System
  loyalty_points?: number;
  membership_tier?: "bronze" | "silver" | "gold" | "platinum";

  // Timestamps
  created_at?: string;
  updated_at?: string;
}
```

### Authentication Context

The `AuthProvider` manages global authentication state:

```typescript
interface AuthState {
  initialized: boolean; // Has auth check completed?
  session: Session | null; // Current Supabase session
  user: User | null; // Current authenticated user
  profile: Profile | null; // User profile data

  // Methods
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

### Usage in Components

```typescript
function MyComponent() {
  const { user, profile, signOut } = useAuth();

  if (!user) {
    return <Text>Please sign in</Text>;
  }

  return (
    <View>
      <Text>Welcome, {profile?.full_name}!</Text>
      <Button onPress={signOut}>
        <Text>Sign Out</Text>
      </Button>
    </View>
  );
}
```

---

## 🧭 Navigation & Routing

### File-Based Routing

Expo Router uses the file system to define routes:

```
app/
├── _layout.tsx              → Root layout
├── welcome.tsx              → /welcome
├── sign-in.tsx              → /sign-in
├── sign-up.tsx              → /sign-up
└── (protected)/
    ├── _layout.tsx          → Protected layout
    ├── (tabs)/
    │   ├── _layout.tsx      → Tab navigation
    │   ├── index.tsx        → /(protected)/(tabs)/
    │   ├── search.tsx       → /(protected)/(tabs)/search
    │   └── profile.tsx      → /(protected)/(tabs)/profile
    ├── restaurant/
    │   └── [id].tsx         → /(protected)/restaurant/123
    └── modal.tsx            → /(protected)/modal (modal presentation)
```

### Navigation Patterns

#### 1. **Stack Navigation**

- Root level navigation between major sections
- Modal presentations for sign-in/sign-up
- Nested stacks for protected content

#### 2. **Tab Navigation**

- Bottom tab bar for main app sections
- Icons from Lucide React Native
- Theme-aware styling

#### 3. **Route Protection**

```typescript
export default function ProtectedLayout() {
  const { initialized, session, profile } = useAuth();

  // Show loading while checking auth
  if (!initialized) {
    return null;
  }

  // Redirect if not authenticated
  if (!session) {
    return <Redirect href="/welcome" />;
  }

  // Wait for profile to load
  if (!profile) {
    return null; // Or loading spinner
  }

  return <Stack>...</Stack>;
}
```

### Navigation Usage

```typescript
import { useRouter } from "expo-router";

function MyComponent() {
  const router = useRouter();

  const handleNavigate = () => {
    // Navigate to a specific route
    router.push("/restaurant/123");

    // Replace current route (no back button)
    router.replace("/welcome");

    // Go back
    router.back();
  };
}
```

---

## 🚀 Core Features

### 1. Home Screen (`/(protected)/(tabs)/index.tsx`)

#### Key Sections

- **Location Header**: Shows current city/district
- **Featured Restaurants**: High-rated, promoted restaurants
- **Book Again**: Recent bookings for quick rebooking
- **Special Offers**: Time-limited promotions

#### Implementation Highlights

```typescript
export default function HomeScreen() {
  // State management
  const [featuredRestaurants, setFeaturedRestaurants] = useState<Restaurant[]>(
    []
  );
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [location, setLocation] = useState<LocationData | null>(null);

  // Location services
  const requestLocationPermission = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status === "granted") {
      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode for city/district
      const [address] = await Location.reverseGeocodeAsync({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      });

      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        city: address.city || "Unknown",
        district: address.district || "Unknown",
      });
    } else {
      // Fallback to default location (Beirut)
      setLocation({
        latitude: 33.8938,
        longitude: 35.5018,
        city: "Beirut",
        district: "Central District",
      });
    }
  }, []);

  // Data fetching with error handling
  const fetchFeaturedRestaurants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("featured", true)
        .gte("average_rating", 4.0)
        .order("average_rating", { ascending: false })
        .limit(10);

      if (error) throw error;
      setFeaturedRestaurants(data || []);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      Alert.alert("Error", "Unable to load restaurants");
    }
  }, []);
}
```

### 2. Search Screen

#### Features

- Real-time search with debouncing
- Advanced filters (cuisine, price, rating, distance)
- Map view toggle
- Sort options (rating, distance, price)

#### Search Implementation

```typescript
const useRestaurantSearch = () => {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    cuisineTypes: [],
    priceRange: [1, 4],
    minRating: 0,
    maxDistance: 10,
  });

  const debouncedQuery = useMemo(() => debounce(query, 300), [query]);

  const searchRestaurants = useCallback(async () => {
    let supabaseQuery = supabase.from("restaurants").select("*");

    // Apply text search
    if (debouncedQuery) {
      supabaseQuery = supabaseQuery.or(`
        name.ilike.%${debouncedQuery}%,
        cuisine_type.ilike.%${debouncedQuery}%,
        description.ilike.%${debouncedQuery}%
      `);
    }

    // Apply filters
    if (filters.cuisineTypes.length > 0) {
      supabaseQuery = supabaseQuery.in("cuisine_type", filters.cuisineTypes);
    }

    supabaseQuery = supabaseQuery
      .gte("price_range", filters.priceRange[0])
      .lte("price_range", filters.priceRange[1])
      .gte("average_rating", filters.minRating);

    const { data, error } = await supabaseQuery;
    return { data, error };
  }, [debouncedQuery, filters]);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    searchRestaurants,
  };
};
```

### 3. Booking System

#### Booking Flow

1. **Restaurant Selection**: User browses and selects restaurant
2. **Date/Time Selection**: Choose preferred booking slot
3. **Party Size**: Specify number of guests
4. **Special Requests**: Add notes (allergies, celebrations)
5. **Confirmation**: Review and confirm booking

#### Booking Data Structure

```typescript
interface Booking {
  id: string;
  user_id: string;
  restaurant_id: string;
  booking_time: string; // ISO datetime
  party_size: number;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  special_requests?: string;
  total_amount?: number;
  created_at: string;
  updated_at: string;

  // Relations
  restaurant?: Restaurant;
  user?: Profile;
}
```

### 4. Favorites System

#### Implementation

```typescript
const useFavorites = () => {
  const { profile } = useAuth();
  const [favorites, setFavorites] = useState<Restaurant[]>([]);

  const addToFavorites = async (restaurantId: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase.from("favorites").insert({
        user_id: profile.id,
        restaurant_id: restaurantId,
      });

      if (error) throw error;
      await fetchFavorites();
    } catch (error) {
      console.error("Error adding favorite:", error);
    }
  };

  const removeFromFavorites = async (restaurantId: string) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", profile.id)
        .eq("restaurant_id", restaurantId);

      if (error) throw error;
      await fetchFavorites();
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  return {
    favorites,
    addToFavorites,
    removeFromFavorites,
  };
};
```

---

## 💾 Data Management

### Custom Hooks Architecture

The app uses custom hooks to encapsulate data fetching logic:

#### 1. **useRestaurants Hook**

```typescript
export const useRestaurants = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurants = useCallback(async (filters?: RestaurantFilters) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from("restaurants").select("*");

      // Apply filters
      if (filters?.cuisineType) {
        query = query.eq("cuisine_type", filters.cuisineType);
      }

      if (filters?.priceRange) {
        query = query
          .gte("price_range", filters.priceRange[0])
          .lte("price_range", filters.priceRange[1]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRestaurants(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  const getRestaurantById = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      throw new Error(
        err instanceof Error ? err.message : "Restaurant not found"
      );
    }
  }, []);

  return {
    restaurants,
    loading,
    error,
    fetchRestaurants,
    getRestaurantById,
  };
};
```

#### 2. **useBookings Hook**

```typescript
export const useBookings = () => {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  const createBooking = async (bookingData: CreateBookingRequest) => {
    if (!profile) throw new Error("User not authenticated");

    try {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          ...bookingData,
          user_id: profile.id,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh bookings list
      await fetchUserBookings();

      return data;
    } catch (error) {
      throw new Error("Failed to create booking");
    }
  };

  const fetchUserBookings = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          restaurant:restaurants (*)
        `
        )
        .eq("user_id", profile.id)
        .order("booking_time", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  return {
    bookings,
    loading,
    createBooking,
    fetchUserBookings,
  };
};
```

### Database Schema (Supabase)

#### Core Tables

```sql
-- Users profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  avatar_url TEXT,
  allergies TEXT[],
  favorite_cuisines TEXT[],
  dietary_restrictions TEXT[],
  preferred_party_size INTEGER,
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}',
  loyalty_points INTEGER DEFAULT 0,
  membership_tier TEXT DEFAULT 'bronze' CHECK (membership_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- Restaurants
CREATE TABLE restaurants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cuisine_type TEXT NOT NULL,
  price_range INTEGER CHECK (price_range BETWEEN 1 AND 4),
  address TEXT NOT NULL,
  phone_number TEXT,
  email TEXT,
  website_url TEXT,
  main_image_url TEXT,
  image_urls TEXT[],
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT FALSE,
  booking_policy TEXT DEFAULT 'instant' CHECK (booking_policy IN ('instant', 'request')),
  location GEOGRAPHY(POINT, 4326),
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  booking_time TIMESTAMP WITH TIME ZONE NOT NULL,
  party_size INTEGER NOT NULL CHECK (party_size > 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  special_requests TEXT,
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Favorites
CREATE TABLE favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

-- Reviews
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id, booking_id)
);
```

---

## 🎨 UI/UX Design System

### Component Hierarchy

#### 1. **Base UI Components** (`components/ui/`)

These are the foundational building blocks:

```typescript
// Button Component
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  className?: string;
}

// Usage
<Button variant="default" size="lg" onPress={handlePress}>
  <Text>Book Now</Text>
</Button>
```

#### 2. **Typography System**

```typescript
// Typography components with consistent styling
import { H1, H2, H3, H4, P, Large, Small, Muted } from '@/components/ui/typography';

// Usage
<H1>Restaurant Name</H1>
<H2>Menu Highlights</H2>
<P>Restaurant description goes here...</P>
<Muted>Last updated 2 hours ago</Muted>
```

#### 3. **Form Components**

```typescript
// Form setup with React Hook Form + Zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const bookingSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  partySize: z.number().min(1).max(20),
  specialRequests: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

function BookingForm() {
  const { control, handleSubmit, formState: { errors } } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  });

  return (
    <View>
      <FormField
        control={control}
        name="date"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Reservation Date</FormLabel>
            <FormControl>
              <Input placeholder="Select date..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </View>
  );
}
```

### Theme System

#### Color Palette

```typescript
// constants/colors.ts
export const colors = {
  light: {
    background: "#ffffff",
    foreground: "#09090b",
    primary: "#18181b",
    primaryForeground: "#fafafa",
    secondary: "#f4f4f5",
    secondaryForeground: "#18181b",
    muted: "#f4f4f5",
    mutedForeground: "#71717a",
    accent: "#f4f4f5",
    accentForeground: "#18181b",
    destructive: "#ef4444",
    destructiveForeground: "#fafafa",
    border: "#e4e4e7",
    input: "#e4e4e7",
    ring: "#18181b",
  },
  dark: {
    background: "#09090b",
    foreground: "#fafafa",
    primary: "#fafafa",
    primaryForeground: "#18181b",
    secondary: "#27272a",
    secondaryForeground: "#fafafa",
    muted: "#27272a",
    mutedForeground: "#a1a1aa",
    accent: "#27272a",
    accentForeground: "#fafafa",
    destructive: "#7f1d1d",
    destructiveForeground: "#fafafa",
    border: "#27272a",
    input: "#27272a",
    ring: "#d4d4d8",
  },
};
```

#### Theme Usage

```typescript
import { useColorScheme } from '@/lib/useColorScheme';
import { colors } from '@/constants/colors';

function ThemedComponent() {
  const { colorScheme } = useColorScheme();
  const currentColors = colors[colorScheme];

  return (
    <View style={{ backgroundColor: currentColors.background }}>
      <Text style={{ color: currentColors.foreground }}>
        This text adapts to the theme
      </Text>
    </View>
  );
}
```

### Styling with NativeWind

#### Utility Classes

```typescript
// Instead of StyleSheet.create, use Tailwind classes
<View className="flex-1 bg-background p-4">
  <View className="rounded-lg border border-border bg-card p-6">
    <Text className="text-2xl font-bold text-foreground mb-2">
      Restaurant Name
    </Text>
    <Text className="text-muted-foreground mb-4">
      Italian • $$ • 4.5 ⭐
    </Text>
    <Button className="bg-primary">
      <Text className="text-primary-foreground font-semibold">
        Book Now
      </Text>
    </Button>
  </View>
</View>
```

#### Responsive Design

```typescript
// Screen size responsive classes
<View className="p-4 md:p-8 lg:p-12">
  <Text className="text-lg md:text-xl lg:text-2xl">
    Responsive text
  </Text>
</View>
```

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn** package manager
- **Expo CLI** for development
- **iOS Simulator** (macOS only) or **Android Emulator**
- **Supabase Account** for backend services

### Initial Setup

#### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd Plate

# Install dependencies
npm install
# or
yarn install
```

#### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Development settings
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_ENVIRONMENT=development
```

#### 3. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database migrations (see `/database/migrations/`)
3. Configure Row Level Security (RLS) policies
4. Set up authentication providers (email, OAuth)
5. Configure storage buckets for images

#### 4. Start Development Server

```bash
# Start Expo development server
npx expo start

# Or with specific platform
npx expo start --ios
npx expo start --android
npx expo start --web
```

### Development Scripts

```json
{
  "scripts": {
    "start": "expo start",
    "web": "expo start --web",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "lint": "eslint . --fix",
    "type-check": "tsc --noEmit",
    "generate-colors": "node ./scripts/generate-colors.js && eslint ./constants/colors.ts --fix"
  }
}
```

### IDE Setup

#### VS Code Extensions

- **ES7+ React/Redux/React-Native snippets**
- **TypeScript Importer**
- **Tailwind CSS IntelliSense**
- **Prettier - Code formatter**
- **ESLint**
- **Auto Rename Tag**
- **Expo Tools**

#### Settings

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "tailwindCSS.experimental.classRegex": [
    ["className\\s*=\\s*[\"'`]([^\"'`]*)[\"'`]", "([^\"'`]*)"]
  ]
}
```

---

## 🔒 Performance & Security

### Performance Optimizations

#### 1. **Image Optimization**

```typescript
import { Image } from '@/components/image';

// Optimized image loading with caching
<Image
  source={{ uri: restaurant.main_image_url }}
  className="w-full h-48 rounded-lg"
  placeholder="https://via.placeholder.com/400x300"
  priority="high"  // For above-fold images
  recyclingKey={restaurant.id}  // For list performance
/>
```

#### 2. **List Performance**

```typescript
import { FlatList } from 'react-native';

// Optimized list rendering
<FlatList
  data={restaurants}
  renderItem={({ item }) => <RestaurantCard restaurant={item} />}
  keyExtractor={(item) => item.id}
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={10}
  initialNumToRender={5}
  onEndReachedThreshold={0.5}
  onEndReached={loadMoreRestaurants}
/>
```

#### 3. **Memory Management**

```typescript
useEffect(() => {
  // Cleanup subscriptions
  const subscription = supabase
    .from("bookings")
    .on("*", handleBookingChange)
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### Security Best Practices

#### 1. **Row Level Security (RLS)**

```sql
-- Users can only access their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can only view their own bookings
CREATE POLICY "Users can view own bookings" ON bookings
  FOR SELECT USING (auth.uid() = user_id);
```

#### 2. **Input Validation**

```typescript
// Always validate user input with Zod
const createBookingSchema = z.object({
  restaurant_id: z.string().uuid(),
  booking_time: z.string().datetime(),
  party_size: z.number().min(1).max(20),
  special_requests: z.string().max(500).optional(),
});

const createBooking = async (input: unknown) => {
  // Validate input
  const validatedInput = createBookingSchema.parse(input);

  // Proceed with validated data
  const { data, error } = await supabase
    .from("bookings")
    .insert(validatedInput);
};
```

#### 3. **Secure Storage**

```typescript
import * as SecureStore from "expo-secure-store";

// Store sensitive data securely
const storeSecureData = async (key: string, value: string) => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error("Error storing secure data:", error);
  }
};

const getSecureData = async (key: string) => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.error("Error retrieving secure data:", error);
    return null;
  }
};
```

---

## ✨ Best Practices

### Code Organization

#### 1. **Component Structure**

```typescript
// Good component structure
interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
  onFavoriteToggle?: (restaurantId: string) => void;
}

export function RestaurantCard({
  restaurant,
  onPress,
  onFavoriteToggle
}: RestaurantCardProps) {
  // Hooks at the top
  const { addToFavorites, removeFromFavorites } = useFavorites();
  const [imageError, setImageError] = useState(false);

  // Event handlers
  const handlePress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const handleFavoriteToggle = useCallback(() => {
    onFavoriteToggle?.(restaurant.id);
  }, [restaurant.id, onFavoriteToggle]);

  // Render helpers
  const renderRating = () => (
    <View className="flex-row items-center">
      <Text className="font-semibold">
        {restaurant.average_rating.toFixed(1)}
      </Text>
      <Star size={16} className="ml-1 text-yellow-500" />
    </View>
  );

  // Main render
  return (
    <Pressable
      className="bg-card rounded-lg border border-border p-4"
      onPress={handlePress}
    >
      {/* Component content */}
    </Pressable>
  );
}
```

#### 2. **Custom Hooks Pattern**

```typescript
// Encapsulate related logic in custom hooks
export function useRestaurantDetails(restaurantId: string) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurant = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .single();

      if (error) throw error;
      setRestaurant(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    fetchRestaurant();
  }, [fetchRestaurant]);

  return {
    restaurant,
    loading,
    error,
    refetch: fetchRestaurant,
  };
}
```

#### 3. **Error Boundaries**

```typescript
// Global error handling
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to crash reporting service
  }

  render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-lg font-semibold mb-2">
            Something went wrong
          </Text>
          <Text className="text-muted-foreground text-center mb-4">
            We're sorry for the inconvenience. Please try restarting the app.
          </Text>
          <Button onPress={() => this.setState({ hasError: false })}>
            <Text>Try Again</Text>
          </Button>
        </View>
      );
    }

    return this.props.children;
  }
}
```

### Testing Strategy

#### 1. **Component Testing**

```typescript
// __tests__/components/RestaurantCard.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { RestaurantCard } from '@/components/restaurant/RestaurantCard';

const mockRestaurant: Restaurant = {
  id: '1',
  name: 'Test Restaurant',
  cuisine_type: 'Italian',
  average_rating: 4.5,
  // ... other required fields
};

describe('RestaurantCard', () => {
  it('renders restaurant information correctly', () => {
    const { getByText } = render(
      <RestaurantCard restaurant={mockRestaurant} />
    );

    expect(getByText('Test Restaurant')).toBeTruthy();
    expect(getByText('Italian')).toBeTruthy();
    expect(getByText('4.5')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <RestaurantCard
        restaurant={mockRestaurant}
        onPress={onPress}
        testID="restaurant-card"
      />
    );

    fireEvent.press(getByTestId('restaurant-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

#### 2. **Hook Testing**

```typescript
// __tests__/hooks/useRestaurants.test.ts
import { renderHook, waitFor } from "@testing-library/react-native";
import { useRestaurants } from "@/hooks/useRestaurants";

// Mock Supabase
jest.mock("@/config/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

describe("useRestaurants", () => {
  it("fetches restaurants successfully", async () => {
    const { result } = renderHook(() => useRestaurants());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.restaurants).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
```

---

## 🤝 Contributing

### Development Workflow

#### 1. **Branch Strategy**

```bash
# Create feature branch
git checkout -b feature/restaurant-reviews

# Make changes and commit
git add .
git commit -m "Add restaurant review functionality"

# Push and create PR
git push origin feature/restaurant-reviews
```

#### 2. **Commit Message Convention**

```
type(scope): description

feat(auth): add social login with Google
fix(booking): resolve date picker timezone issue
docs(readme): update setup instructions
style(ui): improve button hover states
refactor(hooks): simplify useRestaurants logic
test(auth): add unit tests for login flow
```

#### 3. **Code Review Checklist**

- [ ] Code follows TypeScript best practices
- [ ] Components are properly typed
- [ ] Error handling is implemented
- [ ] Loading states are handled
- [ ] Accessibility considerations
- [ ] Performance implications considered
- [ ] Tests are included for new features
- [ ] Documentation is updated

### Adding New Features

#### 1. **New Screen**

```bash
# Create new screen file
touch app/(protected)/new-feature.tsx

# Add to navigation types
# Update relevant layout files
# Create associated components
# Add tests
```

#### 2. **New Component**

```bash
# Create component directory
mkdir components/new-feature

# Create component files
touch components/new-feature/NewComponent.tsx
touch components/new-feature/index.ts

# Add to main components export
# Create Storybook story (if applicable)
# Add tests
```

#### 3. **New Hook**

```bash
# Create hook file
touch hooks/useNewFeature.ts

# Add to hooks index
# Create tests
# Update documentation
```

### Deployment

#### 1. **Development Build**

```bash
# Create development build
npx expo build:android --type apk
npx expo build:ios --type simulator
```

#### 2. **Production Build**

```bash
# Create production build
npx expo build:android --type app-bundle
npx expo build:ios --type archive

# Submit to stores
npx expo upload:android
npx expo upload:ios
```

#### 3. **Over-the-Air Updates**

```bash
# Publish updates without app store review
npx expo publish --release-channel production
```

---

## 📚 Additional Resources

### Documentation Links

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [NativeWind Documentation](https://www.nativewind.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)

### Community Resources

- [React Native Community](https://github.com/react-native-community)
- [Expo Discord](https://discord.gg/expo)
- [Supabase Discord](https://discord.supabase.com/)

### Learning Path for New Developers

1. **JavaScript/TypeScript Fundamentals**
2. **React Fundamentals**
3. **React Native Basics**
4. **Expo Platform**
5. **State Management with Hooks**
6. **Backend Integration with Supabase**
7. **Testing React Native Apps**
8. **Performance Optimization**

---