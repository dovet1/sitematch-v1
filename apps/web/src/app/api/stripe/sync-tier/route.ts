import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { getTierFromPriceId } from '@/lib/stripe'
import { createServerClient } from '@supabase/ssr'
import { updateUserSubscriptionStatus } from '@/lib/subscription'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic';

/**
 * Secured tier sync endpoint
 * Takes sessionId only (not userId) and verifies user owns the session
 * before syncing tier from Stripe to database
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    console.log('[SYNC-TIER] Starting tier sync for session:', sessionId)

    // Get authenticated user using server-side Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('[SYNC-TIER] Unauthorized:', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[SYNC-TIER] Authenticated user:', user.id)

    // Retrieve Stripe session (server-side, trusted source)
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    })

    console.log('[SYNC-TIER] Retrieved session, client_reference_id:', session.client_reference_id)

    // CRITICAL: Verify this session belongs to the authenticated user
    if (session.client_reference_id !== user.id) {
      console.error('[SYNC-TIER] Session user mismatch:', {
        sessionUserId: session.client_reference_id,
        authenticatedUserId: user.id
      })
      return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 })
    }

    // Extract tier from subscription (trusted Stripe data)
    const subscription = session.subscription as Stripe.Subscription

    if (!subscription) {
      console.error('[SYNC-TIER] No subscription found in session')
      return NextResponse.json({ error: 'No subscription in session' }, { status: 400 })
    }

    const priceId = subscription.items.data[0]?.price?.id
    console.log('[SYNC-TIER] Subscription price ID:', priceId)

    // Tier extraction priority: Price ID → Subscription metadata → Session metadata
    const tierFromPrice = priceId ? getTierFromPriceId(priceId) : null
    const tierFromSubMeta = subscription.metadata?.tier as 'pro' | 'plus' | null
    const tierFromSessionMeta = session.metadata?.tier as 'pro' | 'plus' | null

    const tier = tierFromPrice || tierFromSubMeta || tierFromSessionMeta

    console.log('[SYNC-TIER] Tier resolution:', {
      tierFromPrice,
      tierFromSubMeta,
      tierFromSessionMeta,
      finalTier: tier
    })

    if (!tier || (tier !== 'pro' && tier !== 'plus')) {
      console.error('[SYNC-TIER] Could not determine valid tier')
      return NextResponse.json({ error: 'Could not determine tier' }, { status: 400 })
    }

    // Get current subscription status from database
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('subscription_status, subscription_tier')
      .eq('id', user.id)
      .single()

    if (fetchError) {
      console.error('[SYNC-TIER] Error fetching user data:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    console.log('[SYNC-TIER] Current user state:', {
      subscription_status: userData.subscription_status,
      subscription_tier: userData.subscription_tier
    })

    // Update database for verified user
    // Only update tier if user is trialing or active
    const subscriptionStatus = userData.subscription_status || 'trialing'

    const success = await updateUserSubscriptionStatus(user.id, subscriptionStatus, {
      subscription_tier: tier
    })

    if (!success) {
      console.error('[SYNC-TIER] Failed to update database')
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    console.log('[SYNC-TIER] Successfully synced tier:', tier)

    return NextResponse.json({
      success: true,
      tier,
      message: `Tier synced to ${tier}`
    })

  } catch (error) {
    console.error('[SYNC-TIER] Error:', error)
    return NextResponse.json(
      { error: 'Tier sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
