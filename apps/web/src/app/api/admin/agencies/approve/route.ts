// Admin Agency Approval API - Story 18.5
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const admin = await requireAdmin()
    
    const body = await request.json()
    const { agencyId, adminNotes } = body

    if (!agencyId) {
      return NextResponse.json({ error: 'Agency ID is required' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Get the agency first to verify it exists and can be approved
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }

    if (agency.status === 'approved') {
      return NextResponse.json({ error: 'Agency is already approved' }, { status: 400 })
    }

    // Update agency status to approved
    const { error: updateError } = await supabase
      .from('agencies')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: admin.id,
        admin_notes: adminNotes || null
      })
      .eq('id', agencyId)

    if (updateError) {
      console.error('Error approving agency:', updateError)
      return NextResponse.json({ error: 'Failed to approve agency' }, { status: 500 })
    }

    // Update any pending version to approved
    console.log('=== UPDATING AGENCY VERSIONS ===')
    console.log('Agency ID:', agencyId)
    console.log('Admin ID:', admin.id)
    
    // First check what versions exist
    const { data: existingVersions, error: checkError } = await supabase
      .from('agency_versions')
      .select('*')
      .eq('agency_id', agencyId)
    
    console.log('Existing versions for agency:', existingVersions)
    console.log('Check error:', checkError)
    
    const { data: updatedVersions, error: versionError } = await supabase
      .from('agency_versions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: admin.id,
        admin_notes: adminNotes || null
      })
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .select('*')

    console.log('Updated versions:', updatedVersions)
    console.log('Version update error:', versionError)

    // TODO: Send approval email to agency creator and team members
    // This would integrate with your existing email service
    console.log('Agency approved:', {
      agencyId,
      agencyName: agency.name,
      approvedBy: admin.id,
      adminNotes
    })

    // TODO: Log the approval action for audit trail
    // This would integrate with your existing audit logging system

    return NextResponse.json({
      success: true,
      message: 'Agency approved successfully',
      agency: {
        id: agencyId,
        name: agency.name,
        status: 'approved'
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