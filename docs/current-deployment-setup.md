# Current Deployment Setup Guide

## 🔍 **Your Current Production Domain**
```
https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app
```

## 🛠 **Vercel Environment Variable Setup**

In Vercel Dashboard → Your Project → Settings → Environment Variables:

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `NEXT_PUBLIC_SITE_URL` | `https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app` | Production |

## 🗃 **Supabase Dashboard Configuration**

### 1. Site URL
Navigate to: https://supabase.com/dashboard/project/nunvbolbcekvtlwuacul/auth/url-configuration

**Set Site URL to:**
```
https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app
```

### 2. Redirect URLs
**Add these URLs** (keep existing localhost ones):
```
https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app/auth/callback
https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app/auth/reset-password
```

### 3. Complete Redirect URLs List
Your final list should include:
```
# Local Development (keep these)
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
http://127.0.0.1:3000/auth/callback
http://127.0.0.1:3000/auth/reset-password

# Production (add these)
https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app/auth/callback
https://sitematch-v1-7nu8yvee0-toms-projects-2a434695.vercel.app/auth/reset-password
```

## 🧪 **Testing Plan**

### After Configuration:
1. **Local Test:** Password reset should redirect to `localhost:3000`
2. **Production Test:** Password reset should redirect to your Vercel domain
3. **Verify:** Check email links point to correct domains

## 📝 **Notes**
- Vercel generates unique domains for each project
- You can add a custom domain later if needed
- This domain format includes your username and project hash