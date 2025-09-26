import { createAdminClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

// Redis caching disabled in middleware to avoid edge runtime issues
// Can be re-enabled in API routes if needed
const CACHE_TTL = 300 // 5 minutes

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'trial_expired'
  | 'trial_canceled'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | null

interface UserSubscription {
  id: string
  subscription_status: SubscriptionStatus
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
    if (user.trial_end_date && new Date() < new Date(user.trial_end_date)) {
      return true // Trial active
    } else {
      // Trial expired - update status
      await updateUserSubscriptionStatus(userId, 'trial_expired')
      return false
    }
  }

  // Check if subscription is active
  return user.subscription_status === 'active'
}

/**
 * Get user subscription status from database
 */
export async function getUserSubscriptionStatus(userId: string): Promise<UserSubscription | null> {
  // Use admin client to bypass RLS restrictions
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('users')
    .select(`
      id,
      subscription_status,
      trial_start_date,
      trial_end_date,
      stripe_customer_id,
      stripe_subscription_id,
      payment_method_added
    `)
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user subscription status:', error)
    return null
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
    const { data, error } = await supabase
      .from('users')
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
 */
export async function startUserTrial(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<boolean> {
  const now = new Date()
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  return updateUserSubscriptionStatus(userId, 'trialing', {
    trial_start_date: now.toISOString(),
    trial_end_date: trialEnd.toISOString(),
    stripe_subscription_id: stripeSubscriptionId,
    payment_method_added: true,
    trial_will_convert: true
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