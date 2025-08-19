# 🚀 Local to Remote Deployment Workflow

## 📋 **The Complete Workflow**

Here's your **professional database development workflow** for making changes locally and deploying them to production:

### **Method 1: Direct Push (Simple Changes)**

```bash
# 1. Make changes locally (via Studio UI or direct SQL)
# 2. Check what changed
npm run supabase:diff

# 3. Push changes to remote
npm run supabase:migrate

# 4. Update production types
npx supabase gen types typescript --project-id xsovqvbigdettnpeisjs > types/supabase-production.ts
```

### **Method 2: Migration-First (Recommended)**

```bash
# 1. Create a new migration
npx supabase migration new add_user_preferences

# 2. Edit the migration file with your changes
# 3. Test locally
npm run supabase:reset

# 4. Push to remote when ready
npm run supabase:migrate

# 5. Update types
npm run supabase:gen-types
```

## 🛠️ **Available Commands**

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run supabase:diff` | Show differences between local & remote | Before pushing changes |
| `npm run supabase:migrate` | Push local changes to remote | Deploy to production |
| `npm run supabase:pull` | Pull remote changes to local | Sync with team changes |
| `npm run supabase:reset` | Reset local DB to migration state | Test migrations |
| `npm run supabase:gen-types` | Generate types from local DB | After local changes |

## 🔄 **Step-by-Step Example**

### **Scenario: Adding a new column to users table**

**Step 1: Make the change locally**
- Open Studio UI: http://127.0.0.1:54323
- Navigate to `profiles` table  
- Add column: `theme_preference TEXT DEFAULT 'light'`

**Step 2: Check what changed**
```bash
npm run supabase:diff
```

**Step 3: Create migration (if needed)**
```bash
npx supabase db diff create add_theme_preference_column
```

**Step 4: Push to production**
```bash
npm run supabase:migrate
```

**Step 5: Update types**
```bash
npm run supabase:gen-types
npx supabase gen types typescript --project-id xsovqvbigdettnpeisjs > types/supabase-production.ts
```

## ⚠️ **Important Notes**

### **Always Follow This Order:**
1. ✅ Make changes locally first
2. ✅ Test thoroughly with local data
3. ✅ Check diff before pushing
4. ✅ Push to production when ready
5. ✅ Update types after deployment

### **Safety Practices:**
- **Never make schema changes directly in production**
- **Always test migrations locally first**
- **Use meaningful migration names**
- **Keep migrations small and focused**
- **Backup production data before major changes**

### **Team Collaboration:**
```bash
# When working with a team
git pull origin main          # Get latest code
npm run supabase:pull         # Sync remote schema changes  
npm run supabase:reset        # Apply all migrations
# Make your changes
npm run supabase:diff         # Check your changes
npm run supabase:migrate      # Push when ready
git commit -am "Add user theme preferences"
git push origin main
```

## 🎯 **Common Workflows**

### **Adding a New Table:**
```bash
# 1. Create via Studio UI or SQL
# 2. Check changes
npm run supabase:diff

# 3. Create migration file
npx supabase db diff create add_notifications_table

# 4. Push to remote
npm run supabase:migrate
```

### **Modifying Existing Table:**
```bash
# 1. Make changes in local Studio
# 2. Test with local data
# 3. Create focused migration
npx supabase db diff create update_bookings_add_status

# 4. Deploy
npm run supabase:migrate
```

### **Adding Database Functions:**
```bash
# 1. Create function in Studio or SQL file
# 2. Test locally
# 3. Generate migration
npx supabase db diff create add_booking_validation_function

# 4. Deploy
npm run supabase:migrate
```

## 🎊 **You Now Have Professional Database DevOps!**

This workflow gives you:
- ✅ **Version controlled** database changes
- ✅ **Safe deployment** process
- ✅ **Team collaboration** capabilities  
- ✅ **Rollback capabilities** (via migrations)
- ✅ **Type safety** throughout development

**No more manual SQL in production! No more broken deployments! No more schema drift!**

You're now operating at **enterprise level** with your database management! 🚀
