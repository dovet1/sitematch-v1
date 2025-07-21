# Deployment Checklist - Authentication Setup

## ✅ **Vercel Environment Variables**
In Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_SITE_URL` | `https://your-production-domain.vercel.app` | Production, Preview |

## ✅ **Supabase Dashboard Configuration**
URL: https://supabase.com/dashboard/project/nunvbolbcekvtlwuacul/auth/url-configuration

### Site URL
```
https://your-production-domain.vercel.app
```

### Redirect URLs (Keep ALL of these)
```
# Local Development
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
http://127.0.0.1:3000/auth/callback
http://127.0.0.1:3000/auth/reset-password

# Production
https://your-production-domain.vercel.app/auth/callback
https://your-production-domain.vercel.app/auth/reset-password
https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app/auth/callback
https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app/auth/reset-password
```

## 🧪 **Testing After Deployment**

### Local Development Test
1. `npm run dev`
2. Test password reset
3. Verify email redirects to: `http://localhost:3000/auth/reset-password`

### Production Test  
1. Deploy to Vercel
2. Test password reset on production
3. Verify email redirects to: `https://your-production-domain.vercel.app/auth/reset-password`

## 🔧 **Environment Detection Logic**
The app automatically detects the environment:

```javascript
// In auth-context.tsx
if (process.env.NEXT_PUBLIC_SITE_URL) {
  // Uses explicit environment variable
} else if (typeof window !== 'undefined') {
  // Falls back to current origin
} else {
  // Server-side fallback
}
```

## 📋 **Pre-Deploy Checklist**
- [ ] Vercel `NEXT_PUBLIC_SITE_URL` configured
- [ ] Supabase redirect URLs include production domain
- [ ] Local development still working
- [ ] All environment variables documented
- [ ] Team notified of deployment

## 🚨 **Rollback Plan**
If something breaks:
1. Check Vercel environment variables
2. Verify Supabase redirect URLs are correct
3. Check browser console for redirect URL logs
4. Revert Supabase configuration if needed