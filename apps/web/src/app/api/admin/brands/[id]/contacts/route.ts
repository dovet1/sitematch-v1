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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser();
    if (gate.error) return gate.error;

    const { id } = await params;
    const supabase = adminClient();
    const { data, error } = await supabase
      .from('brand_contacts')
      .select(
        'id, contact_name, contact_title, contact_email, contact_phone, contact_area, contact_kind, contact_org, headshot_url, linkedin_url, is_primary_contact'
      )
      .eq('brand_id', id)
      .order('is_primary_contact', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ contacts: data || [] });
  } catch (error) {
    console.error('Error listing brand contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// Atomic replace of the brand's whole contact set via the save_brand_contacts RPC.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdminUser();
    if (gate.error) return gate.error;

    const { id } = await params;
    const body = await request.json();
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];

    const supabase = adminClient();
    const { error } = await supabase.rpc('save_brand_contacts', {
      p_brand_id: id,
      p_contacts: contacts,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving brand contacts:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
