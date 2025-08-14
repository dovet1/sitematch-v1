// Agency Draft API - Story 18.3
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
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

    const supabase = createClient()
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

// PUT /api/agencies/[id]/draft - Update draft version (auto-save)
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
    const { changes, versionId } = body

    const supabase = createClient()
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

    // Get current draft version
    const { data: currentDraft, error: draftError } = await supabase
      .from('agency_versions')
      .select('data')
      .eq('id', versionId)
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .single()

    if (draftError || !currentDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    // Merge changes with current draft data
    const updatedData = {
      ...currentDraft.data,
      ...changes
    }

    // Update the draft version
    const { data: updatedVersion, error: updateError } = await supabase
      .from('agency_versions')
      .update({
        data: updatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', versionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating draft:', updateError)
      return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
    }

    return NextResponse.json({ 
      version: updatedVersion,
      message: 'Draft auto-saved'
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

    const supabase = createClient()
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