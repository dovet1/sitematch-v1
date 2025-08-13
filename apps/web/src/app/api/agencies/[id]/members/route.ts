// =====================================================
// Agency Member Management API - Story 18.3
// Handle managing agency team members (remove, role changes)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface UpdateMemberRequest {
  userId: string;
  role: 'admin' | 'member';
}

interface RemoveMemberRequest {
  userId: string;
}

// =====================================================
// PUT /api/agencies/[id]/members - Update member role
// =====================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in to manage members' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const agencyId = params.id;
    const body: UpdateMemberRequest = await request.json();

    if (!body.userId || !body.role) {
      return NextResponse.json(
        { success: false, error: 'User ID and role are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'member'].includes(body.role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be admin or member' },
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
        { success: false, error: 'You must be an admin of this agency to manage members' },
        { status: 403 }
      );
    }

    // Check if target member exists in this agency
    const { data: targetMember, error: memberError } = await supabase
      .from('agency_agents')
      .select('role, email, name')
      .eq('agency_id', agencyId)
      .eq('user_id', body.userId)
      .single();

    if (memberError || !targetMember) {
      return NextResponse.json(
        { success: false, error: 'Member not found in this agency' },
        { status: 404 }
      );
    }

    // Prevent admin from changing their own role
    if (body.userId === user.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot change your own role' },
        { status: 400 }
      );
    }

    // If changing someone from admin to member, ensure at least one admin remains
    if (targetMember.role === 'admin' && body.role === 'member') {
      const { data: adminCount } = await supabase
        .from('agency_agents')
        .select('user_id')
        .eq('agency_id', agencyId)
        .eq('role', 'admin');

      if (adminCount && adminCount.length <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove the last admin. Promote another member to admin first.' },
          { status: 400 }
        );
      }
    }

    // Update the member's role
    const { error: updateError } = await supabase
      .from('agency_agents')
      .update({ 
        role: body.role,
        updated_at: new Date().toISOString()
      })
      .eq('agency_id', agencyId)
      .eq('user_id', body.userId);

    if (updateError) {
      console.error('Error updating member role:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update member role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        member: {
          userId: body.userId,
          email: targetMember.email,
          name: targetMember.name,
          role: body.role
        },
        message: `Member role updated to ${body.role} successfully`
      }
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/agencies/[id]/members:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/agencies/[id]/members - Remove member
// =====================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Must be logged in to manage members' },
        { status: 401 }
      );
    }

    const supabase = createClient();
    const agencyId = params.id;
    const body: RemoveMemberRequest = await request.json();

    if (!body.userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
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
        { success: false, error: 'You must be an admin of this agency to remove members' },
        { status: 403 }
      );
    }

    // Check if target member exists in this agency
    const { data: targetMember, error: memberError } = await supabase
      .from('agency_agents')
      .select('role, email, name')
      .eq('agency_id', agencyId)
      .eq('user_id', body.userId)
      .single();

    if (memberError || !targetMember) {
      return NextResponse.json(
        { success: false, error: 'Member not found in this agency' },
        { status: 404 }
      );
    }

    // Prevent admin from removing themselves
    if (body.userId === user.id) {
      return NextResponse.json(
        { success: false, error: 'You cannot remove yourself from the agency' },
        { status: 400 }
      );
    }

    // If removing an admin, ensure at least one admin remains
    if (targetMember.role === 'admin') {
      const { data: adminCount } = await supabase
        .from('agency_agents')
        .select('user_id')
        .eq('agency_id', agencyId)
        .eq('role', 'admin');

      if (adminCount && adminCount.length <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove the last admin. Promote another member to admin first.' },
          { status: 400 }
        );
      }
    }

    // Remove the member from the agency
    const { error: deleteError } = await supabase
      .from('agency_agents')
      .delete()
      .eq('agency_id', agencyId)
      .eq('user_id', body.userId);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Failed to remove member' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        removedMember: {
          userId: body.userId,
          email: targetMember.email,
          name: targetMember.name
        },
        message: 'Member removed successfully'
      }
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/agencies/[id]/members:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}