import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

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

    // Require admin authentication
    await requireAdmin();

    const supabase = createServerClient();

    // Get the listing status first to determine what version to show
    const { data: listingInfo, error: listingInfoError } = await supabase
      .from('listings')
      .select('status')
      .eq('id', id)
      .single();

    if (listingInfoError) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    let version;
    let versionError;

    // Try to get the appropriate version based on listing status
    if (listingInfo.status === 'pending') {
      // Get the latest pending_review version
      const result = await supabase
        .from('listing_versions')
        .select('content, version_number, created_at')
        .eq('listing_id', id)
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      version = result.data;
      versionError = result.error;
    }

    // If no pending_review version found, try to get the latest version of any status
    if (!version) {
      const result = await supabase
        .from('listing_versions')
        .select('content, version_number, created_at')
        .eq('listing_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      version = result.data;
      versionError = result.error;
    }

    // If still no version found, fall back to current database state
    if (!version) {
      console.log(`No version found for listing ${id}, falling back to current database state`);
      
      // Get current database state as fallback
      const [
        { data: listing },
        { data: contacts },
        { data: locations }, 
        { data: faqs },
        { data: sectors },
        { data: useClasses },
        { data: files }
      ] = await Promise.all([
        supabase.from('listings').select('*').eq('id', id).single(),
        supabase.from('listing_contacts').select('*').eq('listing_id', id),
        supabase.from('listing_locations').select('*').eq('listing_id', id),
        supabase.from('faqs').select('*').eq('listing_id', id),
        supabase.from('listing_sectors').select('sector_id, sectors(id, name)').eq('listing_id', id),
        supabase.from('listing_use_classes').select('use_class_id, use_classes(id, name, code)').eq('listing_id', id),
        supabase.from('file_uploads').select('*').eq('listing_id', id)
      ]);

      if (!listing) {
        return NextResponse.json(
          { error: 'Listing not found' },
          { status: 404 }
        );
      }

      // Create a version-like content structure
      version = {
        content: {
          listing,
          contacts: contacts || [],
          locations: locations || [],
          faqs: (faqs || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
          sectors: (sectors || []).map((s: any) => ({
            sector_id: s.sector_id,
            sector: s.sectors
          })),
          use_classes: (useClasses || []).map((uc: any) => ({
            use_class_id: uc.use_class_id,
            use_class: uc.use_classes
          })),
          files: (files || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        }
      };
    }

    // Extract the versioned content
    const versionContent = version.content;
    
    if (!versionContent?.listing) {
      return NextResponse.json(
        { error: 'Invalid version content' },
        { status: 500 }
      );
    }

    // Use the versioned data
    const listing = versionContent.listing;
    const contacts = versionContent.contacts || [];
    const locations = versionContent.locations || [];
    const faqs = versionContent.faqs || [];
    const files = versionContent.files || [];
    const sectors = versionContent.sectors || [];
    const useClasses = versionContent.use_classes || [];

    // Get sectors and use classes from versioned data
    const allSectors = sectors.map((s: any) => s.sector).filter(Boolean);
    const allUseClasses = useClasses.map((uc: any) => uc.use_class).filter(Boolean);

    // Get logo file or generate Logo.dev URL
    const logoFile = files?.find((file: any) => file.file_type === 'logo' && file.is_primary);

    const generateLogoDevUrl = (companyDomain: string | null, companyName: string) => {
      const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
      if (!token) return null;

      if (companyDomain) {
        return `https://img.logo.dev/${companyDomain}?token=${token}`;
      }

      const domain = companyName
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')
        .replace(/ltd|limited|plc|inc|corp|corporation|llc/g, '');

      return `https://img.logo.dev/${domain}.com?token=${token}`;
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
        logo_url: logoFile ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${logoFile.bucket_name}/${logoFile.file_path}` : generateLogoDevUrl(listing.company_domain, listing.company_name),
        sectors: allSectors.map((s: any) => formatSectorName(s.name)).filter(Boolean),
        use_classes: allUseClasses.map((uc: any) => `${uc.name} (${uc.code})`).filter(Boolean),
        sector: allSectors.map((s: any) => formatSectorName(s.name)).join(', ') || 'Not specified',
        use_class: allUseClasses.map((uc: any) => `${uc.name} (${uc.code})`).join(', ') || 'Not specified',
        site_size: formatSizeRange(listing.site_size_min, listing.site_size_max),
        dwelling_count: formatDwellingRange(listing.dwelling_count_min, listing.dwelling_count_max),
        site_acreage: formatAcreageRange(listing.site_acreage_min, listing.site_acreage_max),
        property_page_link: listing.property_page_link
      },
      
      // Contact information from versioned contacts data
      contacts: {
        primary: (() => {
          // Find the primary contact from versioned contacts data
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
        videos: (files || [])
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
        photos: (files || [])
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
    console.error('Unexpected error in admin listing preview API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}