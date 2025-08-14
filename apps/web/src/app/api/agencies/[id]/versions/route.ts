// Agency Versions API - Story 18.3
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

// GET /api/agencies/[id]/versions - Get version history
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

    // Get version history
    const { data: versions, error } = await supabase
      .from('agency_versions')
      .select(`
        id,
        version_number,
        data,
        status,
        admin_notes,
        created_at,
        created_by,
        reviewed_at,
        reviewed_by,
        users!agency_versions_created_by_fkey(email),
        reviewers:users!agency_versions_reviewed_by_fkey(email)
      `)
      .eq('agency_id', agencyId)
      .order('version_number', { ascending: false })

    if (error) {
      console.error('Error fetching versions:', error)
      return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 })
    }

    return NextResponse.json({ versions })
  } catch (error) {
    console.error('Error in versions GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/agencies/[id]/versions - Create new version (draft)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { changes, changeType = 'minor' } = body

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

    // Get current agency data
    const { data: currentAgency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single()

    if (agencyError || !currentAgency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }

    // Get next version number
    const { data: lastVersion } = await supabase
      .from('agency_versions')
      .select('version_number')
      .eq('agency_id', agencyId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    const nextVersionNumber = (lastVersion?.version_number || 0) + 1

    // Merge changes with current data
    const versionData = {
      ...currentAgency,
      ...changes,
      // Track what changed
      _changes: {
        fields: Object.keys(changes),
        changeType,
        previousValues: Object.keys(changes).reduce((prev, key) => ({
          ...prev,
          [key]: currentAgency[key]
        }), {})
      }
    }

    // Create new version
    const { data: version, error: versionError } = await supabase
      .from('agency_versions')
      .insert({
        agency_id: agencyId,
        version_number: nextVersionNumber,
        data: versionData,
        status: 'pending',
        created_by: user.id
      })
      .select()
      .single()

    if (versionError) {
      console.error('Error creating version:', versionError)
      return NextResponse.json({ error: 'Failed to create version' }, { status: 500 })
    }

    return NextResponse.json({ 
      version,
      message: 'Draft version created successfully'
    })
  } catch (error) {
    console.error('Error in versions POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}