# Environment Setup Guide

## Overview
This document explains how to configure environment variables for different deployment environments to ensure authentication flows work correctly.

## Environment Variables

### NEXT_PUBLIC_SITE_URL
This is the most critical environment variable for authentication flows. It determines where password reset emails and other auth-related redirects point to.

**Local Development:**
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Production:**
```bash
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
```

### How It Works

1. **Password Reset Flow:**
   - When a user requests a password reset, the system uses `NEXT_PUBLIC_SITE_URL` to construct the redirect URL
   - The email will contain a link like: `${NEXT_PUBLIC_SITE_URL}/auth/reset-password?access_token=...`

2. **Environment Detection:**
   - If `NEXT_PUBLIC_SITE_URL` is set, it takes precedence
   - If not set, the system falls back to `window.location.origin` on the client
   - For server-side operations, it defaults to `http://localhost:3000`

## Supabase Configuration

### Local Development (supabase/config.toml)
```toml
site_url = "http://localhost:3000"
additional_redirect_urls = [
  "http://localhost:3000",
  "https://localhost:3000", 
  "http://127.0.0.1:3000",
  "https://127.0.0.1:3000"
]
```

### Production Supabase Dashboard
In your Supabase project dashboard, under Authentication > URL Configuration:

1. **Site URL:** `https://your-production-domain.com`
2. **Redirect URLs:** Add all allowed redirect URLs:
   - `https://your-production-domain.com/auth/callback`
   - `https://your-production-domain.com/auth/reset-password`

## Deployment Checklist

### For Local Development:
- [ ] Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local`
- [ ] Ensure Supabase local config allows localhost URLs
- [ ] Restart development server after environment changes

### For Production:
- [ ] Set `NEXT_PUBLIC_SITE_URL=https://your-production-domain.com` in Vercel/deployment platform
- [ ] Configure Supabase dashboard with production domain
- [ ] Test password reset flow after deployment
- [ ] Verify redirect URLs work correctly

## Troubleshooting

### Problem: Password reset links redirect to wrong domain
**Solution:** Check that `NEXT_PUBLIC_SITE_URL` is correctly set for your environment

### Problem: "Invalid redirect URL" error
**Solution:** Ensure the redirect URL is added to Supabase's allowed redirect URLs list

### Problem: Different behavior between local and production
**Solution:** Verify both local `.env.local` and production environment variables are set correctly

## Testing

To test the password reset flow:

1. **Local Development:**
   - Request password reset
   - Check browser console for "Password reset redirect URL" log
   - Verify email contains `http://localhost:3000/auth/reset-password`

2. **Production:**
   - Request password reset
   - Verify email contains `https://your-production-domain.com/auth/reset-password`
   - Click link and ensure it redirects correctly