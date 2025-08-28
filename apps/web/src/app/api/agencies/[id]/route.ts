import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const supabase = createServerClient();

    const { data: rawAgency, error } = await supabase
      .from('agencies')
      .select(`
        *,
        agency_team_members (
          id,
          name,
          title,
          bio,
          email,
          phone,
          linkedin_url,
          headshot_url,
          display_order
        ),
        agency_versions!inner(
          id,
          version_number,
          data,
          status
        )
      `)
      .eq('id', id)
      .single();

    if (error || !rawAgency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Check if agency has any approved versions
    const hasApprovedVersion = rawAgency.agency_versions?.some((version: any) => version.status === 'approved');
    if (!hasApprovedVersion) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    // Find the latest approved version
    const latestApprovedVersion = rawAgency.agency_versions?.reduce((latest: any, version: any) => {
      if (version.status === 'approved' && version.version_number > (latest?.version_number || 0)) {
        return version;
      }
      return latest;
    }, null);

    // Merge base agency data with version data if available
    let agency;
    if (latestApprovedVersion?.data) {
      const versionData = latestApprovedVersion.data;
      agency = {
        ...rawAgency,
        // Override with version data where it exists
        ...(versionData.agency || {}),
        // Use team members from version if available, otherwise fall back to agency_team_members
        agency_team_members: versionData.team_members || rawAgency.agency_team_members,
        // Remove the versions array from the response
        agency_versions: undefined
      };
    } else {
      // If no version data, return agency as-is (removing versions array)
      agency = {
        ...rawAgency,
        agency_versions: undefined
      };
    }

    // Sort team members by display_order
    if (agency.agency_team_members) {
      agency.agency_team_members.sort((a: any, b: any) => a.display_order - b.display_order);
    }

    return NextResponse.json({ data: agency });
  } catch (error) {
    console.error('Error fetching agency:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
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

    const { id } = params;
    const body = await request.json();

    const supabase = createServerClient();

    // Check if user owns this agency
    const { data: agency, error: fetchError } = await supabase
      .from('agencies')
      .select('created_by')
      .eq('id', id)
      .single();

    if (fetchError || !agency || agency.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate and update agency
    const allowedFields = [
      'name', 'contact_email', 'contact_phone', 'description',
      'classification', 'geographic_patch', 'website', 'logo_url',
      'office_street_address', 'office_city', 'office_postcode',
      'office_country', 'office_coordinates'
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Validation
    if (updateData.name && (updateData.name.length < 2 || updateData.name.length > 100)) {
      return NextResponse.json(
        { error: 'Name must be between 2 and 100 characters' },
        { status: 400 }
      );
    }

    if (updateData.description && updateData.description.length > 500) {
      return NextResponse.json(
        { error: 'Description must be less than 500 characters' },
        { status: 400 }
      );
    }

    if (updateData.classification && !['Commercial', 'Residential', 'Both'].includes(updateData.classification)) {
      return NextResponse.json(
        { error: 'Invalid classification' },
        { status: 400 }
      );
    }

    if (updateData.contact_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updateData.contact_email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    const { data: updatedAgency, error: updateError } = await supabase
      .from('agencies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating agency:', updateError);
      return NextResponse.json(
        { error: 'Failed to update agency' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: updatedAgency,
      message: 'Agency updated successfully' 
    });
  } catch (error) {
    console.error('Error in agency PUT route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}