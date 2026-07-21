import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase';
import { checkSubscriptionAccess } from '@/lib/subscription';
import { fetchBrandStoreEstate, fetchBrandCategory } from '@/lib/brand-estate';

export const dynamic = 'force-dynamic';

// One-shot read for the brand info modal. Also resolves whether the brand has an *active
// requirement the caller is allowed to see* — applying the same visibility rules as the
// requirement map so a free user is never handed a non-featured requirement id (which the
// requirement detail endpoint serves with no paywall). Callers branch on activeRequirementId:
// non-null -> open the requirement modal; null -> render this brand-info payload.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Brand ID is required' }, { status: 400 });
    }

    // Free-tier gating parity with /api/public/requirements/map.
    const authClient = await createServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    const hasAccess = user ? await checkSubscriptionAccess(user.id) : false;
    const isFreeTier = !hasAccess;

    const supabase = createAdminClient();

    const { data: brandRow, error: brandError } = await supabase
      .from('brands')
      .select('id, name, logo_url, latest_store_name, latest_store_town, latest_store_opened_at')
      .eq('id', id)
      .single();
    if (brandError || !brandRow) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Active-requirement lookup with the SAME visibility rules as the map: free-tier users
    // only "see" featured-free requirements.
    //
    // The free-tier filter is applied BEFORE the ordering, not after. Selecting first and
    // filtering second would show "No requirement on file" to a free user whose brand has a
    // featured-free requirement sitting behind a newer private one.
    //
    // The ordering itself matters because brand_id is not unique and several requirements can
    // be active at once — a bare limit(1) is nondeterministic and made the same brand flip
    // between requirements across requests. Matches idx_requirements_brand_active_pick.
    let activeReqQuery = supabase
      .from('requirements')
      .select('id')
      .eq('brand_id', id)
      .eq('status', 'active');
    if (isFreeTier) {
      activeReqQuery = activeReqQuery.eq('is_featured_free', true);
    }
    const { data: activeReqRows } = await activeReqQuery
      .order('verified_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(1);
    const activeRequirementId: string | null =
      activeReqRows && activeReqRows.length > 0 ? (activeReqRows[0] as { id: string }).id : null;

    const [estate, category, { data: contactRows }] = await Promise.all([
      fetchBrandStoreEstate(supabase, id),
      fetchBrandCategory(supabase, id),
      supabase
        .from('brand_contacts')
        .select('contact_name, contact_title, contact_org, contact_email, contact_phone, contact_kind, is_primary_contact')
        .eq('brand_id', id)
        .order('is_primary_contact', { ascending: false })
        .order('created_at', { ascending: true }),
    ]);

    // Latest store: brand overrides take precedence over the derived value.
    const brand = brandRow as {
      id: string;
      name: string;
      logo_url: string | null;
      latest_store_name: string | null;
      latest_store_town: string | null;
      latest_store_opened_at: string | null;
    };
    const latestStore =
      brand.latest_store_name || brand.latest_store_town || brand.latest_store_opened_at
        ? {
            name: brand.latest_store_name,
            town: brand.latest_store_town,
            openedDate: brand.latest_store_opened_at,
          }
        : estate.latestStore
        ? { name: estate.latestStore.name, town: estate.latestStore.town, openedDate: estate.latestStore.date }
        : null;

    const contacts = (contactRows || []).map((c: any) => ({
      name: c.contact_name,
      title: c.contact_title,
      org: c.contact_org,
      email: c.contact_email,
      phone: c.contact_phone,
      kind: c.contact_kind === 'in-house' || c.contact_kind === 'agency' ? c.contact_kind : null,
    }));

    const response = NextResponse.json({
      activeRequirementId,
      brand: {
        id: brand.id,
        name: brand.name,
        logo_url: brand.logo_url,
        category,
        storeCount: estate.storeCount,
        latestStore,
        locations: estate.stores.map((s) => ({ lat: s.lat, lon: s.lon })),
      },
      contacts,
    });
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    return response;
  } catch (error) {
    console.error('Error in brand detail endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
