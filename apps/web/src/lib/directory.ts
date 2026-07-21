// Shared server-side helpers for the Company Directory (/sitematcher-unified, directory mode).
//
// ACCESS MODEL: the directory is Plus-only. sitematcher-unified/layout.tsx gates the page,
// but the API routes are separately reachable, so every /api/public/directory/* route calls
// requirePlusAccess() itself. The four directory tables carry NO public SELECT policy — reads
// only ever happen here, through a service-role client, behind that gate.
//
// Note this is checkPlusAccess (Plus tier specifically), NOT checkSubscriptionAccess, which
// returns true for any paid or trialing subscription and would silently widen access.

import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase'
import { checkPlusAccess } from '@/lib/gapfinder-access'

// Result-set caps. Every list endpoint reports truncation explicitly rather than silently
// returning a prefix — the client filters search over the loaded list, so it cannot find a
// record the cap omitted and must be able to say so.
export const BRAND_CARD_CAP = 1000
export const IN_HOUSE_CAP = 2000
export const AGENT_CAP = 500

type Gate = { error: NextResponse } | { error: null; userId: string }

export async function requirePlusAccess(): Promise<Gate> {
  const authClient = await createServerClient()
  const {
    data: { user },
  } = await authClient.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!(await checkPlusAccess(user.id))) {
    return { error: NextResponse.json({ error: 'Plus subscription required' }, { status: 403 }) }
  }
  return { error: null, userId: user.id }
}

// Service-role client for directory reads.
//
// Returned deliberately untyped. The hand-written `Database` interface in lib/supabase.ts
// does not satisfy postgrest-js's `GenericSchema`: `GenericTable` requires a `Relationships`
// key that none of its tables declare, so `Database['public']` fails the constraint and every
// `.from()` on a `SupabaseClient<Database>` resolves to `never`. That is pre-existing and
// repo-wide — it is why the newer admin routes use their own untyped `createClient()`.
//
// Rather than pretend otherwise, directory routes type their results explicitly at the query
// boundary (see the Row interfaces in each route). The `Database` entries for the directory
// tables are still maintained so they are correct whenever the interface is repaired.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function directoryAdminClient(): any {
  return createAdminClient()
}

// The deterministic "the active requirement" pick, used by both the profile endpoint and
// the grid. `requirements.brand_id` is not unique and several rows can be active at once;
// without a stable ordering the same brand flips between requirements across requests.
// Backed by idx_requirements_brand_active_pick, whose column list matches this exactly.
export const ACTIVE_REQUIREMENT_ORDER = [
  { column: 'verified_at', ascending: false, nullsFirst: false },
  { column: 'updated_at', ascending: false, nullsFirst: false },
  { column: 'id', ascending: true, nullsFirst: false },
] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyActiveRequirementOrder(query: any) {
  for (const o of ACTIVE_REQUIREMENT_ORDER) {
    query = query.order(o.column, { ascending: o.ascending, nullsFirst: o.nullsFirst })
  }
  return query
}

// Pure payload transforms live in their own module so they stay unit-testable.
export * from './directory-transforms'
