import { createServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createServerClient()

  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { valid: false, reason: 'not_authenticated' },
        { status: 401 }
      )
    }

    // Get the session ID from the request body
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { valid: false, reason: 'no_session_id_provided' },
        { status: 400 }
      )
    }

    // Fetch the user's stored session ID from database
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('current_session_id')
      .eq('id', user.id)
      .single()

    if (dbError) {
      console.error('Error fetching user session:', dbError)
      return NextResponse.json(
        { valid: false, reason: 'database_error' },
        { status: 500 }
      )
    }

    // If no session ID is stored, this session is valid by default
    if (!userData.current_session_id) {
      return NextResponse.json({ valid: true })
    }

    // Compare session IDs
    const isValid = userData.current_session_id === sessionId

    return NextResponse.json({
      valid: isValid,
      reason: isValid ? undefined : 'session_mismatch'
    })
  } catch (error) {
    console.error('Session validation error:', error)
    return NextResponse.json(
      { valid: false, reason: 'internal_error' },
      { status: 500 }
    )
  }
}
