import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getUserSubscriptionStatus } from '@/lib/subscription'

type GapFinderAccessGranted = {
  authorized: true
  supabase: Awaited<ReturnType<typeof createServerClient>>
  userId: string
}

type GapFinderAccessDenied = {
  authorized: false
  response: NextResponse
}

export type GapFinderAccessResult = GapFinderAccessGranted | GapFinderAccessDenied

/**
 * Require Plus tier access for GapFinder
 * CRITICAL: Checks BOTH active/trialing subscription AND Plus tier
 */
export async function requireGapFinderAccess(): Promise<GapFinderAccessResult> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  // Get user subscription status and tier
  const userStatus = await getUserSubscriptionStatus(user.id)

  if (!userStatus) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      ),
    }
  }

  // Must have active, trialing, or past_due subscription
  // past_due is allowed during Stripe's dunning period (only if real Stripe sub exists)
  const validStatuses = ['active', 'trialing']
  if (userStatus.stripe_subscription_id && userStatus.subscription_status === 'past_due') {
    validStatuses.push('past_due')
  }

  if (!validStatuses.includes(userStatus.subscription_status || '')) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Active subscription required for GapFinder. Start your free trial to access.' },
        { status: 403 }
      ),
    }
  }

  // Must be Plus tier specifically
  if (userStatus.subscription_tier !== 'plus') {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'GapFinder is available on the Plus plan only. Upgrade to access.',
          currentTier: userStatus.subscription_tier || 'free',
          requiredTier: 'plus'
        },
        { status: 403 }
      ),
    }
  }

  return {
    authorized: true,
    supabase,
    userId: user.id,
  }
}

/**
 * Check if user has Plus tier access (for client-side/non-API usage)
 * Returns true only if user has both active/trialing subscription AND Plus tier
 */
export async function checkPlusAccess(userId: string): Promise<boolean> {
  const userStatus = await getUserSubscriptionStatus(userId)
  if (!userStatus) return false

  // Allow active, trialing, or past_due (with Stripe subscription) during dunning
  const validStatuses = ['active', 'trialing']
  if (userStatus.stripe_subscription_id && userStatus.subscription_status === 'past_due') {
    return userStatus.subscription_tier === 'plus'
  }

  return (userStatus.subscription_status === 'active' || userStatus.subscription_status === 'trialing') &&
         userStatus.subscription_tier === 'plus'
}
