# Supabase Configuration for Local Development

## Problem
When developing locally but using production Supabase, password reset emails redirect to production URLs instead of localhost.

## Solution Options

### Option 1: Quick Fix - Configure Production Supabase
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/nunvbolbcekvtlwuacul)
2. Navigate to **Authentication** → **URL Configuration**
3. Add localhost URLs to **Redirect URLs**:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/reset-password
   http://127.0.0.1:3000/auth/callback
   http://127.0.0.1:3000/auth/reset-password
   ```

### Option 2: Local Supabase Instance (Recommended)
1. Install Docker Desktop
2. Start local Supabase:
   ```bash
   npx supabase start
   ```
3. Update `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```

## Current Status
- ✅ `NEXT_PUBLIC_SITE_URL` is set to `http://localhost:3000`
- ✅ Auth context properly detects environment
- ❌ Production Supabase needs localhost redirect URLs configured

## Next Steps
Choose **Option 1** for immediate fix, or **Option 2** for proper local development setup.