// Shared admin-route guard and service-role client.
//
// Both were previously copy-pasted into each admin route (api/admin/brands/[id],
// .../brands/[id]/contacts, .../stores/[id]). The directory feature adds five more routes,
// which would have made eight independent copies of an auth check — the wrong thing to have
// duplicated. Existing call sites still declare their own; migrating them is a safe,
// mechanical follow-up.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCurrentUser } from '@/lib/auth';

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type AdminGate =
  | { error: NextResponse; user?: undefined }
  | { error?: undefined; user: { id: string; role: string } };

export async function requireAdminUser(): Promise<AdminGate> {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }
  return { user: { id: user.id, role: user.role } };
}

// Consistent 500 shape across admin routes.
export function adminError(context: string, error: unknown) {
  console.error(`${context}:`, error);
  return NextResponse.json(
    { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
    { status: 500 }
  );
}
