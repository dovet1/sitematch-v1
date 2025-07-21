# Authentication Migration Guide - Magic Link to Email/Password

## Overview
This guide documents the migration process from magic link authentication to email/password authentication for existing SiteMatch dev team members.

## Migration Date
To be determined - coordinate with team

## For Existing Users

### Option 1: Admin-Generated Passwords (Recommended)
1. The admin will generate secure temporary passwords for each team member
2. Passwords will be securely communicated via your preferred secure channel
3. You will be required to change your password on first login

### Option 2: Self-Service Password Reset
1. Once migration is complete, use the "Forgot Password?" link on the login page
2. Enter your email address
3. Check your email for a password reset link
4. Set your new password following the requirements below

## Password Requirements
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- Special characters optional but encouraged

## New Login Process
1. Navigate to the login page
2. Enter your email address
3. Enter your password
4. Click "Log in" (no more waiting for emails!)

## Security Best Practices
- Use a unique password not used on other sites
- Consider using a password manager
- Enable 2FA when available (future feature)
- Change your password regularly

## Support
If you encounter any issues during migration:
1. Try the password reset flow first
2. Contact the development team if issues persist

## Environment Setup

### Local Development
Ensure your `.env.local` file contains:
```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Production
Set in your deployment platform (Vercel/etc.):
```bash
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
```

This ensures password reset emails redirect to the correct environment.

## Migration Checklist for Admins
- [ ] Update all existing user records in Supabase dashboard
- [ ] Generate secure temporary passwords
- [ ] Communicate passwords securely to team members
- [ ] Verify environment variables are set correctly for each environment
- [ ] Test password reset flow in both local and production environments
- [ ] Verify all team members can log in successfully
- [ ] Monitor for any authentication issues post-migration