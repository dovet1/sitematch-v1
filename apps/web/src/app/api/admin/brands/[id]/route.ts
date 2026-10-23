import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';
import { fetchBrandCategory } from '@/lib/brand-estate';
import { normalizeDomain, validateDomain } from '@/lib/clearbit-logo';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user };
}

// Brand fields + derived category + counts for the hub Details section.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser();
    if (gate.error) return gate.error;

    const { id } = await params;
    const supabase = adminClient();

    const { data: brand, error } = await supabase
      .from('brands')
      .select(
        'id, name, logo_url, domain, website_url, store_locator_url, latest_store_name, latest_store_town, latest_store_opened_at, stores(count), requirements(count), brand_contacts(count), brand_use_classes(use_classes(code))'
      )
      .eq('id', id)
      .single();
    if (error || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const [category, { data: useClassOptions }] = await Promise.all([
      fetchBrandCategory(supabase, id),
      supabase.from('use_classes').select('code, name').order('code'),
    ]);

    return NextResponse.json({
      brand: {
        id: brand.id,
        name: brand.name,
        logo_url: brand.logo_url ?? null,
        domain: brand.domain ?? null,
        website_url: brand.website_url ?? null,
        store_locator_url: brand.store_locator_url ?? null,
        latest_store_name: brand.latest_store_name ?? null,
        latest_store_town: brand.latest_store_town ?? null,
        latest_store_opened_at: brand.latest_store_opened_at ?? null,
        category,
        storeCount: (brand as any).stores?.[0]?.count ?? 0,
        requirementCount: (brand as any).requirements?.[0]?.count ?? 0,
        contactCount: (brand as any).brand_contacts?.[0]?.count ?? 0,
        use_class_codes: (((brand as any).brand_use_classes ?? []) as { use_classes: { code: string } | null }[])
          .map((u) => u.use_classes?.code)
          .filter((c): c is string => !!c),
      },
      useClassOptions: useClassOptions ?? [],
    });
  } catch (error) {
    console.error('Error fetching brand:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Edit brand identity + latest-store overrides.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser();
    if (gate.error) return gate.error;

    const { id } = await params;
    const body = await request.json();

    const update: Record<string, unknown> = {};
    if (typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
      update.name = name;
    }
    if ('logo_url' in body) update.logo_url = body.logo_url || null;
    if ('domain' in body) {
      const d = body.domain ? normalizeDomain(body.domain) : '';
      if (d && !validateDomain(d)) {
        return NextResponse.json({ error: 'Invalid domain' }, { status: 400 });
      }
      update.domain = d || null;
    }
    // website_url / store_locator_url are full URLs, unlike `domain` which is a bare
    // hostname for logo.dev — so they get URL validation rather than validateDomain.
    for (const field of ['website_url', 'store_locator_url'] as const) {
      if (field in body) {
        const raw = typeof body[field] === 'string' ? body[field].trim() : '';
        if (!raw) {
          update[field] = null;
          continue;
        }
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
          const parsed = new URL(withProtocol);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol');
          update[field] = parsed.toString();
        } catch {
          return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
        }
      }
    }
    if ('latest_store_name' in body) update.latest_store_name = body.latest_store_name || null;
    if ('latest_store_town' in body) update.latest_store_town = body.latest_store_town || null;
    if ('latest_store_opened_at' in body) update.latest_store_opened_at = body.latest_store_opened_at || null;

    let useClassCodes: string[] | null = null;
    if ('use_class_codes' in body) {
      if (!Array.isArray(body.use_class_codes) || body.use_class_codes.some((c: unknown) => typeof c !== 'string')) {
        return NextResponse.json({ error: 'use_class_codes must be an array of codes' }, { status: 400 });
      }
      useClassCodes = body.use_class_codes;
    }

    if (Object.keys(update).length === 0 && !useClassCodes) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = adminClient();
    let data = null;
    if (Object.keys(update).length > 0) {
      const res = await supabase
        .from('brands')
        .update(update)
        .eq('id', id)
        .select('id, name, logo_url, domain, latest_store_name, latest_store_town, latest_store_opened_at')
        .single();
      if (res.error) throw res.error;
      data = res.data;
    }
    if (useClassCodes) {
      const { error } = await supabase.rpc('save_brand_use_classes', { p_brand_id: id, p_codes: useClassCodes });
      if (error) throw error;
    }

    return NextResponse.json({ brand: data });
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
