import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic';

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

    // Get user's Stripe customer ID and subscription ID using admin client
    const adminSupabase = createAdminClient()
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('stripe_customer_id, stripe_subscription_id, email')
      .eq('id', user.id)
      .single() as { data: { stripe_customer_id: string | null; stripe_subscription_id: string | null; email: string } | null; error: any }

    if (userError || !userData) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Require Stripe subscription to access portal
    if (!userData.stripe_subscription_id) {
      return NextResponse.json(
        {
          error: 'No active subscription found',
          message: 'You need an active Stripe subscription to access the customer portal.',
          redirectUrl: '/pricing'
        },
        { status: 400 }
      )
    }

    let customerId = userData.stripe_customer_id

    // Get subscription from Stripe to validate ownership and repair IDs
    try {
      const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id)
      const subscriptionCustomerId = subscription.customer as string
      const subscriptionUserId = subscription.metadata?.user_id

      // Require positive ownership match (not just absence of mismatch)
      let ownershipVerified = false

      // Check 1: metadata.user_id matches
      if (subscriptionUserId === user.id) {
        ownershipVerified = true
        console.log('Ownership verified via subscription metadata.user_id')
      }
      // Check 2: customer ID matches stored value
      else if (customerId && customerId === subscriptionCustomerId) {
        ownershipVerified = true
        console.log('Ownership verified via stored customer ID match')
      }

      // Reject if no positive ownership signal
      if (!ownershipVerified) {
        console.error('Subscription ownership cannot be verified:', {
          user_id: user.id,
          metadata_user_id: subscriptionUserId,
          stored_customer_id: customerId,
          subscription_customer_id: subscriptionCustomerId
        })
        // Clear both subscription and customer IDs - both are suspect
        await adminSupabase
          .from('users')
          .update({
            stripe_subscription_id: null,
            stripe_customer_id: null,
            subscription_status: 'canceled',
            subscription_tier: 'free'
          })
          .eq('id', user.id)

        return NextResponse.json(
          {
            error: 'Subscription verification failed',
            message: 'Please visit the pricing page to subscribe.',
            redirectUrl: '/pricing'
          },
          { status: 403 }
        )
      }

      // Ownership verified - repair customer ID if needed
      if (!customerId || customerId !== subscriptionCustomerId) {
        console.log('Repairing customer ID from verified subscription:', subscriptionCustomerId)
        customerId = subscriptionCustomerId
        await adminSupabase
          .from('users')
          .update({ stripe_customer_id: subscriptionCustomerId })
          .eq('id', user.id)
      }
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        // Subscription doesn't exist in Stripe - clear IDs and redirect
        console.error('Subscription not found in Stripe, clearing IDs')
        await adminSupabase
          .from('users')
          .update({
            stripe_customer_id: null,
            stripe_subscription_id: null,
            subscription_status: 'canceled',
            subscription_tier: 'free'
          })
          .eq('id', user.id)

        return NextResponse.json(
          {
            error: 'Subscription not found',
            message: 'Your subscription was not found. Please visit the pricing page.',
            redirectUrl: '/pricing'
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Create portal session with validated customer ID
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing`,
    })

    return NextResponse.json({
      url: portalSession.url
    })

  } catch (error) {
    console.error('Error creating portal session:', error)

    // Provide helpful error message
    const errorMessage = error instanceof Error ? error.message : 'Failed to create portal session'

    return NextResponse.json(
      {
        error: 'Failed to create portal session',
        details: errorMessage
      },
      { status: 500 }
    )
  }
}