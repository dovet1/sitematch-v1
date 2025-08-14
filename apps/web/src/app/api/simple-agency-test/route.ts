import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Test the exact query the admin page uses
    const { data: pendingAgencies, error } = await supabase
      .from('agencies')
      .select(`
        id,
        name,
        logo_url,
        coverage_areas,
        specialisms,
        status,
        created_at,
        created_by,
        users!agencies_created_by_fkey(email)
      `)
      .in('status', ['pending', 'draft'])
      .order('created_at', { ascending: true })

    console.log('Query result:', pendingAgencies)
    console.log('Query error:', error)

    // Also test a simpler version
    const { data: simpleQuery, error: simpleError } = await supabase
      .from('agencies')
      .select('id, name, status, created_by')
      .eq('status', 'pending')

    console.log('Simple query result:', simpleQuery)
    console.log('Simple query error:', simpleError)

    return NextResponse.json({
      success: true,
      fullQuery: {
        data: pendingAgencies,
        error: error,
        count: pendingAgencies?.length || 0
      },
      simpleQuery: {
        data: simpleQuery,
        error: simpleError,
        count: simpleQuery?.length || 0
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}