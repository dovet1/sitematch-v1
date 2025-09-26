import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const supabase = createClient()

    // Get user's Stripe customer ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (userError || !user || !user.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 })
    }

    // Get base URL for return URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Create customer portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${baseUrl}/account/subscription`,
    })

    return NextResponse.json({
      url: session.url
    })

  } catch (error) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}