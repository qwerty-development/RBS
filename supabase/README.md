# Supabase Local Development

This directory contains your Supabase configuration and development files.

## Quick Start

1. **Start local Supabase services:**
   ```bash
   npm run supabase:start
   ```

2. **Check status of services:**
   ```bash
   npm run supabase:status
   ```

3. **Access local services:**
   - Studio UI: http://localhost:54323
   - API: http://localhost:54321
   - Database: postgresql://postgres:postgres@localhost:54322/postgres

## Available Commands

### Database Management
- `npm run supabase:reset` - Reset local database to match remote
- `npm run supabase:migrate` - Push local migrations to remote
- `npm run supabase:pull` - Pull remote schema changes to local
- `npm run supabase:diff` - Show differences between local and remote

### Development
- `npm run supabase:gen-types` - Generate TypeScript types from database schema
- `npm run supabase:functions:serve` - Run Edge Functions locally
- `npm run supabase:functions:deploy` - Deploy Edge Functions to remote

### Service Management
- `npm run supabase:start` - Start all local services
- `npm run supabase:stop` - Stop all local services
- `npm run supabase:status` - Show status of all services

## Directory Structure

```
supabase/
├── config.toml          # Supabase configuration
├── migrations/          # Database migrations
├── functions/          # Edge Functions
├── seed.sql            # Seed data for local development
└── README.md           # This file
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your project values:

```bash
cp .env.example .env.local
```

## Migration Workflow

1. Make changes to your remote database via Studio UI or SQL
2. Pull changes locally: `npm run supabase:pull`
3. Test changes locally: `npm run supabase:start`
4. Commit migration files to version control

## Edge Functions

Edge Functions are located in `supabase/functions/`. To create a new function:

```bash
npx supabase functions new function-name
```

To deploy a specific function:
```bash
npx supabase functions deploy function-name
```

## Troubleshooting

- If services fail to start, check if ports are already in use
- Reset everything: `npm run supabase:stop && npm run supabase:start`
- Check logs: Look at the terminal output when running commands
