import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createServerClient()

  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Clear the current session ID in the database
    // This will invalidate all sessions on next validation check
    const { error: updateError } = await supabase
      .from('users')
      .update({
        current_session_id: null,
        last_session_change: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error clearing session:', updateError)
      return NextResponse.json(
        { error: 'Failed to clear sessions' },
        { status: 500 }
      )
    }

    // Note: Supabase doesn't expose admin.signOut in client libraries by default
    // The session clearing above will handle invalidation on next request
    // For immediate revocation, you'd need to use the Management API with service role key
    // which should be done via a server-side admin function

    return NextResponse.json({
      success: true,
      message: 'All devices will be logged out on next activity'
    })
  } catch (error) {
    console.error('Global signout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
