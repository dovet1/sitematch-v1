import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { getUserSubscriptionStatus, getSubscriptionDisplayStatus } from '@/lib/subscription'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    const user = await getUserSubscriptionStatus(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const displayStatus = getSubscriptionDisplayStatus(user)

    return NextResponse.json({
      subscription: {
        status: user.subscription_status,
        trial_start_date: user.trial_start_date,
        trial_end_date: user.trial_end_date,
        stripe_customer_id: user.stripe_customer_id,
        stripe_subscription_id: user.stripe_subscription_id,
        payment_method_added: user.payment_method_added
      },
      display: displayStatus
    })

  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Verify user authentication
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser || authUser.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserSubscriptionStatus(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const displayStatus = getSubscriptionDisplayStatus(user)

    return NextResponse.json({
      subscription: {
        status: user.subscription_status,
        trial_start_date: user.trial_start_date,
        trial_end_date: user.trial_end_date,
        stripe_customer_id: user.stripe_customer_id,
        stripe_subscription_id: user.stripe_subscription_id,
        payment_method_added: user.payment_method_added
      },
      display: displayStatus
    })

  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}