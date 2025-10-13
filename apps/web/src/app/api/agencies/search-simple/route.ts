import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Simple agencies search for linking to listings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = createServerClient();
    
    // Get agencies that are approved or have approved versions
    let query = supabase
      .from('agencies')
      .select(`
        id,
        name,
        contact_email,
        contact_phone,
        logo_url,
        status,
        agency_versions(
          id,
          status
        )
      `)
      .order('name');

    // Apply search filter if provided
    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    // Apply limit
    query = query.limit(limit);

    const { data: rawAgencies, error } = await query;

    if (error) {
      console.error('Error searching agencies:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to search agencies' },
        { status: 500 }
      );
    }

    // Filter agencies that are approved or have approved versions
    const filteredAgencies = rawAgencies?.filter(agency => {
      return agency.status === 'approved' ||
             agency.agency_versions?.some((version: any) => version.status === 'approved');
    }) || [];

    // Clean up the response - remove agency_versions and flatten
    const cleanedAgencies = filteredAgencies.map(agency => ({
      id: agency.id,
      name: agency.name,
      contact_email: agency.contact_email,
      contact_phone: agency.contact_phone,
      logo_url: agency.logo_url
    }));

    return NextResponse.json({
      success: true,
      data: cleanedAgencies
    });
  } catch (error) {
    console.error('Error in agencies search-simple GET route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}