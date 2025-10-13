import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; teamId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agencyId, teamId } = params;
    const body = await request.json();

    const supabase = createServerClient();

    // Check if user owns this agency
    const { data: agency, error: fetchError } = await supabase
      .from('agencies')
      .select('created_by')
      .eq('id', agencyId)
      .single();

    if (fetchError || !agency || agency.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate the team member belongs to this agency
    const { data: existingMember, error: memberError } = await supabase
      .from('agency_team_members')
      .select('*')
      .eq('id', teamId)
      .eq('agency_id', agencyId)
      .single();

    if (memberError || !existingMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Validate required fields
    if (!body.name || !body.title) {
      return NextResponse.json(
        { error: 'Name and title are required' },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      name: body.name.trim(),
      title: body.title.trim(),
      bio: body.bio?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      linkedin_url: body.linkedin_url?.trim() || null,
      headshot_url: body.headshot_url?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    // Only update display_order if provided
    if (typeof body.display_order === 'number') {
      updateData.display_order = body.display_order;
    }

    // Email validation
    if (updateData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Bio length validation
    if (updateData.bio && updateData.bio.length > 1000) {
      return NextResponse.json(
        { error: 'Bio must be less than 1000 characters' },
        { status: 400 }
      );
    }

    const { data: updatedMember, error: updateError } = await supabase
      .from('agency_team_members')
      .update(updateData)
      .eq('id', teamId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating team member:', updateError);
      return NextResponse.json(
        { error: 'Failed to update team member' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: updatedMember,
      message: 'Team member updated successfully' 
    });
  } catch (error) {
    console.error('Error in team member PUT route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; teamId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agencyId, teamId } = params;
    const supabase = createServerClient();

    // Check if user owns this agency
    const { data: agency, error: fetchError } = await supabase
      .from('agencies')
      .select('created_by')
      .eq('id', agencyId)
      .single();

    if (fetchError || !agency || agency.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate the team member belongs to this agency
    const { data: existingMember, error: memberError } = await supabase
      .from('agency_team_members')
      .select('*')
      .eq('id', teamId)
      .eq('agency_id', agencyId)
      .single();

    if (memberError || !existingMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('agency_team_members')
      .delete()
      .eq('id', teamId);

    if (deleteError) {
      console.error('Error deleting team member:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete team member' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    console.error('Error in team member DELETE route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}