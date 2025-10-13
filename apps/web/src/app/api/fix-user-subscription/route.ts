import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Create admin client
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Update subscription status
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const { error, data } = await adminSupabase
      .from('users')
      .update({
        subscription_status: 'trialing',
        trial_start_date: now.toISOString(),
        trial_end_date: trialEnd.toISOString(),
        payment_method_added: true,
        trial_will_convert: true
      })
      .eq('email', email)
      .select()

    console.log('Fixed user subscription:', { data, error })

    return NextResponse.json({
      success: !error,
      data,
      error: error?.message
    })
  } catch (error) {
    console.error('Fix subscription error:', error)
    return NextResponse.json(
      { error: 'Fix failed', details: error },
      { status: 500 }
    )
  }
}