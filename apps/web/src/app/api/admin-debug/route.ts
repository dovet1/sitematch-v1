import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Verify admin access first
    const admin = await requireAdmin()
    console.log('Admin user:', admin)
    
    const supabase = createClient()
    
    // Test 1: Check all agencies (no filters)
    console.log('=== TEST 1: All agencies (no filters) ===')
    const { data: allAgencies, error: allError } = await supabase
      .from('agencies')
      .select('id, name, status, created_by, created_at')
    
    console.log('All agencies:', allAgencies)
    console.log('Error:', allError)
    
    // Test 2: Check only pending agencies (status filter only)
    console.log('=== TEST 2: Pending agencies only ===')
    const { data: pendingOnly, error: pendingError } = await supabase
      .from('agencies')
      .select('id, name, status, created_by, created_at')
      .eq('status', 'pending')
    
    console.log('Pending agencies:', pendingOnly)
    console.log('Error:', pendingError)
    
    // Test 3: Try with the exact admin query (without foreign key)
    console.log('=== TEST 3: Admin query without FK join ===')
    const { data: adminQuery, error: adminError } = await supabase
      .from('agencies')
      .select('id, name, logo_url, coverage_areas, specialisms, status, created_at, created_by')
      .in('status', ['pending', 'draft'])
      .order('created_at', { ascending: true })
    
    console.log('Admin query result:', adminQuery)
    console.log('Error:', adminError)
    
    // Test 4: Try with foreign key join
    console.log('=== TEST 4: With foreign key join ===')
    const { data: withJoin, error: joinError } = await supabase
      .from('agencies')
      .select(`
        id,
        name,
        status,
        created_by,
        users!agencies_created_by_fkey(email)
      `)
      .eq('status', 'pending')
    
    console.log('With join result:', withJoin)
    console.log('Join error:', joinError)

    return NextResponse.json({
      success: true,
      admin_user: {
        id: admin.id,
        email: admin.email
      },
      tests: {
        allAgencies: { data: allAgencies, error: allError, count: allAgencies?.length || 0 },
        pendingOnly: { data: pendingOnly, error: pendingError, count: pendingOnly?.length || 0 },
        adminQuery: { data: adminQuery, error: adminError, count: adminQuery?.length || 0 },
        withJoin: { data: withJoin, error: joinError, count: withJoin?.length || 0 }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}