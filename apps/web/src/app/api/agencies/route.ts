import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const classification = searchParams.get('classification');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = (page - 1) * limit;

    const supabase = createServerClient();
    
    // Get agencies that have at least one approved version
    let query = supabase
      .from('agencies')
      .select(`
        *,
        agency_team_members(
          id,
          name,
          title,
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
      .order('name');

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply classification filter
    if (classification && classification !== 'all') {
      if (classification === 'Commercial') {
        query = query.in('classification', ['Commercial', 'Both']);
      } else if (classification === 'Residential') {
        query = query.in('classification', ['Residential', 'Both']);
      } else {
        query = query.eq('classification', classification);
      }
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: rawAgencies, error } = await query;

    if (error) {
      console.error('Error fetching agencies:', error);
      return NextResponse.json({ error: 'Failed to fetch agencies' }, { status: 500 });
    }

    // Process agencies to merge with their latest approved version data
    const agencies = rawAgencies?.filter(agency => {
      // Only include agencies that have at least one approved version
      return agency.agency_versions?.some((version: any) => version.status === 'approved');
    }).map(agency => {
      // Find the highest version number approved version
      const latestApprovedVersion = agency.agency_versions?.reduce((latest: any, version: any) => {
        if (version.status === 'approved' && version.version_number > (latest?.version_number || 0)) {
          return version;
        }
        return latest;
      }, null);

      // Merge base agency data with version data if available
      if (latestApprovedVersion?.data) {
        const versionData = latestApprovedVersion.data;
        return {
          ...agency,
          // Override with version data where it exists
          ...(versionData.agency || {}),
          // Use team members from version if available, otherwise fall back to agency_team_members
          agency_team_members: versionData.team_members || agency.agency_team_members,
          // Remove the versions array from the response
          agency_versions: undefined
        };
      }

      // If no version data, return agency as-is (removing versions array)
      return {
        ...agency,
        agency_versions: undefined
      };
    }) || [];

    return NextResponse.json({ data: agencies });
  } catch (error) {
    console.error('Error in agencies GET route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, contact_email, contact_phone } = body;

    // Validation
    if (!name || !contact_email || !contact_phone) {
      return NextResponse.json(
        { error: 'Name, email, and phone are required' },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { error: 'Name must be between 2 and 100 characters' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Phone validation (basic)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(contact_phone.replace(/[\s\-\(\)]/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid phone format' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check if user already has an agency
    const { data: existingAgency } = await supabase
      .from('agencies')
      .select('id')
      .eq('created_by', user.id)
      .single();

    if (existingAgency) {
      return NextResponse.json(
        { error: 'You already have an agency' },
        { status: 409 }
      );
    }

    // Check for duplicate name
    const { data: duplicateName } = await supabase
      .from('agencies')
      .select('id')
      .ilike('name', name)
      .single();

    if (duplicateName) {
      return NextResponse.json(
        { error: 'An agency with this name already exists' },
        { status: 409 }
      );
    }

    // Create agency
    const { data: agency, error: createError } = await supabase
      .from('agencies')
      .insert({
        name: name.trim(),
        contact_email: contact_email.trim(),
        contact_phone: contact_phone.trim(),
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating agency:', createError);
      return NextResponse.json(
        { error: 'Failed to create agency' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: { agency },
      message: 'Agency created successfully' 
    });
  } catch (error) {
    console.error('Error in agencies POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}