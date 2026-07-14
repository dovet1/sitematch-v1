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

async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user };
}

// Edit a single store. The stores.location geography is derived from lat/lon by the database
// (imports only ever write lat/lon, never location), so updating the coordinates re-derives it.
// The AFTER UPDATE trigger (migration 20260715...) enqueues a 'store_update' cache rebuild — the
// API must not fire a rebuild itself.
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
    if ('name' in body) update.name = body.name || null;
    if ('town' in body) update.town = body.town || null;
    if ('open_date' in body) update.open_date = body.open_date || null;

    if ('lat' in body) {
      const lat = Number(body.lat);
      if (!Number.isFinite(lat)) return NextResponse.json({ error: 'lat must be a number' }, { status: 400 });
      update.lat = lat;
    }
    if ('lon' in body) {
      const lon = Number(body.lon);
      if (!Number.isFinite(lon)) return NextResponse.json({ error: 'lon must be a number' }, { status: 400 });
      update.lon = lon;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const supabase = adminClient();
    const { data, error } = await supabase
      .from('stores')
      .update(update)
      .eq('id', id)
      .select('id, name, town, open_date, lat, lon')
      .single();
    if (error) throw error;

    return NextResponse.json({ store: data });
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Delete a single store. The migration-057 AFTER DELETE trigger enqueues a 'store_delete'
// cache rebuild — the API must not fire a rebuild itself.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser();
    if (gate.error) return gate.error;

    const { id } = await params;
    const supabase = adminClient();
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error deleting store:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
