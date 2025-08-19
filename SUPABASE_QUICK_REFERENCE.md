# 🚀 Supabase CLI Quick Reference Card

## 🔥 Most Common Commands

### Daily Development Workflow
```bash
# Start your day
git pull origin main
npm run supabase:pull
npm run supabase:start

# Make database changes (via Studio: http://127.0.0.1:54323)

# Check what changed
npm run supabase:diff

# Create migration
npx supabase migration new descriptive_name

# Deploy to production
npm run supabase:migrate

# Update types
npm run supabase:gen-types
```

### Essential Commands

| Action | Command | Use Case |
|--------|---------|----------|
| **Start Local Dev** | `npm run supabase:start` | Begin development session |
| **Check Differences** | `npm run supabase:diff` | See local vs remote changes |
| **Create Migration** | `npx supabase migration new [name]` | Version control DB changes |
| **Deploy Changes** | `npm run supabase:migrate` | Push to production |
| **Update Types** | `npm run supabase:gen-types` | Sync TypeScript types |
| **Reset Local DB** | `npm run supabase:reset` | Apply all migrations fresh |
| **Pull Remote Schema** | `npm run supabase:pull` | Sync remote changes locally |

### Local Services URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Studio UI** | http://127.0.0.1:54323 | Database management |
| **API** | http://127.0.0.1:54321 | REST/GraphQL API |
| **Email Testing** | http://127.0.0.1:54324 | Test email delivery |

### Emergency Commands

```bash
# Something broken? Reset everything:
npm run supabase:stop
docker system prune -f
npm run supabase:start

# Lost sync with remote?
npm run supabase:pull
npm run supabase:reset
```

## 🎯 Perfect Workflow

```bash
# 1. Start Development
npm run supabase:start

# 2. Make Changes
# Open Studio: http://127.0.0.1:54323
# Modify tables, add columns, etc.

# 3. Check Changes
npm run supabase:diff

# 4. Create Migration
npx supabase migration new add_user_preferences

# 5. Test Migration
npm run supabase:reset

# 6. Deploy to Production
npm run supabase:migrate

# 7. Update Types
npm run supabase:gen-types

# 8. Commit Everything
git add .
git commit -m "Add user preferences feature"
git push
```

## ⚠️ Important Rules

### ✅ DO:
- Always test locally first
- Create descriptive migration names
- Commit migrations with related code
- Pull remote changes before starting work

### ❌ DON'T:
- Make changes directly in production
- Skip creating migrations
- Push code without database migrations
- Ignore `npm run supabase:diff` output

## 🆘 Quick Fixes

**Port in use?**
```bash
npm run supabase:stop
npm run supabase:start
```

**Docker issues?**
```bash
docker system prune -f
npm run supabase:start
```

**Out of sync?**
```bash
npm run supabase:pull
npm run supabase:reset
```

**Types wrong?**
```bash
npm run supabase:gen-types
```

---

📖 **Full Documentation:** See `SUPABASE_CLI_COMPLETE_GUIDE.md` for comprehensive details.
