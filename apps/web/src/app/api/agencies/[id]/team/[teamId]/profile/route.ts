import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; teamId: string } }
) {
  try {
    const { id: agencyId, teamId } = params;
    const supabase = createServerClient();

    // Get team member with agency information
    const { data: teamMember, error } = await supabase
      .from('agency_team_members')
      .select(`
        *,
        agency:agencies!inner (
          id,
          name,
          classification,
          geographic_patch,
          status
        )
      `)
      .eq('id', teamId)
      .eq('agency_id', agencyId)
      .single();

    if (error || !teamMember) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Only show team members from approved agencies or provide limited info for draft/pending
    if (teamMember.agency.status !== 'approved') {
      return NextResponse.json({ error: 'Team member not available' }, { status: 404 });
    }

    return NextResponse.json({ data: teamMember });
  } catch (error) {
    console.error('Error fetching team member profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}