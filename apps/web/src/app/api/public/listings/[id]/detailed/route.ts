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
    
    // Get basic listing information first
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
        sector_id,
        use_class_id,
        listing_type,
        dwelling_count_min,
        dwelling_count_max,
        site_acreage_min,
        site_acreage_max
      `)
      .eq('id', id)
      .in('status', ['approved', 'pending'])
      .single();

    if (listingError) {
      if (listingError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Listing not found' },
          { status: 404 }
        );
      }
      
      console.error('Error fetching basic listing:', listingError);
      return NextResponse.json(
        { error: 'Failed to fetch listing' },
        { status: 500 }
      );
    }

    // Get related data separately
    const [
      { data: sectors },
      { data: useClasses },
      { data: locations },
      { data: faqs },
      { data: files },
      { data: contacts },
      { data: listingSectors },
      { data: listingUseClasses }
    ] = await Promise.all([
      supabase.from('sectors').select('id, name').eq('id', listing.sector_id),
      supabase.from('use_classes').select('id, name, code').eq('id', listing.use_class_id),
      supabase.from('listing_locations').select('id, place_name, coordinates, formatted_address').eq('listing_id', id),
      supabase.from('faqs').select('id, question, answer, display_order').eq('listing_id', id),
      supabase.from('file_uploads').select('id, file_path, file_name, file_size, file_type, bucket_name, is_primary, caption, display_order').eq('listing_id', id),
      supabase.from('listing_contacts').select('id, contact_name, contact_title, contact_email, contact_phone, contact_area, headshot_url, is_primary_contact').eq('listing_id', id),
      supabase.from('listing_sectors').select('sector_id, sectors(id, name)').eq('listing_id', id),
      supabase.from('listing_use_classes').select('use_class_id, use_classes(id, name, code)').eq('listing_id', id)
    ]);

    // Debug logging (remove in production)
    if (files && files.length > 0) {
      console.log(`Files found for listing ${id}:`, files.map(f => `${f.file_type}:${f.file_name}`));
    }

    // Combine sectors from direct relationship and junction table, removing duplicates
    const allSectors = [
      ...(sectors || []),
      ...(listingSectors?.map((ls: any) => ls.sectors).filter(Boolean) || [])
    ].filter((sector, index, self) => 
      index === self.findIndex(s => s.id === sector.id)
    );
    
    const allUseClasses = [
      ...(useClasses || []),
      ...(listingUseClasses?.map((luc: any) => luc.use_classes).filter(Boolean) || [])
    ].filter((useClass, index, self) => 
      index === self.findIndex(uc => uc.id === useClass.id)
    );

    // Get logo file or generate Clearbit URL
    const logoFile = files?.find((file: any) => file.file_type === 'logo' && file.is_primary);
    
    // Generate Clearbit logo URL from company domain
    const generateClearbitUrl = (companyDomain: string | null, companyName: string) => {
      if (companyDomain) {
        return `https://logo.clearbit.com/${companyDomain}`;
      }
      
      // Fallback: Convert company name to domain-like format
      const domain = companyName
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')
        .replace(/ltd|limited|plc|inc|corp|corporation|llc/g, '');
      
      return `https://logo.clearbit.com/${domain}.com`;
    };

    // Format sector names to be more readable
    const formatSectorName = (name: string) => {
      return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' & ');
    };

    // Transform comprehensive data for enhanced modal
    const enhancedListing = {
      // Core company information
      company: {
        name: listing.company_name,
        logo_url: logoFile ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${logoFile.bucket_name}/${logoFile.file_path}` : generateClearbitUrl(listing.company_domain, listing.company_name),
        sectors: allSectors.map((s: any) => formatSectorName(s.name)).filter(Boolean),
        use_classes: allUseClasses.map((uc: any) => `${uc.name} (${uc.code})`).filter(Boolean),
        // Keep legacy fields for backward compatibility
        sector: allSectors.map((s: any) => formatSectorName(s.name)).join(', ') || 'Not specified',
        use_class: allUseClasses.map((uc: any) => `${uc.name} (${uc.code})`).join(', ') || 'Not specified',
        site_size: formatSizeRange(listing.site_size_min, listing.site_size_max),
        dwelling_count: formatDwellingRange(listing.dwelling_count_min, listing.dwelling_count_max),
        site_acreage: formatAcreageRange(listing.site_acreage_min, listing.site_acreage_max)
      },
      
      // Enhanced contact information  
      contacts: {
        primary: {
          name: listing.contact_name,
          title: listing.contact_title || '',
          email: listing.contact_email,
          phone: listing.contact_phone || '',
          contact_area: listing.contact_area || '',
          headshot_url: (() => {
            // First try to find primary contact in listing_contacts table
            const primaryFromContacts = contacts?.find((contact: any) => contact.is_primary_contact);
            if (primaryFromContacts?.headshot_url) {
              return primaryFromContacts.headshot_url;
            }
            
            // Then try to find headshot file by matching contact name
            const headshotFile = files?.find((file: any) => 
              file.file_type === 'headshot' && (
                file.is_primary || 
                file.file_name?.toLowerCase().includes(listing.contact_name?.toLowerCase().split(' ')[0] || '')
              )
            );
            
            return headshotFile ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${headshotFile.bucket_name}/${headshotFile.file_path}` : null;
          })()
        },
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
      
      // Location requirements
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
      
      // FAQs with ordering
      faqs: (faqs || [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((faq: any) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer
        })),
      
      // File attachments organized by type
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
            caption: file.caption
          })),
        fit_outs: (files || [])
          .filter((file: any) => file.file_type === 'fitOut')
          .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
          .map((file: any) => ({
            id: file.id,
            name: file.file_name,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
            size: file.file_size,
            type: 'fit_out',
            caption: file.caption
          })),
        site_plans: (files || [])
          .filter((file: any) => file.file_type === 'sitePlan')
          .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
          .map((file: any) => ({
            id: file.id,
            name: file.file_name,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
            size: file.file_size,
            type: 'site_plan',
            caption: file.caption
          }))
      },
      
      // Metadata
      id: listing.id,
      title: listing.title,
      description: listing.description || '',
      created_at: listing.created_at,
      listing_type: listing.listing_type || 'commercial'
    };

    return NextResponse.json(enhancedListing);
    
  } catch (error) {
    console.error('Unexpected error in detailed listing API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to format size range
function formatSizeRange(min: number | null, max: number | null): string {
  if (!min && !max) return 'Size flexible';
  if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
  if (min) return `From ${min.toLocaleString()} sq ft`;
  if (max) return `Up to ${max.toLocaleString()} sq ft`;
  return '';
}

// Helper function to format dwelling count range
function formatDwellingRange(min: number | null, max: number | null): string {
  if (!min && !max) return 'Dwelling count flexible';
  if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} dwellings`;
  if (min) return `From ${min.toLocaleString()} dwellings`;
  if (max) return `Up to ${max.toLocaleString()} dwellings`;
  return '';
}

// Helper function to format acreage range
function formatAcreageRange(min: number | null, max: number | null): string {
  if (!min && !max) return 'Site acreage flexible';
  if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} acres`;
  if (min) return `From ${min.toLocaleString()} acres`;
  if (max) return `Up to ${max.toLocaleString()} acres`;
  return '';
}