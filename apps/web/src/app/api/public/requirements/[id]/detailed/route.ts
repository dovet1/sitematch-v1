import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requirementRowToDetail } from '@/lib/requirement-detail';
import type { RequirementDetailRow } from '@/lib/requirement-detail';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Requirement ID is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 404 unless active so archived requirements can't leak via direct URL.
    const { data, error } = await supabase
      .from('requirements')
      .select(`
        id,
        listing_type,
        description,
        verified_at,
        company_name,
        company_domain,
        clearbit_logo,
        logo_url,
        brochure_url,
        site_size_min,
        site_size_max,
        requirement_locations(place_name, formatted_address),
        requirement_contacts(contact_name, contact_title, contact_email, contact_phone, contact_org, contact_kind, is_primary_contact),
        requirement_sectors(sector:sectors(name)),
        requirement_use_classes(use_class:use_classes(name, code)),
        brand:brands(id, name, brand_contacts(contact_name, contact_title, contact_email, contact_phone, contact_org, contact_kind, is_primary_contact))
      `)
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    const detail = requirementRowToDetail(data as unknown as RequirementDetailRow);

    const response = NextResponse.json(detail);
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    return response;
  } catch (error) {
    console.error('Error in requirement detail endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
