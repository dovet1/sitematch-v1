import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { stripe, SUBSCRIPTION_CONFIG, type BillingInterval, type SubscriptionTier } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from session
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { targetTier, billingInterval } = body as { targetTier: SubscriptionTier; billingInterval: BillingInterval }

    if (!targetTier || !billingInterval) {
      return NextResponse.json(
        { error: 'Missing required fields: targetTier and billingInterval' },
        { status: 400 }
      )
    }

    // Get user's subscription data using admin client
    const adminSupabase = createAdminClient()
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, subscription_tier')
      .eq('id', user.id)
      .single() as {
        data: {
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_tier: string | null
        } | null
        error: any
      }

    if (userError || !userData) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!userData.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      )
    }

    // Retrieve subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id)

    // Verify ownership with repair logic
    const subscriptionCustomer = subscription.customer as string
    const subscriptionUserId = subscription.metadata?.user_id

    // Priority 1: metadata.user_id (strongest signal)
    if (subscriptionUserId === user.id) {
      // REPAIR stale customer ID instead of failing
      if (!userData.stripe_customer_id || userData.stripe_customer_id !== subscriptionCustomer) {
        console.log('Repairing customer ID during upgrade:', subscriptionCustomer)
        await (adminSupabase
          .from('users') as any)
          .update({ stripe_customer_id: subscriptionCustomer })
          .eq('id', user.id)
      }
    }
    // Priority 2: customer ID match (fallback)
    else if (userData.stripe_customer_id && userData.stripe_customer_id === subscriptionCustomer) {
      console.log('Ownership verified via customer ID')
    }
    // Fail if neither matches
    else {
      console.error('Subscription ownership verification failed:', {
        user_id: user.id,
        metadata_user_id: subscriptionUserId,
        stored_customer_id: userData.stripe_customer_id,
        subscription_customer_id: subscriptionCustomer
      })
      return NextResponse.json(
        { error: 'Subscription ownership verification failed' },
        { status: 403 }
      )
    }

    // Find Pro/Plus price item (don't assume first item)
    const knownPriceIds = [
      process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
      process.env.STRIPE_PLUS_MONTHLY_PRICE_ID,
      process.env.STRIPE_PLUS_ANNUAL_PRICE_ID,
    ].filter(Boolean)

    const currentItem = subscription.items.data.find(item =>
      knownPriceIds.includes(item.price.id)
    )

    if (!currentItem) {
      console.error('No Pro/Plus price found in subscription items')
      return NextResponse.json(
        { error: 'Invalid subscription configuration' },
        { status: 400 }
      )
    }

    // Get new price ID and validate
    const newPriceId = SUBSCRIPTION_CONFIG.getPriceIdForTier(targetTier, billingInterval)

    if (!newPriceId) {
      console.error('Missing price ID for tier:', targetTier, billingInterval)
      return NextResponse.json(
        { error: 'Configuration error. Contact support.' },
        { status: 500 }
      )
    }

    // Check if already on target tier
    if (currentItem.price.id === newPriceId) {
      return NextResponse.json(
        { error: 'Already on the target tier' },
        { status: 400 }
      )
    }

    // Update subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: currentItem.id, price: newPriceId }],
      metadata: {
        ...subscription.metadata,
        user_id: user.id,
        tier: targetTier
      },
      proration_behavior: 'create_prorations',
      billing_cycle_anchor: 'unchanged',
    })

    console.log('Subscription updated in Stripe:', updatedSubscription.id)

    // Update database tier immediately - subscription price change is effective now
    const { error: updateError } = await (adminSupabase
      .from('users') as any)
      .update({ subscription_tier: targetTier })
      .eq('id', user.id)

    if (updateError) {
      console.error('Failed to update tier in database:', updateError)
      // Stripe subscription is updated - user will get access via webhook
      return NextResponse.json({
        success: true,
        message: 'Upgrade successful. Please refresh if you don\'t see Plus features immediately.',
        subscriptionId: updatedSubscription.id,
        tierUpdatePending: true
      })
    }

    console.log('Database tier updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Successfully upgraded to Plus!',
      newTier: targetTier,
      subscriptionId: updatedSubscription.id
    })

  } catch (error) {
    console.error('Error upgrading subscription:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to upgrade subscription'

    return NextResponse.json(
      {
        error: 'Failed to upgrade subscription',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
