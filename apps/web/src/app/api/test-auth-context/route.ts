import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    console.log('=== AUTH CONTEXT DEBUG START ===')
    
    // Use server client like the auth functions do
    const supabase = createServerClient()
    
    // Test 1: Raw Supabase auth
    console.log('Testing raw Supabase auth...')
    const { data: { user: rawUser }, error: rawError } = await supabase.auth.getUser()
    console.log('Raw user:', rawUser)
    console.log('Raw error:', rawError)
    
    // Test 2: getCurrentUser function
    console.log('Testing getCurrentUser function...')
    const user = await getCurrentUser()
    console.log('getCurrentUser result:', user)
    
    // Test 3: Check cookies
    console.log('Checking cookies...')
    const cookies = request.headers.get('cookie')
    console.log('Request cookies:', cookies)
    
    // Test 4: Try agencies query
    console.log('Testing agencies query...')
    const { data: agencies, error: agenciesError } = await supabase
      .from('agencies')
      .select('id, name, status, created_by')
      .eq('status', 'pending')
    
    console.log('Agencies result:', agencies)
    console.log('Agencies error:', agenciesError)
    
    // Test 5: Check if we're getting any users at all
    console.log('Testing users query...')
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role')
      .limit(5)
    
    console.log('Users result:', users)
    console.log('Users error:', usersError)

    console.log('=== AUTH CONTEXT DEBUG END ===')

    return NextResponse.json({
      success: true,
      debug: {
        rawAuth: { user: rawUser, error: rawError },
        getCurrentUser: user,
        cookies: cookies,
        agencies: { data: agencies, error: agenciesError, count: agencies?.length || 0 },
        users: { data: users, error: usersError, count: users?.length || 0 }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Auth context test error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}