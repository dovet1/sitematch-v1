import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Simple agencies search for linking to listings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    const supabase = createServerClient();
    
    // Get agencies with approved versions only
    let query = supabase
      .from('agencies')
      .select(`
        id,
        name,
        contact_email,
        contact_phone,
        logo_url,
        agency_versions!inner(
          id,
          status
        )
      `)
      .eq('agency_versions.status', 'approved')
      .order('name');

    // Apply search filter if provided
    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    // Apply limit
    query = query.limit(limit);

    const { data: agencies, error } = await query;

    if (error) {
      console.error('Error searching agencies:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to search agencies' },
        { status: 500 }
      );
    }

    // Clean up the response - remove agency_versions and flatten
    const cleanedAgencies = agencies?.map(agency => ({
      id: agency.id,
      name: agency.name,
      contact_email: agency.contact_email,
      contact_phone: agency.contact_phone,
      logo_url: agency.logo_url
    })) || [];

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