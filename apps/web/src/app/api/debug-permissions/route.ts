import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Use admin client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    // Test if we can run a simple query
    const { data, error } = await supabase.rpc('version')

    console.log('Basic RPC test:', { data, error })

    // Try to count users (should work if we have SELECT permission)
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact' })

    console.log('Count test:', { count, error: countError })

    return NextResponse.json({
      rpc: { data, error },
      count: { count, error: countError }
    })

  } catch (err) {
    console.error('Debug permissions error:', err)
    return NextResponse.json({
      error: 'Unexpected error',
      details: err
    }, { status: 500 })
  }
}