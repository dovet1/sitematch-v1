import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const supabase = createServerClient();

    // Check if user owns this agency
    const { data: agency, error: fetchError } = await supabase
      .from('agencies')
      .select(`
        *,
        agency_team_members (*)
      `)
      .eq('id', id)
      .eq('created_by', user.id)
      .single();

    if (fetchError || !agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Get the next version number
    const { data: lastVersion } = await supabase
      .from('agency_versions')
      .select('version_number')
      .eq('agency_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = lastVersion ? lastVersion.version_number + 1 : 1;

    // Create version with full agency data
    const versionData = {
      agency: {
        id: agency.id,
        name: agency.name,
        contact_email: agency.contact_email,
        contact_phone: agency.contact_phone,
        description: agency.description,
        classification: agency.classification,
        geographic_patch: agency.geographic_patch,
        website: agency.website,
        logo_url: agency.logo_url,
        office_address: agency.office_address,
        created_at: agency.created_at,
        updated_at: agency.updated_at
      },
      team_members: agency.agency_team_members || []
    };

    const { data: version, error: versionError } = await supabase
      .from('agency_versions')
      .insert({
        agency_id: id,
        version_number: nextVersionNumber,
        data: versionData,
        status: 'pending'
      })
      .select()
      .single();

    if (versionError) {
      console.error('Error creating agency version:', versionError);
      return NextResponse.json(
        { error: 'Failed to submit for review' },
        { status: 500 }
      );
    }

    // Update agency with new version reference (no status change needed)
    const { error: statusError } = await supabase
      .from('agencies')
      .update({ current_version_id: version.id })
      .eq('id', id);

    if (statusError) {
      console.error('Error updating agency reference:', statusError);
    }

    // TODO: Send email notification to user
    // TODO: Send admin notification

    return NextResponse.json({ 
      data: { version },
      message: 'Agency submitted for review successfully' 
    });
  } catch (error) {
    console.error('Error in agency submit route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}