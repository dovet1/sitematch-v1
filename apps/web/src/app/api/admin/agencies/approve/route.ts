// Admin Agency Approval API - Story 18.5
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin()
    
    const body = await request.json()
    const { agencyId, versionId, adminNotes } = body

    if (!agencyId) {
      return NextResponse.json({ error: 'Agency ID is required' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Get the agency first to verify it exists
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }

    // Check if there's a pending version to approve
    const { data: pendingVersion, error: versionError } = await supabase
      .from('agency_versions')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .single()

    if (versionError || !pendingVersion) {
      return NextResponse.json({ error: 'No pending version found to approve' }, { status: 404 })
    }

    // Approve the pending version
    const { error: approveVersionError } = await supabase
      .from('agency_versions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        admin_notes: adminNotes || null
      })
      .eq('id', pendingVersion.id)

    if (approveVersionError) {
      console.error('Error approving version:', approveVersionError)
      return NextResponse.json({ error: 'Failed to approve version' }, { status: 500 })
    }

    // Update agency with the approved version data
    const versionData = typeof pendingVersion.data === 'string' 
      ? JSON.parse(pendingVersion.data) 
      : pendingVersion.data

    const { error: updateAgencyError } = await supabase
      .from('agencies')
      .update({
        name: versionData.name,
        description: versionData.description,
        website: versionData.website,
        logo_url: versionData.logo_url,
        coverage_areas: versionData.coverage_areas,
        specialisms: versionData.specialisms,
        status: 'approved',
        approved_at: new Date().toISOString(),
        admin_notes: adminNotes || null
      })
      .eq('id', agencyId)

    if (updateAgencyError) {
      console.error('Error updating agency:', updateAgencyError)
      return NextResponse.json({ error: 'Failed to update agency' }, { status: 500 })
    }

    // TODO: Send approval email to agency creator and team members
    // This would integrate with your existing email service
    console.log('Agency version approved:', {
      agencyId,
      versionId: pendingVersion.id,
      agencyName: versionData.name,
      approvedBy: admin.id,
      adminNotes
    })

    // TODO: Log the approval action for audit trail
    // This would integrate with your existing audit logging system

    return NextResponse.json({
      success: true,
      message: 'Agency version approved successfully',
      agency: {
        id: agencyId,
        name: versionData.name,
        status: 'approved',
        versionId: pendingVersion.id
      }
    })

  } catch (error) {
    console.error('Error in agency approval:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}