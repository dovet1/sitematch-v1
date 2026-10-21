import { NextRequest, NextResponse } from 'next/server'
import { stripe, getSitematcherProPriceId, SUBSCRIPTION_CONFIG } from '@/lib/stripe'
import { updateUserSubscriptionStatus } from '@/lib/subscription'
import { requireTrialUser } from '@/lib/stripe-trial'
import { parseProPlan } from '@/lib/pro-plan'

export const dynamic = 'force-dynamic'

// Step 2 of the trial flow, once the card is confirmed: start the Pro subscription on a 14-day
// trial with that card as the default. £0 today; Stripe takes the first payment when the trial
// ends. The users row is written here as well as by the webhook, so the workspace unlocks on
// the very next request instead of waiting on webhook delivery.
export async function POST(request: NextRequest) {
  try {
    const gate = await requireTrialUser()
    if (gate.error) return gate.error
    const user = gate.user

    const body = (await request.json().catch(() => null)) as { setupIntentId?: unknown; plan?: unknown } | null
    const setupIntentId = typeof body?.setupIntentId === 'string' ? body.setupIntentId : ''
    if (!setupIntentId.startsWith('seti_')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const plan = parseProPlan(typeof body?.plan === 'string' ? body.plan : null)
    const priceId = getSitematcherProPriceId(plan)
    if (!priceId) {
      console.error(`[TRIAL] STRIPE_SITEMATCHER_PRO_${plan === 'annual' ? 'ANNUAL' : 'MONTHLY'}_PRICE_ID is not set`)
      return NextResponse.json({ error: 'Plans are not available right now. Please contact us.' }, { status: 503 })
    }

    // The card must have been saved by this user, on their customer, and confirmed.
    const intent = await stripe.setupIntents.retrieve(setupIntentId)
    const customerId = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id
    const paymentMethod = typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id
    if (intent.metadata?.user_id !== user.id || !customerId || !paymentMethod) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    if (intent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Your card has not been confirmed yet.' }, { status: 400 })
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethod },
    })

    const interval = plan === 'annual' ? 'year' : 'month'
    const subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceId, quantity: 1 }],
        default_payment_method: paymentMethod,
        trial_period_days: SUBSCRIPTION_CONFIG.SITEMATCHER_PRO.TRIAL_DAYS,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        metadata: {
          user_id: user.id,
          user_type: 'brand_matcher',
          billing_interval: interval,
          tier: SUBSCRIPTION_CONFIG.SITEMATCHER_PRO.TIER,
        },
      },
      // A double submit or retry with the same card never makes a second subscription.
      { idempotencyKey: `sitematcher-pro-trial-${setupIntentId}` }
    )

    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    await updateUserSubscriptionStatus(user.id, 'trialing', {
      subscription_tier: SUBSCRIPTION_CONFIG.SITEMATCHER_PRO.TIER,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      trial_start_date: new Date().toISOString(),
      ...(trialEnd ? { trial_end_date: trialEnd.toISOString() } : {}),
      payment_method_added: true,
    })

    return NextResponse.json({ trialEnd: trialEnd?.toISOString() ?? null, plan })
  } catch (error) {
    console.error('[TRIAL] start failed:', error)
    return NextResponse.json({ error: 'Could not start your trial. Please try again.' }, { status: 500 })
  }
}
