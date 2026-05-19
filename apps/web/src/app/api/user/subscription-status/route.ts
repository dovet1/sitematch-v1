import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getUserSubscriptionStatus } from '@/lib/subscription'

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
      return NextResponse.json({ subscriptionStatus: null })
    }

    // Get subscription status and tier from database
    const subscription = await getUserSubscriptionStatus(user.id)

    return NextResponse.json({
      subscriptionStatus: subscription?.subscription_status || null,
      subscription_tier: subscription?.subscription_tier || 'free',  // Default to free if not set
      hasStripeSubscription: !!subscription?.stripe_subscription_id  // NEW
    })

  } catch (error) {
    console.error('Error fetching subscription status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    )
  }
}
