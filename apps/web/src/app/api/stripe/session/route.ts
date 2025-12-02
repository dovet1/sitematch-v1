import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: [
        'subscription',
        'subscription.discounts',
        'subscription.items.data.price'
      ]
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get subscription details
    const subscription = session.subscription as any

    // Get the base price from subscription items
    const baseAmount = subscription?.items?.data?.[0]?.price?.unit_amount
      ? subscription.items.data[0].price.unit_amount / 100
      : 975

    // Check if there's a discount/coupon applied
    const discount = subscription?.discounts?.[0]
    let finalAmount = baseAmount

    if (discount?.coupon) {
      const coupon = discount.coupon
      if (coupon.percent_off) {
        // Percentage discount
        finalAmount = baseAmount * (1 - coupon.percent_off / 100)
      } else if (coupon.amount_off) {
        // Fixed amount discount (in pence)
        finalAmount = baseAmount - (coupon.amount_off / 100)
      }
    }

    // Get trial end date
    const trialEnd = subscription?.trial_end
      ? new Date(subscription.trial_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    return NextResponse.json({
      amount: finalAmount,
      trialEndDate: trialEnd.toISOString(),
      hasDiscount: !!discount,
      originalAmount: baseAmount,
      userId: session.client_reference_id // Include user ID for session restoration
    })

  } catch (error) {
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session details' },
      { status: 500 }
    )
  }
}