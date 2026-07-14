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

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;

    const supabase = adminClient();
    const { data, error } = await supabase
      .from('requirements')
      .select(`
        *,
        brands(id, name),
        requirement_locations(*),
        requirement_contacts(*),
        requirement_sectors(sector_id, sectors(id, name)),
        requirement_use_classes(use_class_id, use_classes(id, name, code))
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }
    return NextResponse.json({ requirement: data });
  } catch (error) {
    console.error('Error fetching requirement:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;
    const body = await request.json();

    // Update is keyed on id; children replaced atomically by the RPC.
    const payload = { ...body, id };

    const supabase = adminClient();
    const { data, error } = await supabase.rpc('save_requirement', { payload });
    if (error) throw error;

    return NextResponse.json({ id: data });
  } catch (error) {
    console.error('Error updating requirement:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Archive (soft): flip status to 'archived' so it drops off the unified map.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;

    const supabase = adminClient();
    const { error } = await supabase
      .from('requirements')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error archiving requirement:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
