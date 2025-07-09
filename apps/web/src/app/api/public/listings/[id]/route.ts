import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

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
      .select(`
        id, 
        company_name, 
        title, 
        description,
        site_size_min, 
        site_size_max,
        contact_name, 
        contact_title, 
        contact_email, 
        contact_phone,
        is_nationwide,
        created_at,
        updated_at,
        sectors(id, name),
        use_classes(id, name),
        file_uploads(id, file_type, file_path, file_name),
        listing_locations(place_name, coordinates, formatted_address),
        listing_contacts(name, title, email, phone, is_primary)
      `)
      .eq('id', id)
      .eq('status', 'approved')
      .eq('published', true)
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
      sector: (listing.sectors as any)?.name || null,
      use_class: (listing.use_classes as any)?.name || null,
      contact_name: listing.contact_name,
      contact_title: listing.contact_title,
      contact_email: listing.contact_email,
      contact_phone: listing.contact_phone,
      is_nationwide: listing.is_nationwide,
      place_name: (listing.listing_locations as any)?.[0]?.place_name || null,
      coordinates: (listing.listing_locations as any)?.[0]?.coordinates || null,
      formatted_address: (listing.listing_locations as any)?.[0]?.formatted_address || null,
      created_at: listing.created_at,
      updated_at: listing.updated_at,
      
      // Additional data for modal
      logo_url: (listing.file_uploads as any)?.find((f: any) => f.file_type === 'logo')?.file_path || null,
      brochures: (listing.file_uploads as any)?.filter((f: any) => f.file_type === 'brochure')?.map((f: any) => ({
        id: f.id,
        name: f.file_name,
        url: f.file_path
      })) || [],
      documents: (listing.file_uploads as any)?.filter((f: any) => ['document', 'site_plan', 'fit_out'].includes(f.file_type))?.map((f: any) => ({
        id: f.id,
        name: f.file_name,
        url: f.file_path,
        type: f.file_type
      })) || [],
      additional_contacts: (listing.listing_contacts as any)?.filter((c: any) => !c.is_primary)?.map((c: any) => ({
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone
      })) || []
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