import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Share token is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();
    
    // Find listing by share token and verify it's shareable
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, status, is_public_shareable, company_name, created_at')
      .eq('share_token', token)
      .eq('is_public_shareable', true)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { error: 'Shared listing not found or no longer available' },
        { status: 404 }
      );
    }

    // Only show approved listings publicly (same as existing public API)
    if (listing.status !== 'approved') {
      return NextResponse.json(
        { error: 'Shared listing not available' },
        { status: 404 }
      );
    }

    const listingId = listing.id;

    // Get the latest approved version (reusing logic from existing public API)
    const { data: approvedVersion, error: versionError } = await supabase
      .from('listing_versions')
      .select('content')
      .eq('listing_id', listingId)
      .eq('status', 'approved')
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (versionError || !approvedVersion) {
      // Fallback to current database state (same as existing public API)
      console.warn(`No approved version found for shared listing ${listingId}, falling back to current state`);
      
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
        `).eq('id', listingId).single(),
        supabase.from('listing_locations').select('id, place_name, coordinates, formatted_address').eq('listing_id', listingId),
        supabase.from('faqs').select('id, question, answer, display_order').eq('listing_id', listingId),
        supabase.from('file_uploads').select('id, file_path, file_name, file_size, file_type, mime_type, bucket_name, is_primary, display_order, caption, external_url, video_provider, created_at').eq('listing_id', listingId),
        supabase.from('listing_contacts').select('id, contact_name, contact_title, contact_email, contact_phone, contact_area, headshot_url, is_primary_contact').eq('listing_id', listingId),
        supabase.from('listing_sectors').select('sector_id, sectors(id, name)').eq('listing_id', listingId),
        supabase.from('listing_use_classes').select('use_class_id, use_classes(id, name, code)').eq('listing_id', listingId)
      ]);

      const allSectors = (listingSectors?.map((ls: any) => ls.sectors).filter(Boolean) || []);
      const allUseClasses = (listingUseClasses?.map((luc: any) => luc.use_classes).filter(Boolean) || []);

      // Handle logo logic for fallback
      const fallbackLogoFile = files?.find((f: any) => f.file_type === 'logo');
      let fallbackLogoUrl = null;
      let fallbackShouldUseClearbitFallback = false;

      if (fallbackLogoFile) {
        fallbackLogoUrl = fallbackLogoFile.file_path;
      } else if (currentListing?.clearbit_logo && currentListing?.company_domain) {
        const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
        fallbackLogoUrl = token ? `https://img.logo.dev/${currentListing.company_domain}?token=${token}` : null;
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
          use_classes: allUseClasses.map((uc: any) => uc.code),
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
          photos: files?.filter((f: any) => f.file_type === 'photo' || f.file_type === 'site_plan').map((f: any) => ({
            ...f,
            url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
            name: f.file_name,
            size: f.file_size
          })) || [],
          videos: files?.filter((f: any) => f.file_type === 'video' || f.file_type === 'fit_out').map((f: any) => ({
            ...f,
            url: f.external_url || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
            name: f.file_name,
            size: f.file_size,
            isExternal: !!f.external_url,
            externalUrl: f.external_url,
            videoProvider: f.video_provider
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
        listing_agents: currentListing?.listing_agents,
        // Add sharing metadata
        is_shared: true,
        share_token: token
      };

      return NextResponse.json(fallbackResponse);
    }

    // Use the approved version content (same logic as existing public API)
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
      .eq('listing_id', listingId);

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
      if (logoFile.file_path.startsWith('http')) {
        logoUrl = logoFile.file_path;
      } else {
        const bucket = logoFile.bucket_name || 'listings';
        const { data } = supabase.storage.from(bucket).getPublicUrl(logoFile.file_path);
        logoUrl = data.publicUrl;
      }
    } else if (formattedListing.clearbit_logo && formattedListing.company_domain) {
      const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
      logoUrl = token ? `https://img.logo.dev/${formattedListing.company_domain}?token=${token}` : null;
      if (!logoUrl) shouldUseClearbitFallback = true;
    } else {
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
        use_classes: useClasses.map((uc: any) => uc.code),
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
        photos: files.filter((f: any) => f.file_type === 'photo' || f.file_type === 'site_plan').map((f: any) => ({
          ...f,
          url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
          name: f.file_name,
          size: f.file_size
        })),
        videos: files.filter((f: any) => f.file_type === 'video' || f.file_type === 'fit_out').map((f: any) => ({
          ...f,
          url: f.external_url || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${f.bucket_name}/${f.file_path}`,
          name: f.file_name,
          size: f.file_size,
          isExternal: !!f.external_url,
          externalUrl: f.external_url,
          videoProvider: f.video_provider
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
      listing_agents: formattedListing.listing_agents,
      // Add sharing metadata
      is_shared: true,
      share_token: token
    };
    
    return NextResponse.json(enhancedResponse);

  } catch (error) {
    console.error('Error in shared listing endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}