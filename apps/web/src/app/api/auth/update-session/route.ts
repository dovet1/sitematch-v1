import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

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

    // Generate a unique session ID for this login
    // This will be used to invalidate other sessions
    const sessionId = randomUUID()

    console.log('Updating session for user:', user.id, 'with session ID:', sessionId)

    // Update the user's current session ID in the database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        current_session_id: sessionId,
        last_session_change: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating session:', updateError)
      return NextResponse.json(
        { error: 'Failed to update session', details: updateError.message },
        { status: 500 }
      )
    }

    console.log('Session updated successfully for user:', user.id)

    return NextResponse.json({
      success: true,
      sessionId
    })
  } catch (error) {
    console.error('Session update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
