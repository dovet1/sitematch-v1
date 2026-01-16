import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, WEBHOOK_CONFIG } from '@/lib/stripe'
import {
  updateUserSubscriptionStatus,
  startUserTrial,
  invalidateSubscriptionCache
} from '@/lib/subscription'
import { createClient } from '@/lib/supabase'
import type Stripe from 'stripe'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    console.error('Missing stripe-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_CONFIG.SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`Processing webhook event: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id

  if (!userId) {
    console.error('No user_id in checkout session metadata')
    return
  }

  console.log(`Processing checkout completed for user ${userId}`)
  console.log(`Session mode: ${session.mode}, subscription: ${session.subscription}`)

  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

    console.log(`Retrieved subscription ${subscription.id} for user ${userId}`)

    // Start trial with payment method collected
    const success = await startUserTrial(
      userId,
      session.customer as string,
      subscription.id
    )

    if (success) {
      console.log(`Started trial for user ${userId}`)

      // TODO: Send trial started email
      // await sendTrialStartedEmail(userId, subscription.trial_end)
    } else {
      console.error(`Failed to start trial for user ${userId}`)
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id

  if (!userId) {
    console.error('No user_id in subscription metadata')
    return
  }

  console.log(`Subscription created for user ${userId}: ${subscription.id}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id

  if (!userId) {
    console.error('No user_id in subscription metadata')
    return
  }

  let status: 'trialing' | 'active' | 'past_due' | 'canceled' | null = null
  const updates: any = {}

  // Fetch full subscription details to get current period info
  const fullSubscription = await stripe.subscriptions.retrieve(subscription.id)

  switch (fullSubscription.status) {
    case 'trialing':
      status = 'trialing'
      if (fullSubscription.trial_end) {
        updates.trial_end_date = new Date(fullSubscription.trial_end * 1000).toISOString()
      }
      break
    case 'active':
      status = 'active'
      if ((fullSubscription as any).current_period_start) {
        updates.subscription_start_date = new Date((fullSubscription as any).current_period_start * 1000).toISOString()
      }
      if ((fullSubscription as any).current_period_end) {
        updates.next_billing_date = new Date((fullSubscription as any).current_period_end * 1000).toISOString()
      }
      break
    case 'past_due':
      status = 'past_due'
      break
    case 'canceled':
    case 'unpaid':
      status = 'canceled'
      break
  }

  if (status) {
    const success = await updateUserSubscriptionStatus(userId, status, updates)
    if (success) {
      console.log(`Updated subscription status for user ${userId}: ${status}`)
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id

  if (!userId) {
    console.error('No user_id in subscription metadata')
    return
  }

  const success = await updateUserSubscriptionStatus(userId, 'canceled')
  if (success) {
    console.log(`Canceled subscription for user ${userId}`)

    // TODO: Send cancellation email
    // await sendSubscriptionCanceledEmail(userId)
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string
  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId = subscription.metadata?.user_id

  if (!userId) {
    console.error('No user_id in subscription metadata')
    return
  }

  // Check if this is the first payment (trial conversion)
  if ((invoice as any).billing_reason === 'subscription_cycle') {
    const success = await updateUserSubscriptionStatus(userId, 'active', {
      subscription_start_date: new Date().toISOString(),
      next_billing_date: (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000).toISOString()
        : undefined
    })

    if (success) {
      console.log(`Trial converted to paid for user ${userId}`)

      // TODO: Send subscription activated email
      // await sendSubscriptionActivatedEmail(userId, invoice)
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string
  if (!subscriptionId) return

  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const userId = subscription.metadata?.user_id

  if (!userId) {
    console.error('No user_id in subscription metadata')
    return
  }

  const success = await updateUserSubscriptionStatus(userId, 'past_due')
  if (success) {
    console.log(`Payment failed for user ${userId}`)

    // TODO: Send payment failed email
    // await sendPaymentFailedEmail(userId, invoice)
  }
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id

  if (!userId || !subscription.trial_end) {
    return
  }

  const trialEndDate = new Date(subscription.trial_end * 1000)
  const daysUntilEnd = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  console.log(`Trial will end in ${daysUntilEnd} days for user ${userId}`)

  // TODO: Send trial ending email based on days remaining
  // if (daysUntilEnd === 7) {
  //   await sendTrialEndingEmail(userId, trialEndDate, '7_days')
  // } else if (daysUntilEnd === 1) {
  //   await sendTrialEndingEmail(userId, trialEndDate, '1_day')
  // }
}