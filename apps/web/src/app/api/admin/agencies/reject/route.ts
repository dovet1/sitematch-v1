// Admin Agency Rejection API - Story 18.5
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin()
    
    const body = await request.json()
    const { agencyId, versionId, reason, adminNotes } = body

    if (!agencyId) {
      return NextResponse.json({ error: 'Agency ID is required' }, { status: 400 })
    }

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
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

    // Check if there's a pending version to reject
    const { data: pendingVersion, error: versionError } = await supabase
      .from('agency_versions')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .single()

    if (versionError || !pendingVersion) {
      return NextResponse.json({ error: 'No pending version found to reject' }, { status: 404 })
    }

    // Update the pending version to rejected
    const { error: updateVersionError } = await supabase
      .from('agency_versions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        admin_notes: reason + (adminNotes ? `\n\nAdmin Notes: ${adminNotes}` : '')
      })
      .eq('id', pendingVersion.id)

    if (updateVersionError) {
      console.error('Error rejecting version:', updateVersionError)
      return NextResponse.json({ error: 'Failed to reject version' }, { status: 500 })
    }

    // Only update agency status to rejected if this is the first submission (no approved versions exist)
    const { data: approvedVersions } = await supabase
      .from('agency_versions')
      .select('id')
      .eq('agency_id', agencyId)
      .eq('status', 'approved')

    if (!approvedVersions || approvedVersions.length === 0) {
      // No approved versions exist, so reject the entire agency
      const { error: updateAgencyError } = await supabase
        .from('agencies')
        .update({
          status: 'rejected',
          admin_notes: reason + (adminNotes ? `\n\nAdmin Notes: ${adminNotes}` : '')
        })
        .eq('id', agencyId)

      if (updateAgencyError) {
        console.error('Error rejecting agency:', updateAgencyError)
        // Don't fail for this - the version rejection is the important part
      }
    }

    // Cancel pending invitations
    const { error: invitationError } = await supabase
      .from('agency_invitations')
      .update({ status: 'cancelled' })
      .eq('agency_id', agencyId)
      .eq('status', 'pending')

    if (invitationError) {
      console.error('Error cancelling invitations:', invitationError)
      // Don't fail the rejection for this
    }

    // TODO: Send rejection email to agency creator with reason and guidance
    // This would integrate with your existing email service
    console.log('Agency version rejected:', {
      agencyId,
      versionId: pendingVersion.id,
      agencyName: agency.name,
      rejectedBy: admin.id,
      reason,
      adminNotes
    })

    // TODO: Log the rejection action for audit trail
    // This would integrate with your existing audit logging system

    return NextResponse.json({
      success: true,
      message: 'Agency version rejected successfully',
      agency: {
        id: agencyId,
        name: agency.name,
        versionId: pendingVersion.id,
        reason
      }
    })

  } catch (error) {
    console.error('Error in agency rejection:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}