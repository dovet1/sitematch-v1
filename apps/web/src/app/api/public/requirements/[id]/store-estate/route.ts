import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const STORE_POINT_CAP = 5000;

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

    // 404 unless active so archived requirements can't leak estate data via direct URL.
    const { data: requirement, error: reqError } = await supabase
      .from('requirements')
      .select('id, brand_id')
      .eq('id', id)
      .eq('status', 'active')
      .single();

    if (reqError || !requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    const brandId = (requirement as { brand_id: string | null }).brand_id;
    if (!brandId) {
      return NextResponse.json({ storeCount: 0, stores: [], latestStore: null });
    }

    // Exact count (accurate for >5k estates) + capped points for the map.
    const [{ count }, { data: stores }] = await Promise.all([
      supabase
        .from('stores')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId),
      supabase
        .from('stores')
        .select('id, name, town, lat, lon')
        .eq('brand_id', brandId)
        .limit(STORE_POINT_CAP),
    ]);

    // Latest store — two explicit steps so a recently-imported row (null open_date)
    // never outranks a real opening date.
    let latestStore: {
      name: string | null;
      town: string | null;
      date: string | null;
      dateIsProxy: boolean;
    } | null = null;

    const { data: openedRows } = await supabase
      .from('stores')
      .select('name, town, open_date')
      .eq('brand_id', brandId)
      .not('open_date', 'is', null)
      .order('open_date', { ascending: false })
      .limit(1);

    if (openedRows && openedRows.length > 0) {
      const row = openedRows[0] as { name: string | null; town: string | null; open_date: string | null };
      latestStore = { name: row.name, town: row.town, date: row.open_date, dateIsProxy: false };
    } else {
      const { data: createdRows } = await supabase
        .from('stores')
        .select('name, town, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (createdRows && createdRows.length > 0) {
        const row = createdRows[0] as { name: string | null; town: string | null; created_at: string | null };
        latestStore = { name: row.name, town: row.town, date: row.created_at, dateIsProxy: true };
      }
    }

    const response = NextResponse.json({
      storeCount: count ?? 0,
      stores: stores || [],
      latestStore,
    });
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    return response;
  } catch (error) {
    console.error('Error in requirement store-estate endpoint:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
