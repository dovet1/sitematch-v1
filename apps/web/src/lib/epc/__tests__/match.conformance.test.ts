import { createClient } from '@supabase/supabase-js'
import { buildAliasIndex, type BrandRow, type FasciaRow } from '../aliases'
import { matchStore, type CandidateCert } from '../match'
import { deriveAdmissibleClasses, BASE_CLASSES } from '../classes'

/**
 * Does the TypeScript matcher reach the same conclusion as matchall.py?
 *
 * The Python has already matched all 43,070 stores and its answers are in
 * store_floor_areas. So the conformance test is simply: re-derive them here, from the
 * register now in the database, and compare. Nothing is written.
 *
 * Skipped without credentials. It reads them from EPC_CONFORMANCE_URL / _KEY rather
 * than the usual NEXT_PUBLIC_SUPABASE_URL, because jest.setup.ts pins that to localhost
 * so unit tests cannot reach a real database — which is right, and is why this one has
 * to ask for access explicitly:
 *
 *   EPC_CONFORMANCE_URL=... EPC_CONFORMANCE_KEY=... npx jest match.conformance
 *
 * Three exclusions, all principled rather than convenient:
 *   - spatial matches: the TS matcher deliberately has no spatial rule (see match.ts)
 *   - implausible rows: demoted after the fact by migration 20260908000000, which is the
 *     SQL function's job here, not the matcher's
 *   - Scotland: that register is not loaded on this machine
 */
const URL_ = process.env.EPC_CONFORMANCE_URL
const KEY = process.env.EPC_CONFORMANCE_KEY
const SAMPLE = 600

;(URL_ && KEY ? describe : describe.skip)('matcher agrees with matchall.py', () => {
  jest.setTimeout(180_000)

  it('reproduces the committed answer for real stores', async () => {
    const db = createClient(URL_!, KEY!, { auth: { persistSession: false } })

    const { data: committed, error: e1 } = await db
      .from('store_floor_areas')
      .select('store_id,certificate_number,match_method,confidence,brand_on_certificate,address_corroboration')
      .eq('source', 'epc_ew')
      .in('match_method', ['address', 'brand', 'postcode-single', 'postcode-ambiguous'])
      .neq('size_plausibility', 'implausible')
      .limit(SAMPLE)
    if (e1) throw new Error(e1.message)
    const rows = committed ?? []
    expect(rows.length).toBeGreaterThan(100)

    // Chunked at 50: PostgREST puts `in` in the URL and 600 uuids overflows the
    // request header. The production route chunks postcodes at 100 for the same reason;
    // uuids are five times longer, so the safe chunk is correspondingly smaller.
    const ids = rows.map((r) => r.store_id as string)
    const stores: Record<string, unknown>[] = []
    for (let i = 0; i < ids.length; i += 50) {
      const { data, error: e2 } = await db
        .from('stores')
        .select('id,brand_id,address_line_1,address_line_2,town,county,postcode')
        .in('id', ids.slice(i, i + 50))
      if (e2) throw new Error(e2.message)
      stores.push(...((data ?? []) as unknown as Record<string, unknown>[]))
    }
    const byId = new Map(stores.map((s) => [s.id as string, s]))

    const brands: BrandRow[] = []
    const fascias: FasciaRow[] = []
    for (let f = 0; ; f += 1000) {
      const { data } = await db.from('brands').select('id,name').range(f, f + 999)
      brands.push(...((data ?? []) as unknown as BrandRow[]))
      if (!data || data.length < 1000) break
    }
    for (let f = 0; ; f += 1000) {
      const { data } = await db.from('fascias').select('id,name,brand_id').range(f, f + 999)
      fascias.push(...((data ?? []) as unknown as FasciaRow[]))
      if (!data || data.length < 1000) break
    }
    const idx = buildAliasIndex(brands, fascias)

    const pcs = Array.from(new Set(
      stores.map((s) => ((s.postcode as string) || '').toUpperCase().replace(/\s+/g, ''))
    )).filter(Boolean)
    const certs = new Map<string, CandidateCert[]>()
    const COLS = 'postcode_norm,source,certificate_number,tokens,units,numbers,house_numbers,' +
                 'property_type,property_class,floor_area_m2,lodgement_date,uprn'
    for (let i = 0; i < pcs.length; i += 100) {
      const chunk = pcs.slice(i, i + 100)
      for (let f = 0; ; f += 1000) {
        const { data, error } = await db.from('epc_certificates').select(COLS)
          .in('postcode_norm', chunk).range(f, f + 999)
        if (error) throw new Error(error.message)
        for (const r of (data ?? []) as unknown as (CandidateCert & { postcode_norm: string })[]) {
          const l = certs.get(r.postcode_norm)
          if (l) l.push(r); else certs.set(r.postcode_norm, [r])
        }
        if (!data || data.length < 1000) break
      }
    }

    // The same admissible-class rule the cron uses, from the same module. Hardcoding
    // retail+food here would under-test the real path: it is exactly what admits a
    // Screwfix warehouse or a Premier Inn hotel certificate.
    const brandIds = Array.from(new Set(stores.map((s) => s.brand_id as string).filter(Boolean)))
    const obs: { brand_id: string; property_class: string | null }[] = []
    for (let i = 0; i < brandIds.length; i += 50) {
      const { data, error } = await db
        .from('store_floor_areas')
        .select('property_class,stores!inner(brand_id)')
        .eq('confidence', 'high')
        .in('stores.brand_id', brandIds.slice(i, i + 50))
      if (error) throw new Error(error.message)
      for (const r of (data ?? []) as unknown as
           { property_class: string | null; stores: { brand_id: string } | { brand_id: string }[] }[]) {
        const b = Array.isArray(r.stores) ? r.stores[0]?.brand_id : r.stores?.brand_id
        if (b) obs.push({ brand_id: b, property_class: r.property_class })
      }
    }
    const admissible = deriveAdmissibleClasses(obs)

    let compared = 0
    let sameCert = 0
    let sameMethod = 0
    let sameConfidence = 0
    const examples: string[] = []

    for (const r of rows) {
      const s = byId.get(r.store_id as string)
      if (!s) continue
      const pc = (s.postcode as string || '').toUpperCase().replace(/\s+/g, '')
      const got = matchStore(
        s as never,
        certs.get(pc) ?? [],
        idx,
        admissible.get(s.brand_id as string) ?? new Set(BASE_CLASSES)
      )
      compared++
      if (got.certificate_number === r.certificate_number) sameCert++
      else if (examples.length < 8) {
        examples.push(
          `${s.address_line_1} [${pc}] python=${r.match_method}/${r.certificate_number} ` +
          `ts=${got.match_method}/${got.certificate_number}`
        )
      }
      if (got.match_method === r.match_method) sameMethod++
      if (got.confidence === r.confidence) sameConfidence++
    }

    const pct = (n: number) => `${((100 * n) / compared).toFixed(1)}%`
    // eslint-disable-next-line no-console
    console.log(
      `\n  compared ${compared} stores against matchall.py\n` +
      `    same certificate : ${sameCert} (${pct(sameCert)})\n` +
      `    same method      : ${sameMethod} (${pct(sameMethod)})\n` +
      `    same confidence  : ${sameConfidence} (${pct(sameConfidence)})\n` +
      (examples.length ? `  divergences:\n    ${examples.join('\n    ')}\n` : '')
    )

    expect(compared).toBeGreaterThan(100)
    // Measured at 99.7% on 2026-09-07. The floor is set just below that rather than at
    // a comfortable 90%, which would wave through a regression as large as the one this
    // test caught while being written: passing retail+food instead of the brand's
    // learned classes scored 91.2%, and looked healthy against a 90% bar.
    //
    // Exact parity is not expected and should not be demanded. The TS matcher reads
    // admissible classes back from committed output rather than relearning them, and has
    // no spatial rule, so a handful of stores will always differ.
    expect(sameCert / compared).toBeGreaterThan(0.98)
    expect(sameConfidence / compared).toBeGreaterThan(0.98)
  })
})
