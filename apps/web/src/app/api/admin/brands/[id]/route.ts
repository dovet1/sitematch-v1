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
        'id, name, logo_url, domain, latest_store_name, latest_store_town, latest_store_opened_at, stores(count), requirements(count), brand_contacts(count)'
      )
      .eq('id', id)
      .single();
    if (error || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const category = await fetchBrandCategory(supabase, id);

    return NextResponse.json({
      brand: {
        id: brand.id,
        name: brand.name,
        logo_url: brand.logo_url ?? null,
        domain: brand.domain ?? null,
        latest_store_name: brand.latest_store_name ?? null,
        latest_store_town: brand.latest_store_town ?? null,
        latest_store_opened_at: brand.latest_store_opened_at ?? null,
        category,
        storeCount: (brand as any).stores?.[0]?.count ?? 0,
        requirementCount: (brand as any).requirements?.[0]?.count ?? 0,
        contactCount: (brand as any).brand_contacts?.[0]?.count ?? 0,
      },
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
    if ('latest_store_name' in body) update.latest_store_name = body.latest_store_name || null;
    if ('latest_store_town' in body) update.latest_store_town = body.latest_store_town || null;
    if ('latest_store_opened_at' in body) update.latest_store_opened_at = body.latest_store_opened_at || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = adminClient();
    const { data, error } = await supabase
      .from('brands')
      .update(update)
      .eq('id', id)
      .select('id, name, logo_url, domain, latest_store_name, latest_store_town, latest_store_opened_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ brand: data });
  } catch (error) {
    console.error('Error updating brand:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
