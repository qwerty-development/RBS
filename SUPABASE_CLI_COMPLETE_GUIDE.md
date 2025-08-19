# 📚 Complete Supabase CLI Integration Guide

## 🎯 Overview

This guide covers the complete setup and workflow for integrating Supabase CLI into your React Native project, enabling professional database development with local development, schema management, and safe production deployments.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Schema Migration from Remote to Local](#schema-migration)
4. [Local to Remote Development Workflow](#development-workflow)
5. [Team Collaboration](#team-collaboration)
6. [Commands Reference](#commands-reference)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## 🔧 Prerequisites

### Required Software
- **Docker Desktop** - Running and accessible
- **Node.js** - For npm/npx commands
- **Git** - For version control
- **Existing Supabase Project** - Remote instance already set up

### Project Requirements
- React Native/Expo project
- Existing Supabase configuration in `config/supabase.ts`

---

## 🚀 Initial Setup

### Step 1: Install Supabase CLI

The Supabase CLI is available through `npx` (no global installation needed):

```bash
# Test CLI availability
npx supabase --version
```

### Step 2: Initialize Supabase in Your Project

```bash
# Initialize Supabase configuration
npx supabase init
```

**What this creates:**
- `supabase/config.toml` - Main configuration file
- `supabase/` directory structure

### Step 3: Authenticate with Supabase

```bash
# Login to your Supabase account
npx supabase login
```

This will open a browser window for authentication.

### Step 4: Link Your Remote Project

Find your project reference ID in your Supabase dashboard URL or config, then:

```bash
# Link to your remote project (replace with your project ID)
npx supabase link --project-ref YOUR_PROJECT_REF_ID
```

**Example:**
```bash
npx supabase link --project-ref xsovqvbigdettnpeisjs
```

### Step 5: Add NPM Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "supabase:start": "npx supabase start",
    "supabase:stop": "npx supabase stop",
    "supabase:status": "npx supabase status",
    "supabase:reset": "npx supabase db reset",
    "supabase:migrate": "npx supabase db push",
    "supabase:pull": "npx supabase db pull",
    "supabase:diff": "npx supabase db diff",
    "supabase:gen-types": "npx supabase gen types typescript --local > types/supabase-local.ts",
    "supabase:functions:serve": "npx supabase functions serve",
    "supabase:functions:deploy": "npx supabase functions deploy"
  }
}
```

---

## 📊 Schema Migration from Remote to Local

This section shows how to copy your complete production database schema to your local development environment.

### Step 1: Ensure Docker is Running

```bash
# Check Docker status
docker info
```

If Docker isn't running, start Docker Desktop.

### Step 2: Pull Remote Schema

```bash
# Pull complete schema from remote (public, auth, storage)
npm run supabase:pull
```

**This creates:**
- Migration files with your complete schema
- All tables, functions, policies, and relationships

### Step 3: Start Local Development Environment

```bash
# Start local Supabase stack
npm run supabase:start
```

**What this starts:**
- PostgreSQL database (localhost:54322)
- Supabase Studio (http://127.0.0.1:54323)
- API server (http://127.0.0.1:54321)
- Email testing (http://127.0.0.1:54324)

### Step 4: Verify Schema Migration

```bash
# Check that local matches remote
npm run supabase:diff
```

**Expected output:** `No schema changes found` ✅

### Step 5: Generate TypeScript Types

```bash
# Generate types from local database
npm run supabase:gen-types
```

**Result:** Fresh TypeScript types in `types/supabase-local.ts`

---

## 🔄 Local to Remote Development Workflow

This is the core workflow for making database changes and deploying them to production.

### Method 1: Direct Change + Migration (Recommended)

#### Step 1: Make Changes Locally

**Option A: Using Supabase Studio**
1. Open http://127.0.0.1:54323
2. Navigate to your table
3. Make changes via UI

**Option B: Using Direct SQL**
```bash
# Connect to local database
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# Make your changes
ALTER TABLE profiles ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

#### Step 2: Check What Changed

```bash
# See differences between local and remote
npm run supabase:diff
```

**Example output:**
```sql
alter table "public"."profiles" add column "last_login_at" timestamp with time zone default now();
```

#### Step 3: Create Migration File

```bash
# Create named migration from your changes
npx supabase migration new add_user_last_login_tracking
```

**This creates:** `supabase/migrations/[timestamp]_add_user_last_login_tracking.sql`

#### Step 4: Review Migration File

Edit the generated migration file to add:
- Comments explaining the change
- Any additional constraints or indexes
- Rollback instructions (as comments)

**Example:**
```sql
-- Add last login tracking to profiles table
ALTER TABLE public.profiles ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.last_login_at IS 'Timestamp when user last logged into the application';

-- Optional: Add index for performance
-- CREATE INDEX idx_profiles_last_login_at ON public.profiles(last_login_at);

-- ROLLBACK (for reference):
-- ALTER TABLE public.profiles DROP COLUMN last_login_at;
```

#### Step 5: Deploy to Production

```bash
# Push migration to remote database
npm run supabase:migrate
```

**This will:**
- Show you what migrations will be applied
- Ask for confirmation
- Apply changes to production database

#### Step 6: Update Types and Verify

```bash
# Generate fresh types from local DB
npm run supabase:gen-types

# Generate types from production DB (optional)
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase-production.ts

# Verify everything is in sync
npm run supabase:diff
```

**Expected:** `No schema changes found` ✅

### Method 2: Migration-First Approach

#### Step 1: Create Migration File First

```bash
# Create new migration file
npx supabase migration new add_user_preferences_table
```

#### Step 2: Write SQL in Migration File

Edit `supabase/migrations/[timestamp]_add_user_preferences_table.sql`:

```sql
-- Create user preferences table
CREATE TABLE public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    notifications_enabled BOOLEAN DEFAULT true,
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

#### Step 3: Apply Locally First

```bash
# Reset local DB to apply new migration
npm run supabase:reset
```

#### Step 4: Test Locally

- Verify table structure in Studio
- Test insert/update operations
- Verify RLS policies work

#### Step 5: Deploy to Production

```bash
# Push to remote when ready
npm run supabase:migrate
```

---

## 👥 Team Collaboration

### For Team Members Joining the Project

#### Initial Setup for New Developer

```bash
# 1. Clone the repository
git clone [your-repo-url]
cd [project-directory]

# 2. Install dependencies
npm install

# 3. Authenticate with Supabase
npx supabase login

# 4. Link to the shared project
npx supabase link --project-ref YOUR_PROJECT_REF_ID

# 5. Start local development
npm run supabase:start

# 6. Generate types
npm run supabase:gen-types
```

### Daily Development Workflow

#### Starting Work

```bash
# 1. Get latest code
git pull origin main

# 2. Sync any new database changes
npm run supabase:pull
npm run supabase:reset

# 3. Start local services
npm run supabase:start

# 4. Generate fresh types
npm run supabase:gen-types
```

#### Making Database Changes

```bash
# 1. Make changes locally first
# 2. Create migration
npx supabase migration new [descriptive-name]

# 3. Test locally
npm run supabase:reset

# 4. Commit migration file
git add supabase/migrations/
git commit -m "Add [feature] database changes"

# 5. Push code first
git push origin feature-branch

# 6. After PR approval, deploy database changes
npm run supabase:migrate
```

### Handling Migration Conflicts

If multiple developers create migrations:

```bash
# 1. Pull latest migrations
git pull origin main

# 2. Reset local database to apply all migrations in order
npm run supabase:reset

# 3. Check for conflicts
npm run supabase:diff

# 4. If conflicts exist, create a new migration to resolve them
npx supabase migration new resolve_migration_conflicts
```

---

## 📖 Commands Reference

### Core Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run supabase:start` | Start local development stack | Beginning of dev session |
| `npm run supabase:stop` | Stop local services | End of dev session |
| `npm run supabase:status` | Check running services | Troubleshooting |
| `npm run supabase:reset` | Reset local DB to migration state | After pulling new migrations |

### Database Management

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run supabase:diff` | Show local vs remote differences | Before pushing changes |
| `npm run supabase:pull` | Pull remote schema to local | Sync with remote changes |
| `npm run supabase:migrate` | Push local changes to remote | Deploy to production |
| `npm run supabase:gen-types` | Generate TypeScript types | After schema changes |

### Migration Management

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npx supabase migration new [name]` | Create new migration file | After making schema changes |
| `npx supabase migration list` | List all migrations | Check migration status |
| `npx supabase db diff create [name]` | Create migration from current diff | Auto-generate from changes |

### Advanced Commands

| Command | Purpose |
|---------|---------|
| `npx supabase gen types typescript --project-id [id] > types/remote.ts` | Generate types from remote DB |
| `npx supabase db dump --data-only > backup.sql` | Export data |
| `npx supabase functions new [name]` | Create new Edge Function |
| `npx supabase secrets set [name] [value]` | Set environment secrets |

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. "Docker not running" Error

**Problem:** `Error: Docker not running`

**Solution:**
```bash
# Start Docker Desktop application
# Wait for it to fully start, then:
npm run supabase:start
```

#### 2. Port Already in Use

**Problem:** `Port 54321 already in use`

**Solution:**
```bash
# Stop all Supabase services
npm run supabase:stop

# Check for remaining processes
docker ps | grep supabase

# Force remove if needed
docker stop $(docker ps -q --filter "name=supabase")
npm run supabase:start
```

#### 3. Migration Conflicts

**Problem:** Migrations applied out of order

**Solution:**
```bash
# Stop services
npm run supabase:stop

# Remove migration history
rm -rf .local/supabase

# Start fresh and reapply all migrations
npm run supabase:start
```

#### 4. Schema Sync Issues

**Problem:** Local and remote out of sync

**Solution:**
```bash
# Pull latest remote schema
npm run supabase:pull

# Reset local database
npm run supabase:reset

# Verify sync
npm run supabase:diff
```

#### 5. TypeScript Type Errors

**Problem:** Generated types don't match actual schema

**Solution:**
```bash
# Regenerate types from local DB
npm run supabase:gen-types

# Or regenerate from remote DB
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/supabase-remote.ts
```

### Environment-Specific Issues

#### Windows Users

```bash
# Use Git Bash or WSL for better compatibility
# Ensure Docker Desktop is running in Windows mode
```

#### macOS Users

```bash
# Install Docker Desktop for Mac
# Ensure it has sufficient memory allocation (4GB+)
```

#### Linux Users

```bash
# Install Docker Engine
sudo apt-get update
sudo apt-get install docker.io
sudo usermod -aG docker $USER
```

---

## ⭐ Best Practices

### Database Development

#### 1. Always Test Locally First

```bash
# ✅ Good workflow:
# 1. Make changes locally
# 2. Test thoroughly
# 3. Create migration
# 4. Deploy to production

# ❌ Never do:
# - Make changes directly in production
# - Skip local testing
```

#### 2. Use Descriptive Migration Names

```bash
# ✅ Good names:
add_user_preferences_table
update_booking_status_enum
fix_user_profile_constraints

# ❌ Bad names:
new_migration
fix_stuff
update
```

#### 3. Include Rollback Instructions

```sql
-- ✅ Good migration file:
-- Add user email verification tracking
ALTER TABLE profiles ADD COLUMN email_verified_at TIMESTAMP WITH TIME ZONE;

-- ROLLBACK (for emergency use):
-- ALTER TABLE profiles DROP COLUMN email_verified_at;
```

#### 4. Keep Migrations Small and Focused

```bash
# ✅ Good: One migration per logical change
add_user_avatar_column
update_booking_table_indexes
add_notification_preferences

# ❌ Bad: One migration with multiple unrelated changes
massive_schema_update
```

### Team Collaboration

#### 1. Always Pull Before Making Changes

```bash
# ✅ Start of day routine:
git pull origin main
npm run supabase:pull
npm run supabase:reset
```

#### 2. Commit Migrations with Code Changes

```bash
# ✅ Commit together:
git add supabase/migrations/[new-migration].sql
git add [related-code-changes]
git commit -m "Add user preferences feature with database schema"
```

#### 3. Deploy Database Changes After Code Deployment

```bash
# ✅ Deployment order:
# 1. Deploy code to staging/production
# 2. Test code with existing schema
# 3. Deploy database migrations
# 4. Verify everything works
```

### Development Environment

#### 1. Use Environment-Specific Configurations

```typescript
// config/supabase.ts
const supabaseUrl = process.env.NODE_ENV === 'development' 
  ? 'http://127.0.0.1:54321'  // Local development
  : 'https://your-project.supabase.co'  // Production

const supabaseAnonKey = process.env.NODE_ENV === 'development'
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // Local anon key
  : 'your-production-anon-key'
```

#### 2. Seed Your Local Database

Create `supabase/seed.sql`:

```sql
-- Insert test data for local development
INSERT INTO profiles (user_id, username, full_name) VALUES
('test-user-1', 'testuser1', 'Test User One'),
('test-user-2', 'testuser2', 'Test User Two');

INSERT INTO restaurants (name, description, cuisine_type) VALUES
('Test Restaurant 1', 'Great local testing venue', 'Italian'),
('Test Restaurant 2', 'Another test place', 'French');
```

#### 3. Use Different Databases for Different Purposes

```bash
# Local development
npm run supabase:start

# Testing
npm run supabase:start -- --db-name testing

# Feature branch testing
npm run supabase:start -- --db-name feature-xyz
```

### Security and Maintenance

#### 1. Regularly Update CLI

```bash
# Check for updates
npx supabase --version

# CLI will notify you of available updates
# Update by using the latest npx version (automatic)
```

#### 2. Backup Before Major Changes

```bash
# Create backup before big migrations
npx supabase db dump > backup-$(date +%Y%m%d).sql
```

#### 3. Monitor Migration Performance

```bash
# Time your migrations
time npm run supabase:migrate

# Check migration impact on large tables
EXPLAIN ANALYZE ALTER TABLE large_table ADD COLUMN new_col TEXT;
```

---

## 📈 Advanced Workflows

### Feature Branch Database Development

```bash
# 1. Create feature branch
git checkout -b feature/user-preferences

# 2. Make database changes locally
# 3. Create migration
npx supabase migration new add_user_preferences

# 4. Commit migration with feature code
git add supabase/migrations/
git add [feature-files]
git commit -m "Add user preferences feature"

# 5. Push for review
git push origin feature/user-preferences

# 6. After merge, deploy database changes
git checkout main
git pull origin main
npm run supabase:migrate
```

### Rollback Procedures

#### Code Rollback (if database migration already deployed)

```bash
# 1. If migration is compatible with old code, keep it
# 2. If not, create rollback migration
npx supabase migration new rollback_user_preferences

# In the migration file:
ALTER TABLE profiles DROP COLUMN preference_data;
```

#### Emergency Database Rollback

```bash
# 1. Create immediate rollback migration
npx supabase migration new emergency_rollback_[issue]

# 2. Apply rollback SQL
# 3. Deploy immediately
npm run supabase:migrate
```

---

## 🎓 Learning Resources

### Official Documentation
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Database Migrations Guide](https://supabase.com/docs/guides/cli/local-development)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

### Key Concepts to Master
1. **PostgreSQL Fundamentals** - Tables, indexes, constraints
2. **Row Level Security (RLS)** - Supabase's security model
3. **Migration Management** - Version control for databases
4. **TypeScript Integration** - Type-safe database operations

### Practice Exercises
1. Create a simple table with RLS policies
2. Practice adding columns with migrations
3. Create a complex join query and optimize it
4. Set up a complete feature with database + frontend code

---

## 📞 Getting Help

### When Something Goes Wrong

1. **Check the logs:**
   ```bash
   npm run supabase:status
   docker logs supabase_db_[project]
   ```

2. **Reset environment:**
   ```bash
   npm run supabase:stop
   npm run supabase:start
   ```

3. **Ask for help with context:**
   - What command you ran
   - Full error message
   - Your operating system
   - What you were trying to achieve

### Community Resources
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Discussions](https://github.com/supabase/supabase/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)

---

## 📝 Summary

You now have a complete, professional database development workflow with:

✅ **Local Development Environment** - Complete Supabase stack running locally  
✅ **Schema Management** - Version-controlled database changes  
✅ **Safe Deployments** - Test locally, deploy to production  
✅ **Type Safety** - Auto-generated TypeScript types  
✅ **Team Collaboration** - Shared workflows and conflict resolution  
✅ **Enterprise-Grade Practices** - Migration management and rollback procedures  

**Next Steps:**
1. Practice the workflow with simple changes
2. Set up your team members with this guide
3. Establish deployment procedures for your project
4. Start building features with confidence!

---

*Happy coding! 🚀*
