import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Create a brand (used by the requirements admin to link an occupier to its store estate).
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const supabase = adminClient();

    // Reuse an existing brand with the same name (case-insensitive) rather than duplicating.
    const { data: existing } = await supabase
      .from('brands')
      .select('id, name')
      .ilike('name', name)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ brand: existing });
    }

    const { data, error } = await supabase
      .from('brands')
      .insert({ id: crypto.randomUUID(), name })
      .select('id, name')
      .single();
    if (error) throw error;

    return NextResponse.json({ brand: data });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
