import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase';

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
    const adminSupabase = createAdminClient();
    
    // First check if listing exists and is approved
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, status, company_name, created_at, live_version_id, current_version_id')
      .eq('id', id)
      .single();


    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Only show approved listings publicly
    if (listing.status !== 'approved') {
      return NextResponse.json(
        { error: 'Listing not available' },
        { status: 404 }
      );
    }

    // Get the latest approved version
    // Use adminSupabase to bypass RLS since we've already verified listing is approved
    // First try to get the live version
    const { data: liveVersion, error: liveError } = await adminSupabase
      .from('listing_versions')
      .select('content, version_number, created_at, is_live')
      .eq('listing_id', id)
      .eq('status', 'approved')
      .eq('is_live', true)
      .single();

    // If no live version, get the latest approved version
    let approvedVersion = liveVersion;
    let versionError = liveError;

    if (!liveVersion) {
      const result = await adminSupabase
        .from('listing_versions')
        .select('content, version_number, created_at, is_live')
        .eq('listing_id', id)
        .eq('status', 'approved')
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      approvedVersion = result.data;
      versionError = result.error;
    }

    if (versionError || !approvedVersion) {
      // Fallback to current database state if no approved version exists
      // This handles legacy listings that don't have versions yet
      console.warn(`No approved version found for listing ${id}, falling back to current state`);
      console.log('Version error:', versionError);
      console.log('Approved version data:', approvedVersion);
      
      // Get current data from database
      const [
        { data: currentListing },
        { data: locations },
        { data: faqs },
        { data: files },
        { data: contacts },
        { data: listingSectors },
        { data: listingUseClasses }
      ] = await Promise.all([
        supabase.from('listings').select(`
          id, 
          company_name, 
          company_domain,
          clearbit_logo,
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
          listing_agents(
            id,
            agency_id,
            added_at,
            agency:agencies(
              id,
              name,
              logo_url,
              geographic_patch,
              classification
            )
          )
        `).eq('id', id).single(),
        supabase.from('listing_locations').select('id, place_name, coordinates, formatted_address').eq('listing_id', id),
        supabase.from('faqs').select('id, question, answer, display_order').eq('listing_id', id),
        supabase.from('file_uploads').select('id, file_path, file_name, file_size, file_type, bucket_name, is_primary, display_order, caption').eq('listing_id', id),
        supabase.from('listing_contacts').select('id, contact_name, contact_title, contact_email, contact_phone, contact_area, headshot_url, is_primary_contact').eq('listing_id', id),
        supabase.from('listing_sectors').select('sector_id, sectors(id, name)').eq('listing_id', id),
        supabase.from('listing_use_classes').select('use_class_id, use_classes(id, name, code)').eq('listing_id', id)
      ]);

      console.log('LISTING_AGENTS_DEBUG:', {
        listing_agents: currentListing?.listing_agents
      });

      const allSectors = (listingSectors?.map((ls: any) => ls.sectors).filter(Boolean) || []);
      const allUseClasses = (listingUseClasses?.map((luc: any) => luc.use_classes).filter(Boolean) || []);

      // Handle logo logic for fallback
      const fallbackLogoFile = files?.find((f: any) => f.file_type === 'logo');
      let fallbackLogoUrl = null;
      let fallbackShouldUseClearbitFallback = false;
      
      if (fallbackLogoFile) {
        fallbackLogoUrl = fallbackLogoFile.file_path;
      } else if (currentListing?.clearbit_logo && currentListing?.company_domain) {
        fallbackLogoUrl = `https://logo.clearbit.com/${currentListing.company_domain}`;
      } else {
        fallbackShouldUseClearbitFallback = true;
      }

      // Transform fallback response to enhanced format
      const fallbackResponse = {
        company: {
          name: currentListing?.company_name || 'Unnamed Company',
          logo_url: fallbackLogoUrl,
          use_clearbit_fallback: fallbackShouldUseClearbitFallback,
          clearbit_logo: currentListing?.clearbit_logo,
          company_domain: currentListing?.company_domain,
          brochure_url: files?.find((f: any) => f.file_type === 'brochure')?.file_path || null,
          property_page_link: currentListing?.property_page_link,
          sectors: allSectors.map((s: any) => s.name),
          use_classes: allUseClasses.map((uc: any) => `${uc.code} - ${uc.name}`),
          sector: allSectors[0]?.name || '',
          use_class: allUseClasses[0] ? `${allUseClasses[0].code} - ${allUseClasses[0].name}` : '',
          site_size: currentListing?.site_size_min && currentListing?.site_size_max 
            ? `${currentListing.site_size_min.toLocaleString()} - ${currentListing.site_size_max.toLocaleString()} sq ft`
            : '',
          dwelling_count: currentListing?.dwelling_count_min && currentListing?.dwelling_count_max
            ? `${currentListing.dwelling_count_min} - ${currentListing.dwelling_count_max} units`
            : '',
          site_acreage: currentListing?.site_acreage_min && currentListing?.site_acreage_max
            ? `${currentListing.site_acreage_min} - ${currentListing.site_acreage_max} acres`
            : ''
        },
        contacts: {
          primary: contacts?.find((c: any) => c.is_primary_contact) || contacts?.[0] 
            ? {
                ...contacts?.find((c: any) => c.is_primary_contact) || contacts?.[0],
                name: contacts?.find((c: any) => c.is_primary_contact)?.contact_name || contacts?.[0]?.contact_name,
                title: contacts?.find((c: any) => c.is_primary_contact)?.contact_title || contacts?.[0]?.contact_title,
                email: contacts?.find((c: any) => c.is_primary_contact)?.contact_email || contacts?.[0]?.contact_email,
                phone: contacts?.find((c: any) => c.is_primary_contact)?.contact_phone || contacts?.[0]?.contact_phone
              }
            : null,
          additional: contacts?.filter((c: any) => !c.is_primary_contact).map((c: any) => ({
            ...c,
            name: c.contact_name,
            title: c.contact_title,
            email: c.contact_email,
            phone: c.contact_phone
          })) || []
        },
        locations: {
          all: locations || [],
          is_nationwide: !locations || locations.length === 0
        },
        faqs: faqs || [],
        files: {
          site_plans: files?.filter((f: any) => f.file_type === 'sitePlan' || f.file_type === 'site_plan').map((f: any) => ({
            ...f,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
            name: f.file_name,
            size: f.file_size
          })) || [],
          fit_outs: files?.filter((f: any) => f.file_type === 'fitOut' || f.file_type === 'fit_out').map((f: any) => ({
            ...f,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
            name: f.file_name,
            size: f.file_size
          })) || [],
          brochures: files?.filter((f: any) => f.file_type === 'brochure').map((f: any) => ({
            ...f,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
            name: f.file_name,
            size: f.file_size
          })) || []
        },
        listing_type: currentListing?.listing_type,
        description: currentListing?.description,
        id: currentListing?.id,
        created_at: currentListing?.created_at,
        listing_agents: currentListing?.listing_agents
      };

      const fallbackResponseWithHeaders = NextResponse.json(fallbackResponse);
      
      // Prevent caching of dynamic listing data
      fallbackResponseWithHeaders.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      fallbackResponseWithHeaders.headers.set('Pragma', 'no-cache');
      fallbackResponseWithHeaders.headers.set('Expires', '0');
      
      return fallbackResponseWithHeaders;
    }

    // Use the approved version content
    // Check if content needs to be parsed from JSON string
    const versionContent = typeof approvedVersion.content === 'string'
      ? JSON.parse(approvedVersion.content)
      : approvedVersion.content;

    // Extract data from the version content
    const listingData = versionContent.listing || {};
    const locations = versionContent.locations || [];
    const faqs = versionContent.faqs || [];
    const files = versionContent.files || [];
    const contacts = versionContent.contacts || [];
    const sectors = (versionContent.sectors || []).map((s: any) => s.sector).filter(Boolean);
    const useClasses = (versionContent.use_classes || []).map((uc: any) => uc.use_class).filter(Boolean);
    
    // Get current listing agents from junction table
    const { data: listingAgents } = await supabase
      .from('listing_agents')
      .select(`
        id,
        agency_id,
        added_at,
        agency:agencies(
          id,
          name,
          logo_url,
          geographic_patch,
          classification
        )
      `)
      .eq('listing_id', id);
    

    // Format the response to match the expected structure
    const formattedListing = {
      id: listingData.id,
      company_name: listingData.company_name,
      company_domain: listingData.company_domain,
      clearbit_logo: listingData.clearbit_logo,
      title: listingData.title,
      description: listingData.description,
      site_size_min: listingData.site_size_min,
      site_size_max: listingData.site_size_max,
      contact_name: listingData.contact_name,
      contact_title: listingData.contact_title,
      contact_email: listingData.contact_email,
      contact_phone: listingData.contact_phone,
      contact_area: listingData.contact_area,
      created_at: listingData.created_at,
      listing_type: listingData.listing_type,
      dwelling_count_min: listingData.dwelling_count_min,
      dwelling_count_max: listingData.dwelling_count_max,
      site_acreage_min: listingData.site_acreage_min,
      site_acreage_max: listingData.site_acreage_max,
      property_page_link: listingData.property_page_link,
      listing_agents: listingAgents
    };


    // Handle logo logic
    const logoFile = files.find((f: any) => f.file_type === 'logo');
    let logoUrl = null;
    let shouldUseClearbitFallback = false;
    
    if (logoFile) {
      // Use uploaded logo file - convert file path to full Supabase storage URL
      if (logoFile.file_path.startsWith('http')) {
        // Already a full URL
        logoUrl = logoFile.file_path;
      } else {
        // Convert file path to Supabase storage URL
        const bucket = logoFile.bucket_name || 'listings'; // fallback to listings if no bucket specified
        const { data } = supabase.storage.from(bucket).getPublicUrl(logoFile.file_path);
        logoUrl = data.publicUrl;
      }
    } else if (formattedListing.clearbit_logo && formattedListing.company_domain) {
      // Use clearbit logo if enabled and domain available
      logoUrl = `https://logo.clearbit.com/${formattedListing.company_domain}`;
    } else {
      // Use initials fallback
      shouldUseClearbitFallback = true;
    }

    // Transform to match EnhancedListingModalContent structure
    const enhancedResponse: any = {
      company: {
        name: formattedListing.company_name || 'Unnamed Company',
        logo_url: logoUrl,
        use_clearbit_fallback: shouldUseClearbitFallback,
        clearbit_logo: formattedListing.clearbit_logo,
        company_domain: formattedListing.company_domain,
        brochure_url: files.find((f: any) => f.file_type === 'brochure')?.file_path || null,
        property_page_link: formattedListing.property_page_link,
        sectors: sectors.map((s: any) => s.name),
        use_classes: useClasses.map((uc: any) => `${uc.code} - ${uc.name}`),
        // Legacy fields
        sector: sectors[0]?.name || '',
        use_class: useClasses[0] ? `${useClasses[0].code} - ${useClasses[0].name}` : '',
        site_size: formattedListing.site_size_min && formattedListing.site_size_max 
          ? `${formattedListing.site_size_min.toLocaleString()} - ${formattedListing.site_size_max.toLocaleString()} sq ft`
          : '',
        dwelling_count: formattedListing.dwelling_count_min && formattedListing.dwelling_count_max
          ? `${formattedListing.dwelling_count_min} - ${formattedListing.dwelling_count_max} units`
          : '',
        site_acreage: formattedListing.site_acreage_min && formattedListing.site_acreage_max
          ? `${formattedListing.site_acreage_min} - ${formattedListing.site_acreage_max} acres`
          : ''
      },
      contacts: {
        primary: contacts.find((c: any) => c.is_primary_contact) || contacts[0] 
          ? {
              ...contacts.find((c: any) => c.is_primary_contact) || contacts[0],
              name: contacts.find((c: any) => c.is_primary_contact)?.contact_name || contacts[0]?.contact_name,
              title: contacts.find((c: any) => c.is_primary_contact)?.contact_title || contacts[0]?.contact_title,
              email: contacts.find((c: any) => c.is_primary_contact)?.contact_email || contacts[0]?.contact_email,
              phone: contacts.find((c: any) => c.is_primary_contact)?.contact_phone || contacts[0]?.contact_phone
            }
          : null,
        additional: contacts.filter((c: any) => !c.is_primary_contact).map((c: any) => ({
          ...c,
          name: c.contact_name,
          title: c.contact_title,
          email: c.contact_email,
          phone: c.contact_phone
        }))
      },
      locations: {
        all: locations,
        is_nationwide: locations.length === 0
      },
      faqs: faqs,
      files: {
        site_plans: files.filter((f: any) => f.file_type === 'sitePlan' || f.file_type === 'site_plan').map((f: any) => ({
          ...f,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
          name: f.file_name,
          size: f.file_size
        })),
        fit_outs: files.filter((f: any) => f.file_type === 'fitOut' || f.file_type === 'fit_out').map((f: any) => ({
          ...f,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
          name: f.file_name,
          size: f.file_size
        })),
        brochures: files.filter((f: any) => f.file_type === 'brochure').map((f: any) => ({
          ...f,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
          name: f.file_name,
          size: f.file_size
        }))
      },
      listing_type: formattedListing.listing_type,
      description: formattedListing.description,
      id: formattedListing.id,
      created_at: formattedListing.created_at,
      listing_agents: formattedListing.listing_agents
    };
    
    
    const response = NextResponse.json(enhancedResponse);
    
    // Prevent caching of dynamic listing data
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error) {
    console.error('Error in public listing detail endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}