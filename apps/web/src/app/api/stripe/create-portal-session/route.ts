import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from session
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
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      )
    }

    // Get user's Stripe customer ID using admin client
    const adminSupabase = createAdminClient()
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If no Stripe customer exists yet, create one
    let customerId = userData.stripe_customer_id
    if (!customerId) {
      console.log('Creating Stripe customer for user:', user.id)
      const customer = await stripe.customers.create({
        email: userData.email,
        metadata: {
          user_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID to database
      await adminSupabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Get base URL for return URL
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/occupier/dashboard`,
    })

    return NextResponse.json({
      url: session.url
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