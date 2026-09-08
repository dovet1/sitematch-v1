import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { buildAliasIndex, type BrandRow, type FasciaRow } from '@/lib/epc/aliases'
import { matchStore, type CandidateCert, type MatchStore } from '@/lib/epc/match'
import { deriveAdmissibleClasses, BASE_CLASSES } from '@/lib/epc/classes'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Gives newly imported stores a floor area.
 *
 * A store imported today carries no floor area and, before this existed, never would:
 * `store_floor_areas` was only ever written by a Python pipeline run by hand against
 * files on a laptop. This closes that gap for new stores; the quarterly full run remains
 * the source of truth and overwrites every row written here.
 *
 * Batched rather than exhaustive. The queue is derived (a store with no row has never
 * been attempted), so an unfinished batch is simply picked up by the next run — there is
 * no cursor to lose and nothing to reconcile. A cap keeps one run inside the function
 * timeout and one import from monopolising the matcher.
 */
const MATCHER_VERSION = 'epc-incremental-1'
const BATCH = 300

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase service credentials are not configured' }, { status: 500 })
  }

  const supabase = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: queue, error: queueError } = await supabase
    .rpc('epc_stores_awaiting_match', { p_limit: BATCH })
  if (queueError) {
    return NextResponse.json({ error: `queue: ${queueError.message}` }, { status: 500 })
  }
  const stores = (queue ?? []) as (MatchStore & { postcode: string; attempts: number })[]
  if (stores.length === 0) {
    return NextResponse.json({ success: true, considered: 0, message: 'nothing awaiting match' })
  }

  const { data: run, error: runError } = await supabase
    .from('epc_match_runs')
    .insert({ kind: 'incremental', matcher_version: MATCHER_VERSION, status: 'running' })
    .select('id')
    .single()
  if (runError || !run) {
    return NextResponse.json({ error: `run: ${runError?.message}` }, { status: 500 })
  }

  const counts = { high: 0, medium: 0, low: 0, none: 0, errored: 0 }
  try {
    const [brands, fascias] = await Promise.all([
      pageAll<BrandRow>(supabase, 'brands', 'id,name'),
      pageAll<FasciaRow>(supabase, 'fascias', 'id,name,brand_id'),
    ])
    const idx = buildAliasIndex(brands, fascias)

    const brandIds = Array.from(new Set(stores.map((s) => s.brand_id).filter(Boolean)))
    const admissible = await learnedClasses(supabase, brandIds)

    // Certificates for the whole batch in one pass rather than a request per store: a
    // busy postcode carries dozens of certificates and 300 sequential lookups would not
    // fit the function timeout.
    const postcodes = Array.from(new Set(stores.map((s) => norm(s.postcode))))
    const byPostcode = await certificatesFor(supabase, postcodes)

    const rows = stores.map((s) => {
      try {
        const cands = byPostcode.get(norm(s.postcode)) ?? []
        const r = matchStore(s, cands, idx, admissible.get(s.brand_id) ?? new Set(BASE_CLASSES))
        counts[r.confidence] += 1
        return {
          ...r,
          measurement_basis: 'gross_internal_area',
          matcher_version: MATCHER_VERSION,
          computed_at: new Date().toISOString(),
          match_attempts: (s.attempts ?? 0) + 1,
          last_error: null,
        }
      } catch (e) {
        counts.errored += 1
        // A store that breaks the matcher still gets a row, or the derived queue would
        // hand it back forever with nothing recording why.
        return {
          store_id: s.id, confidence: 'none' as const, match_method: 'none' as const,
          source: null, certificate_number: null, certificate_date: null,
          property_type: null, property_class: null, uprn: null, floor_area_m2: null,
          address_corroboration: null, brand_on_certificate: null, foreign_operator: null,
          spatial_distance_m: null, candidate_count: null, certs_at_address: null,
          measurement_basis: 'gross_internal_area',
          matcher_version: MATCHER_VERSION,
          computed_at: new Date().toISOString(),
          match_attempts: (s.attempts ?? 0) + 1,
          last_error: e instanceof Error ? e.message : String(e),
        }
      }
    })

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase
        .from('store_floor_areas')
        .upsert(rows.slice(i, i + 500), { onConflict: 'store_id' })
      if (error) throw new Error(`upsert: ${error.message}`)
    }

    // Order matters and is not cosmetic: a concession match carries its host building's
    // area and inflates the very fascia median it would be judged against, so demotion
    // runs before the rebuild and iterates. demote_implausible_floor_area_matches()
    // rebuilds affected profiles itself between passes.
    const { error: demoteError } = await supabase.rpc('demote_implausible_floor_area_matches')
    if (demoteError) throw new Error(`demote: ${demoteError.message}`)

    const { error: rebuildError } = await supabase
      .rpc('rebuild_brand_floor_area_profiles', { p_brand_ids: brandIds })
    if (rebuildError) throw new Error(`rebuild: ${rebuildError.message}`)

    await supabase.from('epc_match_runs').update({
      status: 'complete',
      stores_considered: stores.length,
      matched_high: counts.high, matched_medium: counts.medium,
      matched_low: counts.low, matched_none: counts.none, errored: counts.errored,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id)

    return NextResponse.json({ success: true, considered: stores.length, ...counts })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await supabase.from('epc_match_runs').update({
      status: 'failed', error: message,
      stores_considered: stores.length,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id)
    console.error('[match-store-floor-areas]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Captured from a factory rather than written out: createClient is generic, and naming
// its instantiated type by hand ties this file to a supabase-js version.
function serviceClient(url: string, key: string) {
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
type Db = ReturnType<typeof serviceClient>

const norm = (pc: string) => (pc || '').toUpperCase().replace(/\s+/g, '')

async function pageAll<T>(
  supabase: Db, table: string, select: string
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...((data ?? []) as unknown as T[]))
    if (!data || data.length < 1000) return out
  }
}

/** Certificates for a set of postcodes, chunked because PostgREST puts `in` in the URL. */
async function certificatesFor(
  supabase: Db, postcodes: string[]
): Promise<Map<string, CandidateCert[]>> {
  const out = new Map<string, CandidateCert[]>()
  const COLS = 'postcode_norm,source,certificate_number,tokens,units,numbers,house_numbers,' +
               'property_type,property_class,floor_area_m2,lodgement_date,uprn'
  for (let i = 0; i < postcodes.length; i += 100) {
    const chunk = postcodes.slice(i, i + 100)
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('epc_certificates').select(COLS)
        .in('postcode_norm', chunk).range(from, from + 999)
      if (error) throw new Error(`certificates: ${error.message}`)
      for (const r of (data ?? []) as unknown as (CandidateCert & { postcode_norm: string })[]) {
        const list = out.get(r.postcode_norm)
        if (list) list.push(r)
        else out.set(r.postcode_norm, [r])
      }
      if (!data || data.length < 1000) break
    }
  }
  return out
}

/** Fetches the observations and hands them to the shared rule in `classes.ts`. */
async function learnedClasses(
  supabase: Db, brandIds: string[]
): Promise<Map<string, Set<string>>> {
  if (brandIds.length === 0) return new Map()
  const rows: { brand_id: string; property_class: string | null }[] = []
  for (let i = 0; i < brandIds.length; i += 100) {
    const { data, error } = await supabase
      .from('store_floor_areas')
      .select('property_class,stores!inner(brand_id)')
      .eq('confidence', 'high')
      .in('stores.brand_id', brandIds.slice(i, i + 100))
    if (error) throw new Error(`classes: ${error.message}`)
    for (const r of (data ?? []) as unknown as
         { property_class: string | null; stores: { brand_id: string } | { brand_id: string }[] }[]) {
      const brand = Array.isArray(r.stores) ? r.stores[0]?.brand_id : r.stores?.brand_id
      if (brand) rows.push({ brand_id: brand, property_class: r.property_class })
    }
  }
  return deriveAdmissibleClasses(rows)
}
