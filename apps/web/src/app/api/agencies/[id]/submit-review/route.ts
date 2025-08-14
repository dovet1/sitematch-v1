import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { sendEmail } from '@/lib/resend'
import { createAgencySubmissionNotification } from '@/lib/email-templates'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const agencyId = params.id
    const body = await request.json()
    const { versionId } = body

    const supabase = createServerClient()

    // Verify user is admin of this agency
    const { data: membership, error: membershipError } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('user_id', user.id)
      .eq('agency_id', agencyId)
      .single()

    if (membershipError || !membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    // Get the agency and verify it exists (fresh data)
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', agencyId)
      .single()

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 })
    }

    console.log('Creating version with agency data:', {
      agencyId,
      logo_url: agency.logo_url,
      isBlob: agency.logo_url?.startsWith('blob:')
    })

    // Check if there's already a pending version
    const { data: existingVersion, error: versionError } = await supabase
      .from('agency_versions')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .single()

    if (existingVersion) {
      // Update the existing pending version with submission timestamp
      const { error: updateError } = await supabase
        .from('agency_versions')
        .update({
          submitted_for_review_at: new Date().toISOString()
        })
        .eq('id', existingVersion.id)

      if (updateError) {
        console.error('Error updating version submission timestamp:', updateError)
        return NextResponse.json({ error: 'Failed to submit for review' }, { status: 500 })
      }
    } else {
      // Get the next version number
      const { data: latestVersion } = await supabase
        .from('agency_versions')
        .select('version_number')
        .eq('agency_id', agencyId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single()

      const nextVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1

      // Get current team members to include in version
      const { data: teamMembers } = await supabase
        .from('agency_agents')
        .select('user_id, email, name, phone, role, coverage_area, is_registered, headshot_url')
        .eq('agency_id', agencyId)

      // Create a new version from current agency data including team members
      const { error: createVersionError } = await supabase
        .from('agency_versions')
        .insert({
          agency_id: agencyId,
          version_number: nextVersionNumber,
          data: {
            name: agency.name,
            description: agency.description,
            website: agency.website,
            logo_url: agency.logo_url,
            coverage_areas: agency.coverage_areas,
            specialisms: agency.specialisms,
            // Include team members in version data
            direct_agents: teamMembers?.filter(m => m.is_registered).map(member => ({
              email: member.email,
              name: member.name,
              phone: member.phone,
              role: member.role,
              coverageArea: member.coverage_area,
              headshotUrl: member.headshot_url
            })) || [],
            invite_agents: teamMembers?.filter(m => !m.is_registered).map(member => ({
              email: member.email,
              name: member.name,
              role: member.role
            })) || []
          },
          status: 'pending',
          created_by: user.id,
          submitted_for_review_at: new Date().toISOString()
        })

      if (createVersionError) {
        console.error('Error creating version for review:', createVersionError)
        return NextResponse.json({ error: 'Failed to create version for review' }, { status: 500 })
      }
    }

    // Update agency status to pending if it's currently draft
    if (agency.status === 'draft') {
      const { error: updateAgencyError } = await supabase
        .from('agencies')
        .update({ status: 'pending' })
        .eq('id', agencyId)

      if (updateAgencyError) {
        console.error('Error updating agency status:', updateAgencyError)
        return NextResponse.json({ error: 'Failed to update agency status' }, { status: 500 })
      }
    }

    // Send notification to admins about pending review
    try {
      // Use admin client only for reading user emails for notifications
      // This is safe because: 1) user is authenticated, 2) only reading emails, 3) legitimate business purpose
      const adminSupabase = createAdminClient()
      
      // Get admin users - using role = 'admin'
      const { data: adminUsers } = await adminSupabase
        .from('users')
        .select('email')
        .eq('role', 'admin')

      if (adminUsers && adminUsers.length > 0) {
        // Get submitter details for the email notification
        const { data: submitterUser } = await adminSupabase
          .from('users')
          .select('email')
          .eq('id', user.id)
          .single()

        const submitterName = submitterUser?.email?.split('@')[0] || 'Unknown User'

        const submittedAt = new Date().toISOString()
        const emailTemplate = createAgencySubmissionNotification({
          agencyName: agency.name,
          submitterName,
          submittedAt,
          adminPanelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/agencies`
        })

        // Send to all admins
        const adminEmails = adminUsers.map(admin => admin.email).filter(Boolean)
        if (adminEmails.length > 0) {
          await sendEmail({
            to: adminEmails,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
            text: emailTemplate.text
          })

          console.log('✅ Admin notification emails sent to:', adminEmails)
        }
      }
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError)
      // Don't fail the submission if email fails
    }

    console.log('Agency submitted for review:', {
      agencyId,
      agencyName: agency.name,
      submittedBy: user.id,
      submittedAt: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Changes submitted for review successfully',
      agency: {
        id: agencyId,
        name: agency.name,
        status: agency.status === 'draft' ? 'pending' : agency.status
      }
    })

  } catch (error) {
    console.error('Error in submit-for-review:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}