-- Add subscription_tier column to users table
-- This migration adds support for 3-tier pricing: free, pro, plus

-- Add subscription_tier column with check constraint
ALTER TABLE users
ADD COLUMN IF NOT EXISTS subscription_tier TEXT
CHECK (subscription_tier IN ('free', 'pro', 'plus'))
DEFAULT 'free';

-- Create index for faster tier lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

-- Set existing active/trialing users to 'pro' tier
-- These are manually-granted access users who should be migrated to Pro
-- Note: Check for both NULL and 'free' since DEFAULT 'free' applies immediately
UPDATE users
SET subscription_tier = 'pro'
WHERE subscription_status IN ('active', 'trialing')
  AND (subscription_tier IS NULL OR subscription_tier = 'free');

-- Set all other users to 'free' tier explicitly (for any NULL values)
UPDATE users
SET subscription_tier = 'free'
WHERE subscription_tier IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.subscription_tier IS 'User subscription tier: free (default), pro (£39.50/mo or £395/yr), plus (£49.50/mo or £495/yr with GapFinder)';
