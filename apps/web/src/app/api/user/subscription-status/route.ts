import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getUserSubscriptionStatus } from '@/lib/subscription'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
      return NextResponse.json({ subscriptionStatus: null })
    }

    // Get subscription status and tier from database
    const subscription = await getUserSubscriptionStatus(user.id)

    // Query Stripe for billing interval
    let billingInterval: 'month' | 'year' = 'year' // Default fallback

    if (subscription?.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)

        // Find Pro/Plus price item (don't assume first item - match upgrade-subscription logic)
        const knownPriceIds = [
          process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
          process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
          process.env.STRIPE_PLUS_MONTHLY_PRICE_ID,
          process.env.STRIPE_PLUS_ANNUAL_PRICE_ID,
        ].filter(Boolean)

        const currentItem = stripeSubscription.items.data.find(item =>
          knownPriceIds.includes(item.price.id)
        )

        if (currentItem?.price?.recurring?.interval) {
          const interval = currentItem.price.recurring.interval
          billingInterval = (interval === 'month' || interval === 'year') ? interval : 'year'
        }
      } catch (error) {
        console.error('Failed to fetch billing interval from Stripe:', error)
        // Keep 'year' fallback
      }
    }

    return NextResponse.json({
      subscriptionStatus: subscription?.subscription_status || null,
      subscription_tier: subscription?.subscription_tier || 'free',  // Default to free if not set
      hasStripeSubscription: !!subscription?.stripe_subscription_id,
      billing_interval: billingInterval  // NEW
    })

  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}
