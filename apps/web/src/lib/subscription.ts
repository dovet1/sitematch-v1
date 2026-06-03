import { createAdminClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

// Redis caching disabled in middleware to avoid edge runtime issues
// Can be re-enabled in API routes if needed
const CACHE_TTL = 300 // 5 minutes

// In-memory cache to prevent duplicate queries within short time windows
// This prevents Supabase SDK caching issues that can return stale data
const requestCache = new Map<string, { data: UserSubscription | null, timestamp: number }>()
const REQUEST_CACHE_TTL = 1000 // 1 second

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'trial_expired'
  | 'trial_canceled'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | null

export type SubscriptionTier = 'free' | 'pro' | 'plus'

interface UserSubscription {
  id: string
  subscription_status: SubscriptionStatus
  subscription_tier?: SubscriptionTier  // NEW: User's subscription tier
  trial_start_date?: string
  trial_end_date?: string
  stripe_customer_id?: string
  stripe_subscription_id?: string
  payment_method_added: boolean
}

/**
 * Check if user has access to premium features
 */
export async function checkSubscriptionAccess(userId: string): Promise<boolean> {
  if (!userId) return false

  // Direct database check (no caching in middleware for edge runtime compatibility)
  const user = await getUserSubscriptionStatus(userId)
  if (!user) return false

  // Check if trial is active
  if (user.subscription_status === 'trialing') {
    // If no trial_end_date is set, grant access (trial is active)
    if (!user.trial_end_date) {
      return true
    }

    // If trial_end_date exists, check if it's still valid
    if (new Date() < new Date(user.trial_end_date)) {
      return true // Trial active
    } else {
      // Trial expired - update status
      await updateUserSubscriptionStatus(userId, 'trial_expired')
      return false
    }
  }

  // Check if subscription is active or past_due (allow access during dunning)
  // Only allow past_due if user has a real Stripe subscription
  if (user.subscription_status === 'active') {
    return true
  }

  if (user.subscription_status === 'past_due' && user.stripe_subscription_id) {
    // Allow access during Stripe's dunning period
    console.log(`User ${userId} has past_due subscription, allowing access during dunning`)
    return true
  }

  return false
}

/**
 * Get user subscription status from database
 */
export async function getUserSubscriptionStatus(userId: string): Promise<UserSubscription | null> {
  // Check in-memory cache first to prevent duplicate queries
  const cached = requestCache.get(userId)
  if (cached && (Date.now() - cached.timestamp) < REQUEST_CACHE_TTL) {
    return cached.data
  }

  // Use admin client to bypass RLS restrictions
  const supabase = createAdminClient()

  // Use maybeSingle() with order() to prevent Supabase SDK query caching issues
  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      subscription_status,
      subscription_tier,
      trial_start_date,
      trial_end_date,
      stripe_customer_id,
      stripe_subscription_id,
      payment_method_added
    `)
    .eq('id', userId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching user subscription status:', error)
    return null
  }

  // Cache the result
  requestCache.set(userId, { data, timestamp: Date.now() })

  // Periodic cache cleanup to prevent memory leaks
  if (requestCache.size > 100) {
    const now = Date.now()
    Array.from(requestCache.entries()).forEach(([key, value]) => {
      if (now - value.timestamp > REQUEST_CACHE_TTL) {
        requestCache.delete(key)
      }
    })
  }

  return data
}

/**
 * Update user subscription status in database
 */
export async function updateUserSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
  updates: Partial<{
    trial_start_date: string
    trial_end_date: string
    subscription_start_date: string
    next_billing_date: string
    stripe_customer_id: string
    stripe_subscription_id: string
    payment_method_added: boolean
    trial_will_convert: boolean
    subscription_tier: SubscriptionTier  // NEW: Support tier updates
  }> = {}
): Promise<boolean> {
  // Use admin client to bypass RLS restrictions
  const supabase = createAdminClient()

  const updateData = {
    subscription_status: status,
    ...updates
  }

  console.log(`Updating user ${userId} with data:`, updateData)

  try {
    // Simple direct update with service role
    const { data, error } = await (supabase
      .from('users') as any)
      .update(updateData)
      .eq('id', userId)
      .select()

    if (error) {
      console.error('Service role update failed:', error)
      return false
    }

    if (!data || data.length === 0) {
      console.error('No rows updated - user may not exist:', userId)
      return false
    }

    console.log('Update successful:', data[0])
    await invalidateSubscriptionCache(userId)
    return true

  } catch (err) {
    console.error('Unexpected error in updateUserSubscriptionStatus:', err)
    return false
  }
}

/**
 * Invalidate subscription cache for user (no-op when Redis disabled)
 */
export async function invalidateSubscriptionCache(userId: string): Promise<void> {
  // No-op when Redis is disabled for edge runtime compatibility
}

/**
 * Start trial for user after payment method collection
 * @param tier - Subscription tier (pro or plus) - CRITICAL for tier attribution
 */
export async function startUserTrial(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  tier: 'pro' | 'plus'  // NEW REQUIRED PARAMETER
): Promise<boolean> {
  const now = new Date()
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  console.log(`Starting ${tier} tier trial for user ${userId}`)

  return updateUserSubscriptionStatus(userId, 'trialing', {
    trial_start_date: now.toISOString(),
    trial_end_date: trialEnd.toISOString(),
    stripe_subscription_id: stripeSubscriptionId,
    payment_method_added: true,
    trial_will_convert: true,
    subscription_tier: tier  // ← Set the tier!
  })
}

/**
 * Get subscription status for display
 */
export function getSubscriptionDisplayStatus(user: UserSubscription): {
  status: string
  message: string
  daysRemaining?: number
} {
  if (!user.subscription_status) {
    return { status: 'none', message: 'No subscription' }
  }

  switch (user.subscription_status) {
    case 'trialing':
      if (user.trial_end_date) {
        const daysRemaining = Math.ceil(
          (new Date(user.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return {
          status: 'trial',
          message: `${daysRemaining} days remaining in trial`,
          daysRemaining
        }
      }
      return { status: 'trial', message: 'Trial active' }

    case 'active':
      return { status: 'active', message: 'Subscription active' }

    case 'trial_expired':
      return { status: 'expired', message: 'Trial expired - Subscribe to continue' }

    case 'trial_canceled':
      return { status: 'canceled', message: 'Trial canceled' }

    case 'past_due':
      return { status: 'past_due', message: 'Payment failed - Update payment method' }

    case 'canceled':
      return { status: 'canceled', message: 'Subscription canceled' }

    default:
      return { status: 'unknown', message: 'Unknown status' }
  }
}

/**
 * Check if user has Plus tier access (for GapFinder and other Plus-only features)
 * Requires BOTH active/trialing subscription AND Plus tier
 */
export async function checkPlusAccess(userId: string): Promise<boolean> {
  if (!userId) return false

  const user = await getUserSubscriptionStatus(userId)
  if (!user) return false

  // Allow active, trialing, or past_due (with Stripe subscription) during dunning
  const validStatuses = ['active', 'trialing']
  if (user.stripe_subscription_id && user.subscription_status === 'past_due') {
    return user.subscription_tier === 'plus'
  }

  return (user.subscription_status === 'active' || user.subscription_status === 'trialing') &&
         user.subscription_tier === 'plus'
}