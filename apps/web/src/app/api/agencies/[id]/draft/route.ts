// Agency Draft API - Story 18.3
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// GET /api/agencies/[id]/draft - Get current draft version
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const agencyId = params.id

    // Check if user has access to this agency
    const { data: membership } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get current draft version (pending status)
    const { data: draft, error } = await supabase
      .from('agency_versions')
      .select(`
        id,
        version_number,
        data,
        status,
        admin_notes,
        created_at,
        updated_at
      `)
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching draft:', error)
      return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 })
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Error in draft GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/agencies/[id]/draft - Update agency draft (auto-save)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { changes } = body

    const supabase = createServerClient()
    const agencyId = params.id

    // Check if user has admin access
    const { data: membership } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Update the agency directly
    const { data: updatedAgency, error: updateError } = await supabase
      .from('agencies')
      .update({
        name: changes.name,
        description: changes.description,
        website: changes.website,
        logo_url: changes.logo_url,
        coverage_areas: changes.coverage_areas,
        specialisms: changes.specialisms
      })
      .eq('id', agencyId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating agency draft:', updateError)
      return NextResponse.json({ error: 'Failed to save changes' }, { status: 500 })
    }

    console.log('Agency draft saved:', {
      agencyId,
      agencyName: updatedAgency.name,
      savedBy: user.id,
      savedAt: new Date().toISOString()
    })

    return NextResponse.json({ 
      agency: updatedAgency,
      message: 'Changes saved successfully'
    })
  } catch (error) {
    console.error('Error in draft PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/agencies/[id]/draft - Discard draft version
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const agencyId = params.id

    // Check if user has admin access
    const { data: membership } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .single()

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Delete pending draft versions
    const { error } = await supabase
      .from('agency_versions')
      .delete()
      .eq('agency_id', agencyId)
      .eq('status', 'pending')

    if (error) {
      console.error('Error deleting draft:', error)
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Draft discarded successfully' })
  } catch (error) {
    console.error('Error in draft DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}