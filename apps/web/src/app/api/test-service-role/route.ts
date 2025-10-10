import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  // Use admin client
  const supabase = createAdminClient()

  try {
    console.log(`Testing service role update for user: ${userId}`)

    // First, let's verify the user exists
    const { data: userData, error: selectError } = await supabase
      .from('users')
      .select('id, email, subscription_status')
      .eq('id', userId)
      .single() as { data: { id: string; email: string; subscription_status: string | null } | null; error: any }

    if (selectError) {
      console.error('Service role SELECT failed:', selectError)
      return NextResponse.json({
        success: false,
        error: 'SELECT failed: ' + selectError.message,
        details: selectError
      })
    }

    console.log('User found:', userData)

    // Try simple update
    const { data, error } = await (supabase
      .from('users') as any)
      .update({ subscription_status: 'trialing' })
      .eq('id', userId)
      .select()

    if (error) {
      console.error('Service role UPDATE failed:', error)
      return NextResponse.json({
        success: false,
        error: 'UPDATE failed: ' + error.message,
        details: error
      })
    }

    console.log('Service role UPDATE result:', data)

    return NextResponse.json({
      success: true,
      updated: data?.length || 0,
      data,
      userBefore: userData
    })

  } catch (err) {
    console.error('Service role test error:', err)
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: err
    }, { status: 500 })
  }
}