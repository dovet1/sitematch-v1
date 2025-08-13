// =====================================================
// Agency Invitation Acceptance API - Story 18.2
// Handle accepting invitations to join agencies
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface AcceptInvitationRequest {
  token: string;
}

// =====================================================
// POST /api/agencies/accept-invite - Accept invitation
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in to accept invitations' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const body: AcceptInvitationRequest = await request.json();

    if (!body.token) {
      return NextResponse.json(
        { success: false, error: 'Token required' },
        { status: 400 }
      );
    }

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('agency_invitations')
      .select(`
        id,
        agency_id,
        email,
        name,
        role,
        status,
        expires_at,
        agencies!inner(
          id,
          name,
          status
        )
      `)
      .eq('token', body.token)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (now > expiresAt) {
      await supabase
        .from('agency_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json(
        { success: false, error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Invitation is ${invitation.status}` },
        { status: 410 }
      );
    }

    // Verify email matches (if user is logged in with different email)
    if (user.email && invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invitation email does not match your account email',
          details: {
            invitedEmail: invitation.email,
            accountEmail: user.email
          }
        },
        { status: 400 }
      );
    }

    // Check if user is already a member of any agency
    const { data: existingMembership } = await supabase
      .from('agency_agents')
      .select('agency_id, agencies!inner(name)')
      .eq('user_id', user.id)
      .single();

    if (existingMembership) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You are already a member of an agency'
        },
        { status: 400 }
      );
    }

    // Check if agency is approved (optional check - might want to allow joining pending agencies)
    if ((invitation.agencies as any).status !== 'approved') {
      // Allow joining but inform about status
      console.log(`User joining agency with status: ${(invitation.agencies as any).status}`);
    }

    // Add user to agency_agents table
    const { error: agentError } = await supabase
      .from('agency_agents')
      .insert({
        agency_id: invitation.agency_id,
        user_id: user.id,
        email: user.email || invitation.email,
        name: invitation.name,
        role: invitation.role,
        is_registered: true,
        joined_at: new Date().toISOString()
      });

    if (agentError) {
      console.error('Error adding user to agency:', agentError);
      return NextResponse.json(
        { success: false, error: 'Failed to join agency' },
        { status: 500 }
      );
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('agency_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: user.id
      })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation status:', updateError);
      // Don't fail the request - user was successfully added
    }

    return NextResponse.json({
      success: true,
      data: {
        agency: {
          id: invitation.agency_id,
          name: (invitation.agencies as any).name,
          status: (invitation.agencies as any).status
        },
        role: invitation.role,
        message: (invitation.agencies as any).status === 'approved' 
          ? 'Successfully joined the agency!' 
          : 'Successfully joined the agency! The agency is currently pending approval.'
      }
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/agencies/accept-invite:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}