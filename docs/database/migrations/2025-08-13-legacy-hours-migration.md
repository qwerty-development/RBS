# Legacy hours columns migration

This migration relaxes legacy columns on restaurants so the app can rely solely on the shift-based system (restaurant_hours + restaurant_special_hours + restaurant_closures).

## SQL

File: supabase/migrations/20250813_remove_legacy_open_close.sql

- Makes `opening_time` and `closing_time` nullable (safe path)
- Includes commented out lines to drop columns later if fully unused

## Steps

1. Apply migration

```bash
supabase db push   # or your usual migration apply command
```

2. Regenerate types and update

```bash
# If you are using supabase CLI codegen
supabase gen types typescript --project-id <YOUR_PROJECT_ID> --schema public > types/supabase.ts

# OR if using your script
npm run generate:types
```

3. Verify
- Run npm run type-check
- Run the app; ensure all hours displays are shift-based

## Rollback
- Revert the migration file or restore from backup if needed.

