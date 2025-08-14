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

    // Handle team member updates if provided (including empty arrays when all members are removed)
    if (changes.directAgents !== undefined || changes.inviteAgents !== undefined) {
      console.log('Updating team members:', {
        directAgents: changes.directAgents?.length || 0,
        inviteAgents: changes.inviteAgents?.length || 0,
        agencyId
      })

      // Get current agency members
      const { data: currentMembers } = await supabase
        .from('agency_agents')
        .select('*')
        .eq('agency_id', agencyId)
      
      console.log('Current members in DB:', currentMembers?.map(m => ({ 
        email: m.email, 
        name: m.name
      })))

      // Create a map of existing members by email for easy lookup
      const existingMembersMap = new Map()
      currentMembers?.forEach(member => {
        existingMembersMap.set(member.email, member)
      })

      // Process direct agents (registered members) - ensure arrays exist
      const directAgents = Array.isArray(changes.directAgents) ? changes.directAgents : []
      const inviteAgents = Array.isArray(changes.inviteAgents) ? changes.inviteAgents : []
      const allNewMembers = [...directAgents, ...inviteAgents]
      
      console.log('Processing members - New member list:', allNewMembers.map(m => m.email))

      // Update or insert members
      for (const member of allNewMembers) {
        const existingMember = existingMembersMap.get(member.email)
        
        if (existingMember) {
          // Update existing member
          await supabase
            .from('agency_agents')
            .update({
              name: member.name,
              phone: member.phone || null,
              role: member.role,
              coverage_area: member.coverageArea || member.coverage_area || null,
              headshot_url: member.headshotUrl || member.headshot_url || null
            })
            .eq('id', existingMember.id)
        } else {
          // Insert new member
          await supabase
            .from('agency_agents')
            .insert({
              agency_id: agencyId,
              email: member.email,
              name: member.name,
              phone: member.phone || null,
              role: member.role,
              coverage_area: member.coverageArea || null,
              headshot_url: member.headshotUrl || null,
              is_registered: directAgents.includes(member), // true for direct agents
              joined_at: new Date().toISOString()
            })
        }
      }

      // Remove members that are no longer in the list
      const newMemberEmails = allNewMembers.map(m => m.email)
      const membersToRemove = currentMembers?.filter(member => 
        !newMemberEmails.includes(member.email) && member.user_id !== user.id // Don't remove the current user
      )

      console.log('Members to remove:', membersToRemove?.map(m => ({ 
        email: m.email, 
        name: m.name
      })))

      if (membersToRemove && membersToRemove.length > 0) {
        // Delete using composite key (agency_id, email)
        for (const member of membersToRemove) {
          const { error: deleteError } = await supabase
            .from('agency_agents')
            .delete()
            .eq('agency_id', agencyId)
            .eq('email', member.email)
          
          if (deleteError) {
            console.error(`Error deleting member ${member.email}:`, deleteError)
          } else {
            console.log(`Successfully deleted member: ${member.email}`)
          }
        }
        console.log('Finished deleting', membersToRemove.length, 'members')
      }
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