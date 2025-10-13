import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const supabase = createServerClient();

    const { data: teamMembers, error } = await supabase
      .from('agency_team_members')
      .select('*')
      .eq('agency_id', id)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching team members:', error);
      return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
    }

    return NextResponse.json({ data: teamMembers });
  } catch (error) {
    console.error('Error in team members GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agencyId } = params;
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

    // Validate required fields
    if (!body.name || !body.title) {
      return NextResponse.json(
        { error: 'Name and title are required' },
        { status: 400 }
      );
    }

    // Get next display order
    const { data: lastMember } = await supabase
      .from('agency_team_members')
      .select('display_order')
      .eq('agency_id', agencyId)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextDisplayOrder = lastMember ? lastMember.display_order + 1 : 0;

    // Validate input
    const teamMemberData = {
      agency_id: agencyId,
      name: body.name.trim(),
      title: body.title.trim(),
      bio: body.bio?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      linkedin_url: body.linkedin_url?.trim() || null,
      headshot_url: body.headshot_url?.trim() || null,
      display_order: nextDisplayOrder,
    };

    // Email validation
    if (teamMemberData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(teamMemberData.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Bio length validation
    if (teamMemberData.bio && teamMemberData.bio.length > 1000) {
      return NextResponse.json(
        { error: 'Bio must be less than 1000 characters' },
        { status: 400 }
      );
    }

    const { data: teamMember, error: createError } = await supabase
      .from('agency_team_members')
      .insert(teamMemberData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating team member:', createError);
      return NextResponse.json(
        { error: 'Failed to create team member' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: teamMember,
      message: 'Team member added successfully' 
    });
  } catch (error) {
    console.error('Error in team member POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}