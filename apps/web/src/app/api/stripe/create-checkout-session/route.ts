import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { stripe, SUBSCRIPTION_CONFIG } from '@/lib/stripe'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId: providedUserId, userType, redirectPath } = await request.json()
    console.log('API called with userId:', providedUserId)

    let userId = providedUserId

    // If no userId provided, try to get it from the session
    if (!userId) {
      const cookieStore = cookies()
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
        return NextResponse.json({ error: 'User authentication required' }, { status: 401 })
      }

      userId = user.id
      console.log('Got userId from session:', userId)
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Create admin client with service role key for database operations
    const adminSupabase = createAdminClient()

    // Get user details using admin client to bypass RLS
    const { data: user, error: userError } = await adminSupabase
      .from('users')
      .select('email, stripe_customer_id, subscription_status')
      .eq('id', userId)
      .single() as { data: { email: string; stripe_customer_id: string | null; subscription_status: string | null } | null; error: any }

    console.log('Database query result:', { user, userError })

    if (userError || !user) {
      console.log('User not found in database:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user already has an active subscription or trial
    if (user.subscription_status === 'active' || user.subscription_status === 'trialing') {
      console.log(`User ${userId} already has ${user.subscription_status} subscription`)
      return NextResponse.json(
        {
          error: 'Already subscribed',
          subscriptionStatus: user.subscription_status,
          message: 'You already have an active subscription'
        },
        { status: 400 }
      )
    }

    // Create or get Stripe customer
    let customerId = user.stripe_customer_id

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
      await (adminSupabase
        .from('users') as any)
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
    }

    // Get base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Determine success redirect based on user journey
    let successUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`
    if (redirectPath) {
      successUrl += `&redirect=${encodeURIComponent(redirectPath)}`
    }

    // Customize messaging based on user type
    const getCustomText = (userType?: string) => {
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
        case 'searcher':
        default:
          return {
            description: 'Access thousands of property listings',
            custom_text: 'Start your 30-day free trial and search thousands of properties'
          }
      }
    }

    const customText = getCustomText(userType)

    // Prepare discount configuration
    const couponId = process.env.STRIPE_COUPON_ID // SITEMATCHERINTRO coupon (50% off once)

    console.log('Creating checkout session for user:', userId)
    console.log('Using price:', SUBSCRIPTION_CONFIG.PRICE_ID)
    console.log('Applying coupon:', couponId)

    // Create Stripe Checkout session with discount at top level
    let sessionConfig: any = {
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: SUBSCRIPTION_CONFIG.PRICE_ID,
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
          user_type: userType || 'unknown'
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
        user_type: userType || 'unknown'
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