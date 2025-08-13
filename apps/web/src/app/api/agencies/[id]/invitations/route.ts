// =====================================================
// Agency Invitation Management API - Story 18.3
// Handle managing agency invitations (resend, cancel)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ResendInvitationRequest {
  invitationId: string;
}

interface CancelInvitationRequest {
  invitationId: string;
}

// =====================================================
// PUT /api/agencies/[id]/invitations - Resend invitation
// =====================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in to manage invitations' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const agencyId = params.id;
    const body: ResendInvitationRequest = await request.json();

    if (!body.invitationId) {
      return NextResponse.json(
        { success: false, error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    // Verify current user is admin of this agency
    const { data: adminMembership, error: adminError } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminMembership || adminMembership.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'You must be an admin of this agency to manage invitations' },
        { status: 403 }
      );
    }

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('agency_invitations')
      .select(`
        id,
        email,
        name,
        role,
        status,
        agencies!inner(name)
      `)
      .eq('id', body.invitationId)
      .eq('agency_id', agencyId)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot resend invitation with status: ${invitation.status}` },
        { status: 400 }
      );
    }

    // Generate new token and extend expiration
    const newToken = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update invitation with new token and expiration
    const { error: updateError } = await supabase
      .from('agency_invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        resent_at: new Date().toISOString()
      })
      .eq('id', body.invitationId);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update invitation' },
        { status: 500 }
      );
    }

    // Send new email invitation using template system
    try {
      const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/agents/invite/${newToken}`;
      const { sendAgencyInvitationEmail } = await import('@/lib/email-templates');
      
      await sendAgencyInvitationEmail({
        recipientName: invitation.name,
        recipientEmail: invitation.email,
        agencyName: (invitation.agencies as any).name,
        inviterName: 'Agency Admin', // Could be enhanced to get actual inviter name
        role: invitation.role,
        acceptUrl: inviteUrl,
        expiresAt: newExpiresAt.toISOString()
      });
    } catch (emailError) {
      console.error('Error sending resend email:', emailError);
      // Don't fail the request if email fails - invitation is already updated
    }

    return NextResponse.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role
        },
        message: 'Invitation resent successfully'
      }
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/agencies/[id]/invitations:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/agencies/[id]/invitations - Cancel invitation
// =====================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in to manage invitations' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const agencyId = params.id;
    const body: CancelInvitationRequest = await request.json();

    if (!body.invitationId) {
      return NextResponse.json(
        { success: false, error: 'Invitation ID is required' },
        { status: 400 }
      );
    }

    // Verify current user is admin of this agency
    const { data: adminMembership, error: adminError } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('agency_id', agencyId)
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminMembership || adminMembership.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'You must be an admin of this agency to manage invitations' },
        { status: 403 }
      );
    }

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('agency_invitations')
      .select('id, email, name, role, status')
      .eq('id', body.invitationId)
      .eq('agency_id', agencyId)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json(
        { success: false, error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Cannot cancel invitation with status: ${invitation.status}` },
        { status: 400 }
      );
    }

    // Update invitation status to cancelled
    const { error: updateError } = await supabase
      .from('agency_invitations')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id
      })
      .eq('id', body.invitationId);

    if (updateError) {
      console.error('Error cancelling invitation:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to cancel invitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        cancelledInvitation: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role
        },
        message: 'Invitation cancelled successfully'
      }
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/agencies/[id]/invitations:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}