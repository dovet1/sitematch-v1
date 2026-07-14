import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function adminClient() {
  // Untyped service-role client: save_requirement is a service_role-only RPC and the
  // typed Database has no Functions map.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status'); // 'active' | 'archived' | null (all)
    const needsBrand = searchParams.get('needsBrand') === 'true';
    const brandId = searchParams.get('brandId'); // filter to a single brand (hub view)

    const supabase = adminClient();
    let query = supabase
      .from('requirements')
      .select('id, company_name, brand_id, listing_type, status, is_featured_free, updated_at, brands(name)')
      .order('updated_at', { ascending: false });

    if (status === 'active' || status === 'archived') {
      query = query.eq('status', status);
    }
    if (needsBrand) {
      query = query.is('brand_id', null);
    }
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ requirements: data || [] });
  } catch (error) {
    console.error('Error listing requirements:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.company_name || typeof body.company_name !== 'string') {
      return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
    }

    // Create: never pass an id, and stamp created_by.
    const payload = { ...body, id: undefined, created_by: user.id };

    const supabase = adminClient();
    const { data, error } = await supabase.rpc('save_requirement', { payload });
    if (error) throw error;

    return NextResponse.json({ id: data });
  } catch (error) {
    console.error('Error creating requirement:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
