// =====================================================
// Agency Invitations API Route Handler - Story 18.2
// Handle invitation sending and management
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { Resend } from 'resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendInvitationRequest {
  agencyId: string;
  invitations: {
    email: string;
    name: string;
    role: 'admin' | 'member';
  }[];
}

// =====================================================
// POST /api/agencies/invite - Send invitations
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const body: SendInvitationRequest = await request.json();

    if (!body.agencyId || !body.invitations || body.invitations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing agencyId or invitations' },
        { status: 400 }
      );
    }

    // Verify user is admin of this agency
    const { data: membership } = await supabase
      .from('agency_agents')
      .select('role')
      .eq('agency_id', body.agencyId)
      .eq('user_id', user.id)
      .single();

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only agency admins can send invitations' },
        { status: 403 }
      );
    }

    // Get agency details for email
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('name, id')
      .eq('id', body.agencyId)
      .single();

    if (agencyError || !agency) {
      return NextResponse.json(
        { success: false, error: 'Agency not found' },
        { status: 404 }
      );
    }

    // Create invitation records
    const invitations = [];
    const emailPromises = [];

    for (const invitation of body.invitations) {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      // Check for existing pending invitations to this email
      const { data: existingInvitation } = await supabase
        .from('agency_invitations')
        .select('id')
        .eq('agency_id', body.agencyId)
        .eq('email', invitation.email)
        .eq('status', 'pending')
        .single();

      if (existingInvitation) {
        continue; // Skip duplicate invitations
      }

      const invitationRecord = {
        agency_id: body.agencyId,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id
      };

      invitations.push(invitationRecord);

      // Prepare email using new template system
      const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/agents/invite/${token}`;
      
      const { sendAgencyInvitationEmail } = await import('@/lib/email-templates');
      
      emailPromises.push(
        sendAgencyInvitationEmail({
          recipientName: invitation.name,
          recipientEmail: invitation.email,
          agencyName: agency.name,
          inviterName: user.email || 'Agency Admin',
          role: invitation.role,
          acceptUrl: inviteUrl,
          expiresAt: expiresAt.toISOString()
        }).catch(error => {
          console.error(`📧 Failed to send invitation email to ${invitation.email}:`, error);
          return { success: false, error: error.message };
        })
      );
    }

    if (invitations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid invitations to send (may be duplicates)' },
        { status: 400 }
      );
    }

    // Save invitations to database
    const { error: invitationsError } = await supabase
      .from('agency_invitations')
      .insert(invitations);

    if (invitationsError) {
      console.error('Error creating invitations:', invitationsError);
      return NextResponse.json(
        { success: false, error: 'Failed to create invitations' },
        { status: 500 }
      );
    }

    // Send emails (don't fail if some emails fail)
    const emailResults = await Promise.allSettled(emailPromises);
    const successfulEmails = emailResults.filter(result => result.status === 'fulfilled').length;
    const failedEmails = emailResults.filter(result => result.status === 'rejected').length;

    if (failedEmails > 0) {
      console.warn(`Failed to send ${failedEmails} invitation emails`);
    }

    return NextResponse.json({
      success: true,
      data: {
        invitationsSent: invitations.length,
        emailsSuccessful: successfulEmails,
        emailsFailed: failedEmails,
        tokens: invitations.map(inv => ({ email: inv.email, token: inv.token }))
      }
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/agencies/invite:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// GET /api/agencies/invite - Get invitation status
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    const { data: invitation, error } = await supabase
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
          logo_url,
          status
        )
      `)
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);
    
    if (now > expiresAt && invitation.status === 'pending') {
      // Mark as expired
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

    return NextResponse.json({
      success: true,
      data: {
        invitation: {
          id: invitation.id,
          agencyId: invitation.agency_id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          agency: invitation.agencies
        }
      }
    });

  } catch (error) {
    console.error('Unexpected error in GET /api/agencies/invite:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}