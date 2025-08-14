// Admin Agency Rejection API - Story 18.5
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin()
    
    const body = await request.json()
    const { agencyId, reason, adminNotes } = body

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

    if (agency.status === 'approved') {
      return NextResponse.json({ error: 'Cannot reject an approved agency' }, { status: 400 })
    }

    if (agency.status === 'rejected') {
      return NextResponse.json({ error: 'Agency is already rejected' }, { status: 400 })
    }

    // Update agency status to rejected
    const { error: updateError } = await supabase
      .from('agencies')
      .update({
        status: 'rejected',
        admin_notes: reason + (adminNotes ? `\n\nAdmin Notes: ${adminNotes}` : '')
      })
      .eq('id', agencyId)

    if (updateError) {
      console.error('Error rejecting agency:', updateError)
      return NextResponse.json({ error: 'Failed to reject agency' }, { status: 500 })
    }

    // Update any pending version to rejected
    const { error: versionError } = await supabase
      .from('agency_versions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        admin_notes: reason + (adminNotes ? `\n\nAdmin Notes: ${adminNotes}` : '')
      })
      .eq('agency_id', agencyId)
      .eq('status', 'pending')

    if (versionError) {
      console.error('Error updating version status:', versionError)
      // Don't fail the rejection for this
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
    console.log('Agency rejected:', {
      agencyId,
      agencyName: agency.name,
      rejectedBy: admin.id,
      reason,
      adminNotes
    })

    // TODO: Log the rejection action for audit trail
    // This would integrate with your existing audit logging system

    return NextResponse.json({
      success: true,
      message: 'Agency rejected successfully',
      agency: {
        id: agencyId,
        name: agency.name,
        status: 'rejected',
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