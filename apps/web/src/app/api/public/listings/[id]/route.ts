import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Listing ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    // Get detailed listing information for modal
    const { data: listing, error } = await supabase
      .from('listings')
      .select('id, company_name, title, description, site_size_min, site_size_max, contact_name, contact_title, contact_email, contact_phone, is_nationwide, created_at')
      .eq('id', id)
      .eq('status', 'approved')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Listing not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching listing:', error);
      return NextResponse.json(
        { error: 'Failed to fetch listing' },
        { status: 500 }
      );
    }

    // Transform data for detailed view
    const detailedListing = {
      id: listing.id,
      company_name: listing.company_name,
      title: listing.title,
      description: listing.description,
      site_size_min: listing.site_size_min,
      site_size_max: listing.site_size_max,
      sector: null, // Will be added back when relationships are fixed
      use_class: null, // Will be added back when relationships are fixed
      contact_name: listing.contact_name,
      contact_title: listing.contact_title,
      contact_email: listing.contact_email,
      contact_phone: listing.contact_phone,
      is_nationwide: listing.is_nationwide,
      place_name: null, // Will be added back when relationships are fixed
      coordinates: null, // Will be added back when relationships are fixed
      formatted_address: null, // Will be added back when relationships are fixed
      created_at: listing.created_at,
      
      // Additional data for modal (file uploads not yet implemented)
      logo_url: null, // Will be implemented when file_uploads relationship is set up
      brochures: [],
      documents: [],
      additional_contacts: [] // listing_contacts relationship not yet implemented
    };

    return NextResponse.json(detailedListing);
    
  } catch (error) {
    console.error('Unexpected error in public listing detail API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}