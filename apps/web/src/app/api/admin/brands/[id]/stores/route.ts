import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const STORE_LIST_CAP = 2000;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = adminClient();

    const [{ count }, { data: stores, error }] = await Promise.all([
      supabase.from('stores').select('*', { count: 'exact', head: true }).eq('brand_id', id),
      supabase
        .from('stores')
        .select('id, name, town, open_date, lat, lon')
        .eq('brand_id', id)
        .order('name', { ascending: true })
        .limit(STORE_LIST_CAP),
    ]);
    if (error) throw error;

    return NextResponse.json({ storeCount: count ?? 0, stores: stores || [], capped: STORE_LIST_CAP });
  } catch (error) {
    console.error('Error listing brand stores:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
