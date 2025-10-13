import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ReorderRequest {
  teamMemberIds: string[];
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agencyId } = params;
    const body: ReorderRequest = await request.json();

    if (!body.teamMemberIds || !Array.isArray(body.teamMemberIds)) {
      return NextResponse.json(
        { error: 'teamMemberIds array is required' },
        { status: 400 }
      );
    }

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

    // Verify all team members belong to this agency
    const { data: existingMembers, error: membersError } = await supabase
      .from('agency_team_members')
      .select('id')
      .eq('agency_id', agencyId)
      .in('id', body.teamMemberIds);

    if (membersError || !existingMembers) {
      return NextResponse.json({ error: 'Failed to verify team members' }, { status: 500 });
    }

    if (existingMembers.length !== body.teamMemberIds.length) {
      return NextResponse.json({ error: 'Invalid team member IDs' }, { status: 400 });
    }

    // Update display_order for each team member
    const updates = body.teamMemberIds.map((id, index) => ({
      id,
      display_order: index,
      updated_at: new Date().toISOString(),
    }));

    // Execute batch update
    const updatePromises = updates.map(update =>
      supabase
        .from('agency_team_members')
        .update({ display_order: update.display_order, updated_at: update.updated_at })
        .eq('id', update.id)
        .eq('agency_id', agencyId)
    );

    const results = await Promise.all(updatePromises);

    // Check if any updates failed
    const failedUpdates = results.filter(result => result.error);
    if (failedUpdates.length > 0) {
      console.error('Some updates failed:', failedUpdates);
      return NextResponse.json(
        { error: 'Failed to update team member order' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Team member order updated successfully' });
  } catch (error) {
    console.error('Error in team member reorder route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}