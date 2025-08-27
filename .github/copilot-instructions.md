# TableReserve (Plate) - AI Coding Agent Instructions

## 🏗️ Architecture Overview

React Native + Expo restaurant booking app with sophisticated business logic:

**Core Stack:**
- **Expo Router** - File-based routing (`/app` directory)
- **Supabase** - Auth + PostgreSQL with PostGIS
- **Zustand** - State management with persistence + subscriptions
- **NativeWind** - Tailwind CSS for React Native
- **TypeScript** - Full type safety throughout

**Target Platforms:**
- **Android & iOS ONLY** - No web development required
- Focus on native mobile experience and performance
- Optimize for mobile-specific features (camera, location, notifications)

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

## 🧠 MCP (Model Context Protocol) Integration

### Available MCPs & Usage Patterns

**Sequential Thinking MCP** - For complex problem solving:
- Use when breaking down multi-step development tasks
- Planning architecture changes or refactoring approaches
- Debugging complex business logic issues
- Analyzing performance bottlenecks with step-by-step reasoning
- Planning database migrations or schema changes

**Knowledge Graph Memory MCP** - For project knowledge & relationship mapping:
- Store important architectural decisions and their reasoning
- Track component dependencies and relationships
- Map data flow through the application
- Document complex business rules and edge cases
- Track debugging solutions for recurring issues
- Understand database relationship impacts
- Document API integration patterns

**Memory Bank MCP** - For document storage & detailed knowledge retention:
- Store comprehensive documentation and guides
- Archive code examples and implementation patterns
- Maintain project-specific best practices
- Document complex debugging solutions with full context
- Store performance optimization strategies and results
- Keep detailed architectural decision records

**Supabase MCP** - For complete database & backend operations:
- Execute SQL queries across ALL Supabase projects (read/write/schema)
- Deploy and manage Edge Functions on any project
- Create/delete/manage Supabase projects and organizations
- Handle database migrations and schema changes
- Manage storage buckets and file operations
- Access logs and debugging information across all services
- Generate TypeScript types from database schemas
- Manage development branches and production deployments
- Cross-project data operations and comparisons

**Playwright MCP** - For web automation, testing & browser tasks:
- Testing admin dashboards and web-based management tools
- Automating restaurant data collection from external sources
- Testing web integrations (payment gateways, maps) in browser environment
- Generating PDF reports from web views
- Testing web-based authentication flows
- Capturing screenshots for documentation
- Validating accessibility compliance of admin tools

*Note: Focus on web tools that support mobile development, not mobile web apps*

### MCP Configuration Paths

**Knowledge Graph Memory MCP:**
```json
"memory": {
    "command": "npx",
    "args": ["-y", "@itseasy21/mcp-knowledge-graph"],
    "env": {"MEMORY_FILE_PATH": "/Users/asifalam/.mcp/knowledge-graph.jsonl"},
    "type": "stdio"
}
```

**Memory Bank MCP:**
```json
"allpepper-memory-bank": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@allpepper/memory-bank-mcp@0.2.1"],
    "env": {"MEMORY_BANK_ROOT": "/Users/asifalam/.mcp/memory-bank"}
}
```

**Supabase MCP (Maximum Configuration):**
```json
"supabase": {
    "command": "npx",
    "args": ["-y", "@supabase/mcp-server-supabase@latest", "--features=account,docs,database,debug,development,functions,branching,storage"],
    "env": {"SUPABASE_ACCESS_TOKEN": "${input:supabase-access-token}"},
    "type": "stdio"
}
```

### Smart MCP Usage Guidelines

**When to Use Sequential Thinking:**
```
✅ Planning multi-file refactoring
✅ Debugging complex state management issues  
✅ Architecting new feature implementations
✅ Analyzing performance bottlenecks
✅ Planning database schema changes
```

**When to Use Knowledge Graph Memory:**
```
✅ After solving complex bugs - store entities and relationships
✅ When implementing new patterns - document component relationships
✅ After performance optimizations - record optimization strategies
✅ When making architectural decisions - store reasoning and impacts
✅ Track dependencies between components and data flows
```

**When to Use Supabase MCP:**
```
✅ Database schema analysis and modifications
✅ Real-time data querying and manipulation
✅ Edge Function deployment and testing
✅ Database migration planning and execution
✅ Cross-project data comparisons
✅ Storage bucket management for app assets
✅ Debugging database performance issues
✅ TypeScript type generation from schema
✅ Development branch management
✅ Production deployment workflows
```

**When to Use Memory Bank:**
```
✅ Store detailed documentation and implementation guides
✅ Archive comprehensive debugging solutions with full context
✅ Document complex feature implementations with code examples
✅ Maintain project-specific patterns and conventions
✅ Store performance optimization results and analysis
```

**When to Use Playwright:**
```
✅ Testing admin dashboards and management tools
✅ Automating restaurant data collection from external websites
✅ Testing payment gateway integrations in browser
✅ Validating web-based authentication flows
✅ Generating documentation screenshots and PDFs
✅ Testing map integrations and external APIs
```

### Strategic MCP Workflow Integration

**Before Starting Complex Tasks:**
1. **Sequential Thinking** → Break down the problem into manageable steps
2. **Knowledge Graph Memory** → Check for existing related entities and relationships
3. **Memory Bank** → Search for similar past solutions and patterns
4. **Supabase MCP** → Analyze current database state and schema

**During Database Development:**
- **Supabase MCP** → Execute queries, modify schema, deploy functions
- **Store insights** in Knowledge Graph Memory as entities emerge
- **Document patterns** in Memory Bank for future reference
- **Use Playwright** to test external integrations and gather data

**For Database Operations:**
- **Supabase MCP** → Primary tool for all database interactions
- **Sequential Thinking** → Plan complex migrations and schema changes
- **Knowledge Graph Memory** → Document table relationships and business rules
- **Memory Bank** → Store migration scripts and database patterns

**After Completing Features:**
- **Create entities** in Knowledge Graph Memory for new components and relationships
- **Store comprehensive documentation** in Memory Bank with implementation details
- **Record database changes** and optimization strategies using Supabase MCP
- **Update TypeScript types** using Supabase MCP type generation

### Proactive MCP Usage Patterns

**Always Use Sequential Thinking For:**
- Planning new feature implementations (booking flow, loyalty system)
- Debugging complex state management issues in Zustand stores
- Architecting database schema changes and migrations
- Analyzing performance bottlenecks and optimization strategies
- Planning refactoring approaches for large components

**Always Use Supabase MCP For:**
- **Database Schema Operations**: Creating/modifying tables, indexes, constraints
- **Data Queries**: Complex SELECT, INSERT, UPDATE, DELETE operations
- **Edge Function Management**: Deploying restaurant AI agent functions
- **Type Generation**: Keeping TypeScript types in sync with database schema
- **Migration Management**: Planning and executing database migrations
- **Development Branches**: Creating isolated environments for testing
- **Cross-Project Analysis**: Comparing schemas/data across multiple projects
- **Storage Management**: Handling restaurant images and file uploads
- **Performance Monitoring**: Accessing database logs and performance metrics

**Automatically Store in Knowledge Graph Memory:**
- Component relationships and dependencies
- Data flow patterns through the application
- Business rule entities and their connections (booking rules, loyalty points)
- API integration patterns and relationships
- Database table relationships and foreign key constraints
- Performance optimization strategies and their impacts

**Automatically Store in Memory Bank:**
- Detailed implementation guides for complex features
- Comprehensive debugging solutions with full context
- Database migration scripts and rollback procedures
- Code examples and reusable patterns
- Architecture decision records with reasoning
- Performance benchmarks and optimization results

**Use Playwright Strategically For:**
- Testing restaurant data scraping from external sources
- Validating payment gateway integrations
- Testing map provider APIs (Google Maps, etc.)
- Generating reports and documentation artifacts
- Testing admin panel workflows and authentication

## ⚠️ Critical Development Rules

### Type Safety
- **Always generate types** from Supabase schema: Use Supabase MCP for `generate_typescript_types`
- **Use database types**: `Database["public"]["Tables"]["table_name"]["Row"]`
- **Reference `db/schema.sql`** and use Supabase MCP to analyze current schema before writing queries

### Database Operations
- **Use Supabase MCP for all database operations** instead of manual CLI commands
- **Use `execute_sql` for queries** and `apply_migration` for schema changes
- **Always check logs** with Supabase MCP after database operations
- **Use development branches** via Supabase MCP for testing schema changes
- **Generate fresh types** after any schema modifications using Supabase MCP

### Performance & Patterns
- **Use NativeWind classes**, not StyleSheet.create
- **Network-aware requests** with `useNetworkAwareRequest` for offline handling
- **Debounced search** for restaurant filtering
- **PostGIS location queries** for proximity searches
- **Image optimization** with expo-image's `contentFit`

### MCP Integration Rules
- **Use Sequential Thinking** for complex multi-step problems before coding
- **Store solutions in Knowledge Graph Memory** for relationships and entities
- **Store detailed documentation in Memory Bank** for comprehensive records
- **Use Playwright** for web automation, testing, and browser-based tasks
- **Document architectural decisions** using both memory systems as appropriate
- **Leverage MCPs proactively** - don't wait to be asked

### Strategic MCP Workflow Integration

**Before Starting Complex Tasks:**
1. **Sequential Thinking** → Break down the problem into manageable steps
2. **Knowledge Graph Memory** → Check for existing related entities and relationships
3. **Memory Bank** → Search for similar past solutions and patterns

**During Development:**
- **Store intermediate insights** in Knowledge Graph Memory as entities emerge
- **Document complex patterns** in Memory Bank for future reference
- **Use Playwright** to test external integrations and gather data

**After Completing Features:**
- **Create entities** in Knowledge Graph Memory for new components and relationships
- **Store comprehensive documentation** in Memory Bank with implementation details
- **Record performance insights** and optimization strategies in both systems

### Proactive MCP Usage Patterns

**Always Use Sequential Thinking For:**
- Planning new feature implementations (booking flow, loyalty system)
- Debugging complex state management issues in Zustand stores
- Architecting database schema changes and migrations
- Analyzing performance bottlenecks and optimization strategies
- Planning refactoring approaches for large components

**Automatically Store in Knowledge Graph Memory:**
- Component relationships and dependencies
- Data flow patterns through the application
- Business rule entities and their connections
- API integration patterns and relationships
- Performance optimization strategies and their impacts

**Automatically Store in Memory Bank:**
- Detailed implementation guides for complex features
- Comprehensive debugging solutions with full context
- Code examples and reusable patterns
- Architecture decision records with reasoning
- Performance benchmarks and optimization results

**Use Playwright Strategically For:**
- Testing restaurant data scraping from external sources
- Validating payment gateway integrations
- Testing map provider APIs (Google Maps, etc.)
- Generating reports and documentation artifacts
- Testing admin panel workflows and authentication

### Absolute Rules - DO NOT VIOLATE
- **NEVER create mock/simplified components** - fix existing code
- **NEVER replace complex components** - debug and fix root cause  
- **ALWAYS work with existing codebase** - no new simplified alternatives
- **ALWAYS add explicit TypeScript types** to all parameters and return values
- **Fix all linter/TypeScript errors immediately**
- **USE MCPs strategically** to enhance problem-solving and maintain comprehensive project knowledge
- **USE Supabase MCP for all database operations** - don't use manual CLI commands when MCP can handle it
- **FOCUS ONLY ON ANDROID & iOS** - ignore web development concerns

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
