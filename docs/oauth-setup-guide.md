# OAuth Provider Setup Guide

This guide provides step-by-step instructions for configuring Google and Microsoft OAuth authentication for SiteMatcher.

## Table of Contents

- [Important: Provider ID Mapping](#important-provider-id-mapping)
- [Google OAuth Setup](#google-oauth-setup)
- [Microsoft OAuth Setup](#microsoft-oauth-setup)
- [Testing OAuth Setup](#testing-oauth-setup)
- [Troubleshooting](#troubleshooting)

---

## Important: Provider ID Mapping

**Critical:** The UI and Supabase use different provider names for Microsoft:

- **UI label:** `'microsoft'` (user-facing name in the app)
- **Supabase provider ID:** `'azure'` (actual OAuth provider)

The code automatically maps `provider: 'microsoft'` → Supabase `'azure'` in the auth context.

---

## Google OAuth Setup

### Step 1: Create Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project for your application
3. Navigate to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **OAuth 2.0 Client ID**
5. Configure the consent screen if you haven't already:
   - User Type: External (or Internal for Google Workspace)
   - App name: SiteMatcher
   - User support email: Your email
   - Developer contact: Your email
6. Application type: **Web application**
7. Name: SiteMatcher Production (or appropriate name)
8. **Authorized redirect URIs:**
   - Production: `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
   - Local dev: `http://localhost:54321/auth/v1/callback`

   **Note:** Replace `[YOUR_PROJECT_REF]` with your actual Supabase project reference ID

9. Click **Create**
10. **Copy the Client ID and Client Secret** (you'll need these in the next step)

### Step 2: Configure Supabase for Google

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find and enable **Google** provider
5. Paste the **Client ID** from Step 1
6. Paste the **Client Secret** from Step 1
7. Click **Save**

### Step 3: Configure Allowed Callback URLs in Supabase

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   - Production: `https://yourdomain.com/auth/callback`
   - Staging: `https://staging.yourdomain.com/auth/callback`
   - Local: `http://localhost:3000/auth/callback`
3. Click **Save**

**Note:** These URLs allow your app to receive the OAuth callback after Google authentication.

---

## Microsoft OAuth Setup

### Step 1: Create Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **"New registration"**
4. Configure the app:
   - **Name:** SiteMatcher (or your app name)
   - **Supported account types:**
     - Select: **"Accounts in any organizational directory and personal Microsoft accounts"**
     - This allows both work/school accounts AND personal Microsoft accounts
   - **Redirect URI:**
     - Type: Web
     - URL: `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`
5. Click **Register**
6. **Copy the Application (client) ID** from the Overview page

### Step 2: Create Client Secret

1. In your Azure AD app, go to **Certificates & secrets**
2. Click **"New client secret"**
3. Description: SiteMatcher OAuth
4. Expiry: Choose appropriate duration (recommendation: 24 months)
5. Click **Add**
6. **IMMEDIATELY copy the secret value** - you won't be able to see it again!

### Step 3: Configure Supabase for Microsoft

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find and enable **Azure** provider

   **Note:** Supabase calls this "Azure" not "Microsoft"

5. Configure:
   - **Application (client) ID:** Paste from Step 1
   - **Secret:** Paste client secret from Step 2
   - **Azure Tenant:** Enter `common`
     - `common` allows both personal and organizational accounts
     - Use a specific tenant ID to restrict to one organization
6. Click **Save**

### Step 4: Configure Allowed Callback URLs in Supabase

Same as Google setup - ensure your app's callback URLs are added to Supabase's URL Configuration (if not already done).

---

## Testing OAuth Setup

After configuring both providers, test the authentication flow:

### 1. Start Your Development Server

```bash
npm run dev
```

### 2. Test Google OAuth

1. Navigate to `http://localhost:3000/auth`
2. Click **"Sign in with Google"**
3. You should be redirected to Google's consent screen
4. Select your Google account
5. Grant permissions
6. You should be redirected back to your app
7. Check the database - a new user profile should exist with `user_type: NULL` and `user_company_name: NULL`

### 3. Test Microsoft OAuth

1. Navigate to `http://localhost:3000/auth`
2. Click **"Sign in with Microsoft"**
3. You should be redirected to Microsoft's login screen
4. Sign in with your Microsoft account (personal or work/school)
5. Grant permissions
6. You should be redirected back to your app
7. Check the database - a new user profile should exist with `user_type: NULL` and `user_company_name: NULL`

### 4. Verify Database Records

After successful OAuth login, verify in Supabase:

```sql
-- Check the new user
SELECT id, email, user_type, user_company_name, newsletter_opt_in
FROM users
WHERE email = 'your-test-email@example.com';
```

Expected result:
- `user_type`: NULL
- `user_company_name`: NULL
- `newsletter_opt_in`: false (default)

---

## Troubleshooting

### Google OAuth Issues

**Error: "redirect_uri_mismatch"**
- **Cause:** The redirect URI in your Google Console doesn't match the Supabase callback URL
- **Fix:** Ensure the redirect URI is exactly: `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`

**Error: "Access blocked: This app's request is invalid"**
- **Cause:** OAuth consent screen not configured
- **Fix:** Complete the OAuth consent screen configuration in Google Cloud Console

**Error: "invalid_client"**
- **Cause:** Client ID or Secret is incorrect
- **Fix:** Double-check the credentials in Supabase match those in Google Console

### Microsoft OAuth Issues

**Error: "AADSTS50011: The redirect URI specified in the request does not match"**
- **Cause:** Redirect URI mismatch
- **Fix:** Verify the redirect URI in Azure matches: `https://[YOUR_PROJECT_REF].supabase.co/auth/v1/callback`

**Error: "AADSTS700016: Application not found"**
- **Cause:** Application (client) ID is incorrect
- **Fix:** Copy the correct Application ID from Azure Portal Overview page

**Error: "invalid_client"**
- **Cause:** Client secret is incorrect or expired
- **Fix:** Generate a new client secret in Azure and update Supabase

**Personal Microsoft accounts not working**
- **Cause:** Tenant restriction
- **Fix:** Ensure Azure Tenant is set to `common` in Supabase, not a specific tenant ID

### General OAuth Issues

**Error: "Invalid redirect URL"**
- **Cause:** App callback URL not in Supabase allowed list
- **Fix:** Add your app's `/auth/callback` URL to Supabase URL Configuration

**Profile not created after successful OAuth**
- **Cause:** `handle_new_user()` trigger may not be working
- **Fix:** Check Supabase logs and verify migration `055_make_user_fields_nullable.sql` was applied

**User redirected to `/new-dashboard` instead of intended page**
- **Cause:** Invalid or missing `returnUrl` parameter
- **Fix:** Ensure `returnUrl` is a valid relative path starting with `/`

**Modal opens instead of OAuth redirect**
- **Cause:** JavaScript error or incorrect provider mapping
- **Fix:** Check browser console for errors. Verify `'microsoft'` is being mapped to `'azure'` in auth context.

---

## Security Notes

1. **Never commit secrets:** Keep Client IDs and Secrets out of version control
2. **Use environment variables:** Store credentials in `.env.local` (already configured)
3. **HTTPS in production:** Always use HTTPS for OAuth redirects in production
4. **Validate return URLs:** The app validates all `returnUrl` parameters to prevent open redirect attacks
5. **Client secret rotation:** Rotate Azure client secrets before expiry to avoid downtime

---

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase OAuth Providers](https://supabase.com/docs/guides/auth/social-login)

---

**Last Updated:** 2026-05-19
**Version:** 1.0
