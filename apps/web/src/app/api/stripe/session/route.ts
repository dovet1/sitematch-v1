import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.latest_invoice']
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get subscription details
    const subscription = session.subscription as any
    const invoice = subscription?.latest_invoice as any

    // Calculate the amount (in pounds, Stripe uses pence)
    const amount = invoice?.total ? invoice.total / 100 : 975
    const discount = invoice?.discount || invoice?.total_discount_amounts?.[0]

    // Get trial end date
    const trialEnd = subscription?.trial_end
      ? new Date(subscription.trial_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    return NextResponse.json({
      amount,
      trialEndDate: trialEnd.toISOString(),
      hasDiscount: !!discount,
      originalAmount: 975
    })

  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session details' },
      { status: 500 }
    )
  }
}