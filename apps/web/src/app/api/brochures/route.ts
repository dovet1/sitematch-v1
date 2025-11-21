import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/brochures - List all brochures for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: brochures, error } = await supabase
      .from('brochures')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching brochures:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brochures' },
        { status: 500 }
      );
    }

    return NextResponse.json(brochures);
  } catch (error) {
    console.error('Unexpected error in GET /api/brochures:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/brochures - Create a new brochure
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields (support both camelCase and snake_case)
    const companyName = body.companyName || body.company_name;
    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    const requirementsSummary = body.requirementsSummary || body.requirements_summary;
    if (!requirementsSummary) {
      return NextResponse.json(
        { error: 'Requirements summary is required' },
        { status: 400 }
      );
    }

    const agentName = body.agentName || body.agent_name;
    const agentCompany = body.agentCompany || body.agent_company;
    const agentEmail = body.agentEmail || body.agent_email;
    if (!agentName || !agentCompany || !agentEmail) {
      return NextResponse.json(
        { error: 'Agent name, company, and email are required' },
        { status: 400 }
      );
    }

    // Validate array limits
    const targetLocations = body.targetLocations || body.target_locations;
    if (targetLocations && targetLocations.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 target locations allowed' },
        { status: 400 }
      );
    }

    const storeImages = body.storeImages || body.store_images;
    if (storeImages && storeImages.length > 6) {
      return NextResponse.json(
        { error: 'Maximum 6 store images allowed' },
        { status: 400 }
      );
    }

    const { data: brochure, error } = await supabase
      .from('brochures')
      .insert({
        user_id: user.id,
        listing_id: body.listing_id || null,
        company_name: body.companyName || body.company_name,
        company_domain: body.companyDomain || body.company_domain || null,
        company_logo_source: body.companyLogoSource || body.company_logo_source || 'logo_dev',
        company_logo_url: body.companyLogoUrl || body.company_logo_url || null,
        company_about: body.companyAbout || body.company_about || null,
        agent_name: body.agentName || body.agent_name,
        agent_company: body.agentCompany || body.agent_company,
        agent_email: body.agentEmail || body.agent_email,
        agent_phone: body.agentPhone || body.agent_phone || null,
        agent_domain: body.agentDomain || body.agent_domain || null,
        agent_logo_source: body.agentLogoSource || body.agent_logo_source || 'logo_dev',
        agent_logo_url: body.agentLogoUrl || body.agent_logo_url || null,
        requirements_summary: body.requirementsSummary || body.requirements_summary,
        sqft_min: body.sqftMin || body.sqft_min || null,
        sqft_max: body.sqftMax || body.sqft_max || null,
        use_class: body.useClass || body.use_class || null,
        use_class_label: body.useClassLabel || body.use_class_label || null,
        sector: body.sector || null,
        sector_label: body.sectorLabel || body.sector_label || null,
        additional_notes: body.additionalNotes || body.additional_notes || null,
        target_locations: body.targetLocations || body.target_locations || [],
        store_images: body.storeImages || body.store_images || [],
        brand_color: body.brandColor || body.brand_color || '#7c3aed',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating brochure:', error);
      return NextResponse.json(
        { error: 'Failed to create brochure' },
        { status: 500 }
      );
    }

    return NextResponse.json(brochure, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/brochures:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
