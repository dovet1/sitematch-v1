/** Development linking, step 3: seed linking data for applications already stored.
 *
 * Per council: write each application's linking keys, build the council's link profile, store the
 * link evidence the linker finds, and request lookups for missing families. Nothing here changes
 * Development membership, classification or the planning tab, and no Plota or model requests are
 * made. Existing links are never overwritten, so a removed link stays removed.
 *
 * Needs migration 20261007000000_planning_application_links.sql. Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/seed-planning-links.ts [--councils=a,b] [--after=slug] [--commit]
 * Dry-run by default. Re-run to refresh profiles after the store grows; it is idempotent.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { referenceKeys, type StoredApplication } from '../src/lib/planning-intelligence/link-ingest'
import { buildCouncilLinkProfile, familyKey, linksForApplication, resolverFor } from '../src/lib/planning-intelligence/linking'

loadEnvConfig(process.cwd())

const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const commit = args.has('commit')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) }) },
})

async function retry<T>(label: string, run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await run()
    if (!error) return data
    if (attempt >= 4) throw new Error(`${label}: ${JSON.stringify(error)}`)
    await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
  }
}

type Row = StoredApplication & { reference_normalised: string | null; reference_core: string | null }

async function councilRows(council: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const page = (await retry(`${council}@${from}`, () => db.from('planning_applications')
      // A dry run works before the migration is applied; the key columns only exist after it.
      .select(`id,authority_slug,reference,description,procedure,address,postcode,uprn${commit ? ',reference_normalised,reference_core' : ''}`)
      .eq('authority_slug', council).order('id').range(from, from + 999))) as unknown as Row[]
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function main() {
  let councils = args.get('councils')?.split(',')
    ?? ((await retry('councils', () => db.from('planning_authority_coverage').select('authority_slug').order('authority_slug'))) as Array<{ authority_slug: string }>)
      .map(row => row.authority_slug)
  const after = args.get('after')
  if (after) councils = councils.filter(council => council > after)

  const totals = { councils: 0, applications: 0, keysToWrite: 0, keysWritten: 0, links: 0, strongLinks: 0, resolved: 0, missingFamilies: 0, lookupsRequested: 0 }
  for (const council of councils) {
    const rows = await councilRows(council)
    totals.councils++
    totals.applications += rows.length

    const keyUpdates = rows.map(row => ({ id: row.id, ...referenceKeys(row.reference), before: row }))
      .filter(update => update.reference_normalised !== (update.before.reference_normalised ?? null) || update.reference_core !== (update.before.reference_core ?? null))
      .map(({ before: _before, ...update }) => update)
    totals.keysToWrite += keyUpdates.length

    const profile = buildCouncilLinkProfile(rows)
    const resolver = resolverFor(rows)
    const seen = new Set<string>()
    const linkRows: Array<Record<string, unknown>> = []
    const families = new Map<string, { authority_slug: string; parent_key: string; parent_reference: string }>()
    for (const row of rows) {
      for (const link of linksForApplication(row, profile, resolver)) {
        const parentKey = familyKey(link.parentReference)
        const key = `${link.childId}|${parentKey}|${link.source}`
        if (seen.has(key)) continue
        seen.add(key)
        linkRows.push({
          authority_slug: council, child_application_id: link.childId, parent_application_id: link.parentId,
          parent_reference: link.parentReference, parent_key: parentKey, kind: link.kind,
          strength: link.strength, source: link.source, evidence: link.evidence,
        })
        if (link.strength !== 'strong') continue
        totals.strongLinks++
        if (link.parentId) { totals.resolved++; continue }
        const existing = families.get(parentKey)
        if (!existing || existing.parent_reference.length < link.parentReference.length) {
          families.set(parentKey, { authority_slug: council, parent_key: parentKey, parent_reference: link.parentReference })
        }
      }
    }
    totals.links += linkRows.length
    totals.missingFamilies += families.size

    if (commit) {
      for (const batch of chunks(keyUpdates, 1000)) {
        totals.keysWritten += Number(await retry(`${council} keys`, () => db.rpc('planning_set_reference_keys', { p_rows: batch }))) || 0
      }
      await retry(`${council} profile`, () => db.from('planning_council_link_profiles').upsert({
        authority_slug: council, reference_shapes: [...profile.shapes], reusing_suffix_families: [...profile.reusingFamilies],
        application_count: rows.length, computed_at: new Date().toISOString(),
      }, { onConflict: 'authority_slug' }))
      for (const batch of chunks(linkRows, 500)) {
        await retry(`${council} links`, () => db.from('planning_application_links')
          .upsert(batch, { onConflict: 'child_application_id,parent_key,source', ignoreDuplicates: true }))
      }
      // After the links, so each request counts the follow-ons now stored against it.
      for (const batch of chunks([...families.values()], 500)) {
        totals.lookupsRequested += Number(await retry(`${council} lookups`, () => db.rpc('planning_request_family_lookups', { p_rows: batch }))) || 0
      }
    }
    console.log(JSON.stringify({ commit, council, applications: rows.length, keysToWrite: keyUpdates.length, links: linkRows.length,
      missingFamilies: families.size, reusingFamilies: [...profile.reusingFamilies] }))
  }
  console.log(JSON.stringify({ commit, ...totals }, null, 2))
}

main().catch(error => { console.error(error); process.exitCode = 1 })
