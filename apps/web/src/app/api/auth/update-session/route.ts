import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST() {
  const supabase = await createServerClient()

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

    console.log('[UPDATE-SESSION] User:', user.id, 'New Session ID:', sessionId)

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

    console.log('[UPDATE-SESSION] Session updated successfully. Setting cookie.')

    // Create response with session ID
    const response = NextResponse.json({
      success: true,
      sessionId
    })

    // Set the session_id cookie server-side to ensure it's available immediately
    response.cookies.set('session_id', sessionId, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      sameSite: 'lax',
      httpOnly: false, // Allow client-side access for validation
      secure: process.env.NODE_ENV === 'production'
    })

    console.log('[UPDATE-SESSION] Cookie set in response for session:', sessionId)

    return response
  } catch (error) {
    console.error('Session update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
