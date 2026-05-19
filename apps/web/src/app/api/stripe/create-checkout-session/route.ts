import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { stripe, SUBSCRIPTION_CONFIG, type SubscriptionTier, type BillingInterval } from '@/lib/stripe'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const {
      userId: providedUserId,
      userType,
      redirectPath,
      billingInterval = 'year',
      tier: providedTier
    } = await request.json()

    console.log('API called with userId:', providedUserId, 'tier:', providedTier)
    console.log('Billing interval:', billingInterval)

    // ===== SECURITY: Always authenticate from session first =====
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

    const { data: { user: sessionUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !sessionUser) {
      return NextResponse.json({ error: 'User authentication required' }, { status: 401 })
    }

    // SECURITY: Verify provided userId matches session user (if provided)
    if (providedUserId && providedUserId !== sessionUser.id) {
      console.warn('User ID mismatch - provided:', providedUserId, 'session:', sessionUser.id)
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 403 })
    }

    const userId = sessionUser.id
    console.log('Authenticated user from session:', userId)

    // Create admin client with service role key for database operations
    const adminSupabase = createAdminClient()

    // Get user details using admin client to bypass RLS
    const { data: user, error: userError } = await adminSupabase
      .from('users')
      .select('email, stripe_customer_id, subscription_status, subscription_tier, stripe_subscription_id')
      .eq('id', userId)
      .single() as {
        data: {
          email: string
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: string | null
          stripe_subscription_id: string | null
        } | null
        error: any
      }

    console.log('Database query result:', { user, userError })

    if (userError || !user) {
      console.log('User not found in database:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Legacy users: status='active' but no Stripe IDs
    // Decision: Keep legacy access during migration, let them create Stripe subscription
    if (
      user.subscription_status === 'active' &&
      !user.stripe_subscription_id
    ) {
      console.log(`Legacy user ${userId} creating first Stripe subscription - will replace legacy access`)
      // Allow through - their legacy access will be replaced by real Stripe subscription
    }

    // ===== TIER RESOLUTION =====
    // Resolve tier with fallback: explicit tier → userType mapping → default 'pro'
    const tier: SubscriptionTier = providedTier || (userType === 'gapfinder' ? 'plus' : 'pro')
    console.log('Resolved tier:', tier, '(from providedTier:', providedTier, ', userType:', userType, ')')

    // Block users with real Stripe subscriptions from creating duplicates
    // Include past_due to prevent users in dunning from creating second subscription
    const activeStatuses = ['active', 'trialing', 'past_due']
    if (
      activeStatuses.includes(user.subscription_status || '') &&
      user.stripe_subscription_id
    ) {
      const currentTier = user.subscription_tier || 'free'
      return NextResponse.json({
        error: 'Already subscribed',
        message: currentTier === 'pro' && tier === 'plus'
          ? 'To upgrade to Plus, use the upgrade button on the pricing page.'
          : 'You already have an active subscription',
        redirectUrl: currentTier === 'pro' && tier === 'plus' ? '/pricing' : undefined
      }, { status: 400 })
    }

    // Validate and repair stale customer ID
    let customerId = user.stripe_customer_id

    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId)
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          console.log('Stale customer ID, clearing:', customerId)
          await (adminSupabase
            .from('users') as any)
            .update({ stripe_customer_id: null })
            .eq('id', userId)
          customerId = null
        } else {
          throw error
        }
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.email, // Use email as name since full_name doesn't exist
        metadata: {
          user_id: userId,
          user_type: userType || 'unknown'
        }
      })
      customerId = customer.id

      // Save customer ID to user record using admin client
      await adminSupabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    // Get base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // ===== BILLING INTERVAL NORMALIZATION =====
    // Accept both 'monthly'/'annual' and 'month'/'year', normalize to 'month'/'year'
    let normalizedInterval: BillingInterval = billingInterval
    if (billingInterval === 'monthly') normalizedInterval = 'month'
    if (billingInterval === 'annual') normalizedInterval = 'year'
    console.log('Normalized billing interval:', normalizedInterval)

    // ===== REDIRECT PATH DETERMINATION =====
    // Determine success redirect based on tier
    const defaultRedirect = tier === 'plus' ? '/gapfinder' : '/search'
    const finalRedirectPath = redirectPath || defaultRedirect

    // Build success URL with redirect path
    let successUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`
    successUrl += `&redirect=${encodeURIComponent(finalRedirectPath)}`

    // Customize messaging based on tier and user type
    const getCustomText = (tier: SubscriptionTier, userType?: string) => {
      if (tier === 'plus') {
        return {
          description: 'Find retail white space and analyse operator coverage',
          custom_text: 'Start your 30-day free trial and use GapFinder to spot better market opportunities'
        }
      }

      // Pro tier messaging based on userType
      switch (userType) {
        case 'agency':
          return {
            description: 'Showcase your properties to qualified occupiers',
            custom_text: 'Start your 30-day free trial and browse thousands of active requirements'
          }
        case 'sitesketcher':
          return {
            description: 'Visualize and plan your property projects',
            custom_text: 'Start your 30-day free trial and access SiteSketcher visualization tools'
          }
        case 'gapfinder':
          // Note: gapfinder userType with pro tier shouldn't normally happen, but handle gracefully
          return {
            description: 'Access property search tools',
            custom_text: 'Start your 30-day free trial and search thousands of properties'
          }
        case 'searcher':
        default:
          return {
            description: 'Access thousands of property listings',
            custom_text: 'Start your 30-day free trial and search thousands of properties'
          }
      }
    }

    const customText = getCustomText(tier, userType)

    // ===== PRICE AND COUPON SELECTION =====
    // Select price ID and coupon based on tier and interval
    const priceId = SUBSCRIPTION_CONFIG.getPriceIdForTier(tier, normalizedInterval)
    const couponId = SUBSCRIPTION_CONFIG.getCouponIdForTier(tier, normalizedInterval)

    console.log('Creating checkout session for user:', userId)
    console.log('Billing interval:', billingInterval)
    console.log('Using price:', priceId)
    console.log('Applying coupon:', couponId)

    // Create Stripe Checkout session with discount at top level
    let sessionConfig: any = {
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      client_reference_id: userId, // Pass user ID to success page for session restoration
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      discounts: [
        {
          coupon: couponId, // Apply coupon directly to checkout session
        },
      ],
      subscription_data: {
        trial_period_days: SUBSCRIPTION_CONFIG.TRIAL_DAYS,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel',
          },
        },
        metadata: {
          user_id: userId,
          user_type: userType || 'unknown',
          billing_interval: normalizedInterval,
          tier: tier  // ← CRITICAL: Include tier in subscription metadata
        }
      },
      success_url: successUrl,
      cancel_url: `${baseUrl}/pricing`,
      billing_address_collection: 'required',
      phone_number_collection: {
        enabled: true,
      },
      consent_collection: {
        terms_of_service: 'required'
      },
      custom_text: {
        submit: {
          message: customText.custom_text
        },
        terms_of_service_acceptance: {
          message: 'I agree to the Terms of Service and understand I can cancel anytime during my trial'
        }
      },
      metadata: {
        user_id: userId,
        user_type: userType || 'unknown',
        billing_interval: normalizedInterval,
        tier: tier  // ← Also include tier in session metadata
      }
    }

    // Create session with coupon applied to subscription
    const session = await stripe.checkout.sessions.create(sessionConfig)

    return NextResponse.json({
      sessionId: session.id,
      url: session.url
    })

  } catch (error) {
    console.error('Error creating checkout session:', error)
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
