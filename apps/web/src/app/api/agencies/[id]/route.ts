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
    const user = await getCurrentUser();

    // First fetch the agency with all versions and linked companies
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
        agency_versions(
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

    // Fetch linked companies (listings with this agency) via junction table
    const { data: linkedListings, error: listingsError } = await supabase
      .from('listings')
      .select(`
        id, 
        company_name, 
        clearbit_logo, 
        company_domain,
        listing_agents!inner(agency_id)
      `)
      .eq('listing_agents.agency_id', id)
      .not('company_name', 'is', null);

    // Get logos for linked companies
    const listingIds = linkedListings?.map(l => l.id) || []
    let logos: any[] = []
    
    if (listingIds.length > 0) {
      const { data: logoFiles } = await supabase
        .from('file_uploads')
        .select('listing_id, file_path, bucket_name')
        .in('listing_id', listingIds)
        .eq('file_type', 'logo')
      
      logos = logoFiles || []
    }

    // Process linked companies with logos
    const linkedCompanies = linkedListings?.map(listing => {
      const logo = logos.find(l => l.listing_id === listing.id)
      
      return {
        id: listing.id,
        company_name: listing.company_name,
        logo_url: logo?.file_path || null,
        logo_bucket: logo?.bucket_name || null,
        clearbit_logo: listing.clearbit_logo || false,
        company_domain: listing.company_domain
      }
    }) || [];

    // Check if user is the owner - if so, return agency data as-is for editing
    const isOwner = user && rawAgency.created_by === user.id;
    
    if (isOwner) {
      // For owners, return the agency with all version info for status display
      return NextResponse.json({ 
        data: {
          ...rawAgency,
          // Sort team members by display_order
          agency_team_members: rawAgency.agency_team_members?.sort((a: any, b: any) => a.display_order - b.display_order),
          // Add linked companies
          linked_companies: linkedCompanies
        }
      });
    }

    // For public view, check if agency has any approved versions
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
      // Parse the JSON string from the database
      const versionData = typeof latestApprovedVersion.data === 'string' 
        ? JSON.parse(latestApprovedVersion.data)
        : latestApprovedVersion.data;
      
      agency = {
        ...rawAgency,
        // Override with version data where it exists
        ...(versionData.agency || {}),
        // Use team members from version if available, otherwise fall back to agency_team_members
        agency_team_members: versionData.team_members || rawAgency.agency_team_members,
        // Add linked companies
        linked_companies: linkedCompanies,
        // Remove the versions array from the response
        agency_versions: undefined
      };
    } else {
      // If no version data, return agency as-is (removing versions array)
      agency = {
        ...rawAgency,
        linked_companies: linkedCompanies,
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
    console.log('PUT /api/agencies/[id] - Starting request');
    
    const user = await getCurrentUser();
    console.log('User check:', user ? 'User found' : 'No user');
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    console.log('Agency ID:', id);
    
    const body = await request.json();
    console.log('Request body keys:', Object.keys(body));

    const supabase = createServerClient();
    console.log('Supabase client created');

    // Check if user owns this agency
    console.log('Checking agency ownership for user:', user.id);
    const { data: agency, error: fetchError } = await supabase
      .from('agencies')
      .select('created_by')
      .eq('id', id)
      .single();

    console.log('Agency fetch result:', { agency, fetchError });
    
    if (fetchError) {
      console.error('Database fetch error:', fetchError);
      return NextResponse.json({ error: 'Database error: ' + fetchError.message }, { status: 500 });
    }
    
    if (!agency) {
      console.log('Agency not found');
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }
    
    if (agency.created_by !== user.id) {
      console.log('User does not own agency. Agency owner:', agency.created_by, 'Current user:', user.id);
      return NextResponse.json({ error: 'Forbidden - not the agency owner' }, { status: 403 });
    }

    // Validate and update agency
    const allowedFields = [
      'name', 'contact_email', 'contact_phone', 'description',
      'classification', 'geographic_patch', 'website', 'logo_url',
      'office_address'
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // Convert empty strings to null for database fields that have constraints
        if (typeof body[field] === 'string' && body[field].trim() === '') {
          updateData[field] = null;
        } else {
          updateData[field] = body[field];
        }
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

    if (updateData.classification !== null && updateData.classification && !['Commercial', 'Residential', 'Both'].includes(updateData.classification)) {
      return NextResponse.json(
        { error: 'Classification must be one of: Commercial, Residential, Both, or empty' },
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

    console.log('Updating agency with data:', updateData);
    
    const { data: updatedAgency, error: updateError } = await supabase
      .from('agencies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating agency:', updateError);
      console.error('Update error details:', {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      return NextResponse.json(
        { error: 'Database update failed: ' + updateError.message },
        { status: 500 }
      );
    }
    
    console.log('Agency updated successfully:', updatedAgency?.id);

    return NextResponse.json({ 
      data: updatedAgency,
      message: 'Agency updated successfully' 
    });
  } catch (error) {
    console.error('Error in agency PUT route:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}