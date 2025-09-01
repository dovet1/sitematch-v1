import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

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

    const supabase = createServerClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get basic listing information and verify ownership
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select(`
        id, 
        company_name, 
        company_domain,
        title, 
        description, 
        site_size_min, 
        site_size_max, 
        contact_name, 
        contact_title, 
        contact_email, 
        contact_phone, 
        contact_area,
        created_at,
        listing_type,
        dwelling_count_min,
        dwelling_count_max,
        site_acreage_min,
        site_acreage_max,
        property_page_link,
        created_by,
        linked_agency_id,
        linked_agency:agencies(
          id,
          name,
          logo_url,
          geographic_patch,
          classification
        )
      `)
      .eq('id', id)
      .single();

    if (listingError) {
      if (listingError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Listing not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching listing:', listingError);
      return NextResponse.json(
        { error: 'Failed to fetch listing' },
        { status: 500 }
      );
    }

    // Verify the user owns this listing
    if (listing.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Access denied - you can only preview your own listings' },
        { status: 403 }
      );
    }

    // Get related data - since user is authenticated and owns the listing, 
    // they can access all files regardless of listing status
    const [
      { data: locations },
      { data: faqs },
      { data: files },
      { data: contacts },
      { data: listingSectors },
      { data: listingUseClasses }
    ] = await Promise.all([
      supabase.from('listing_locations').select('id, place_name, coordinates, formatted_address').eq('listing_id', id),
      supabase.from('faqs').select('id, question, answer, display_order').eq('listing_id', id),
      supabase.from('file_uploads').select('id, file_path, file_name, file_size, file_type, bucket_name, is_primary, display_order, caption').eq('listing_id', id),
      supabase.from('listing_contacts').select('id, contact_name, contact_title, contact_email, contact_phone, contact_area, headshot_url, is_primary_contact').eq('listing_id', id),
      supabase.from('listing_sectors').select('sector_id, sectors(id, name)').eq('listing_id', id),
      supabase.from('listing_use_classes').select('use_class_id, use_classes(id, name, code)').eq('listing_id', id)
    ]);

    // Debug logging
    if (files && files.length > 0) {
      console.log(`Owner preview - Files found for listing ${id}:`, files.map(f => `${f.file_type}:${f.file_name}`));
      console.log(`All unique file types:`, Array.from(new Set(files.map(f => f.file_type))));
      console.log(`Filtered fit outs:`, files.filter(f => f.file_type === 'fitOut' || f.file_type === 'fit_out'));
      console.log(`Filtered site plans:`, files.filter(f => f.file_type === 'sitePlan' || f.file_type === 'site_plan'));
    } else {
      console.log(`Owner preview - No files found for listing ${id}`);
    }

    // Get sectors and use classes
    const allSectors = (listingSectors?.map((ls: any) => ls.sectors).filter(Boolean) || []);
    const allUseClasses = (listingUseClasses?.map((luc: any) => luc.use_classes).filter(Boolean) || []);

    // Get logo file or generate Clearbit URL
    const logoFile = files?.find((file: any) => file.file_type === 'logo' && file.is_primary);
    
    const generateClearbitUrl = (companyDomain: string | null, companyName: string) => {
      if (companyDomain) {
        return `https://logo.clearbit.com/${companyDomain}`;
      }
      
      const domain = companyName
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')
        .replace(/ltd|limited|plc|inc|corp|corporation|llc/g, '');
      
      return `https://logo.clearbit.com/${domain}.com`;
    };

    const formatSectorName = (name: string) => {
      return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' & ');
    };

    // Helper functions
    const formatSizeRange = (min: number | null, max: number | null): string => {
      if (!min && !max) return 'Size flexible';
      if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
      if (min) return `From ${min.toLocaleString()} sq ft`;
      if (max) return `Up to ${max.toLocaleString()} sq ft`;
      return '';
    };

    const formatDwellingRange = (min: number | null, max: number | null): string => {
      if (!min && !max) return 'Dwelling count flexible';
      if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} dwellings`;
      if (min) return `From ${min.toLocaleString()} dwellings`;
      if (max) return `Up to ${max.toLocaleString()} dwellings`;
      return '';
    };

    const formatAcreageRange = (min: number | null, max: number | null): string => {
      if (!min && !max) return 'Site acreage flexible';
      if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} acres`;
      if (min) return `From ${min.toLocaleString()} acres`;
      if (max) return `Up to ${max.toLocaleString()} acres`;
      return '';
    };

    // Transform data for the modal (same format as public API)
    const enhancedListing = {
      company: {
        name: listing.company_name,
        logo_url: logoFile ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${logoFile.bucket_name}/${logoFile.file_path}` : generateClearbitUrl(listing.company_domain, listing.company_name),
        sectors: allSectors.map((s: any) => formatSectorName(s.name)).filter(Boolean),
        use_classes: allUseClasses.map((uc: any) => `${uc.name} (${uc.code})`).filter(Boolean),
        sector: allSectors.map((s: any) => formatSectorName(s.name)).join(', ') || 'Not specified',
        use_class: allUseClasses.map((uc: any) => `${uc.name} (${uc.code})`).join(', ') || 'Not specified',
        site_size: formatSizeRange(listing.site_size_min, listing.site_size_max),
        dwelling_count: formatDwellingRange(listing.dwelling_count_min, listing.dwelling_count_max),
        site_acreage: formatAcreageRange(listing.site_acreage_min, listing.site_acreage_max),
        property_page_link: listing.property_page_link
      },
      
      // Linked agency data
      linked_agency_id: listing.linked_agency_id,
      linked_agency: listing.linked_agency,
      
      // Contact information from listing_contacts table only
      contacts: {
        primary: (() => {
          // Find the primary contact from listing_contacts table
          const primaryContact = contacts?.find((contact: any) => contact.is_primary_contact);
          if (primaryContact) {
            return {
              name: primaryContact.contact_name,
              title: primaryContact.contact_title || '',
              email: primaryContact.contact_email,
              phone: primaryContact.contact_phone || '',
              contact_area: primaryContact.contact_area || '',
              headshot_url: primaryContact.headshot_url || (() => {
                const headshotFile = files?.find((file: any) => 
                  file.file_type === 'headshot' && 
                  file.file_name?.toLowerCase().includes(primaryContact.contact_name?.toLowerCase().split(' ')[0])
                );
                return headshotFile ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${headshotFile.bucket_name}/${headshotFile.file_path}` : null;
              })()
            };
          }
          // Return null if no primary contact exists
          return null;
        })(),
        additional: (contacts || [])
          .filter((contact: any) => !contact.is_primary_contact)
          .map((contact: any) => ({
            name: contact.contact_name,
            title: contact.contact_title || '',
            email: contact.contact_email,
            phone: contact.contact_phone || '',
            contact_area: contact.contact_area || '',
            headshot_url: contact.headshot_url || (() => {
              const headshotFile = files?.find((file: any) => 
                file.file_type === 'headshot' && 
                file.file_name?.toLowerCase().includes(contact.contact_name?.toLowerCase().split(' ')[0])
              );
              return headshotFile ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${headshotFile.bucket_name}/${headshotFile.file_path}` : null;
            })()
          }))
      },
      
      locations: {
        all: (locations || [])
          .map((loc: any) => ({
            id: loc.id,
            place_name: loc.place_name,
            coordinates: loc.coordinates
          })),
        is_nationwide: (locations || []).length === 0 || 
          (locations || []).some((loc: any) => loc.place_name?.toLowerCase().includes('nationwide'))
      },
      
      faqs: (faqs || [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((faq: any) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer
        })),
      
      files: {
        brochures: (files || [])
          .filter((file: any) => file.file_type === 'brochure')
          .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
          .map((file: any) => ({
            id: file.id,
            name: file.file_name,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
            size: file.file_size,
            type: 'brochure',
            caption: file.caption || null
          })),
        fit_outs: (files || [])
          .filter((file: any) => file.file_type === 'fitOut' || file.file_type === 'fit_out')
          .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
          .map((file: any) => ({
            id: file.id,
            name: file.file_name,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fit-outs/${file.file_path}`,
            size: file.file_size,
            type: 'fit_out',
            caption: file.caption || null
          })),
        site_plans: (files || [])
          .filter((file: any) => file.file_type === 'sitePlan' || file.file_type === 'site_plan')
          .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
          .map((file: any) => ({
            id: file.id,
            name: file.file_name,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site-plans/${file.file_path}`,
            size: file.file_size,
            type: 'site_plan',
            caption: file.caption || null
          }))
      },
      
      id: listing.id,
      title: listing.title,
      description: listing.description || '',
      created_at: listing.created_at,
      listing_type: listing.listing_type || 'commercial'
    };

    return NextResponse.json(enhancedListing);
    
  } catch (error) {
    console.error('Unexpected error in owner listing preview API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}