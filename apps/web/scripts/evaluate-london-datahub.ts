/** Read-only, frozen London Datahub evaluation. No database, Plota or model calls.
 * Run from apps/web with tsx scripts/evaluate-london-datahub.ts OUTPUT_DIRECTORY.
 * The directory must be new: never overwrite a reviewed sample or its predictions.
 * This deliberately oversamples completed floorspace; it is not a coverage estimate.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FACT_KEYS, findingsFromDescription, resolveFindings } from '../src/lib/planning-intelligence/facts'
import { DATAHUB_BOROUGHS, candidateFindingsFromDatahub, isCommercialClass, datahubUseClass, type DatahubApplication } from '../src/lib/planning-intelligence/london-datahub'

const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const seed = 'london-unseen-2026-09-14-v1'
const at = '2026-09-14T00:00:00Z'
async function main() {
  const output = process.argv[2]
  if (!output) throw new Error('Supply a new output directory')
  mkdirSync(output) // exclusive; preserve earlier evaluations
  const adapter = readFileSync('src/lib/planning-intelligence/london-datahub.ts', 'utf8')
  const factCode = readFileSync('src/lib/planning-intelligence/facts.ts', 'utf8')
  const known = JSON.parse(readFileSync('reports/london-datahub-2026-09-14.json', 'utf8'))
  const fixture = JSON.parse(readFileSync('src/lib/planning-intelligence/__tests__/fixtures/london-datahub-2026-09-14.json', 'utf8'))
  const excluded = new Set<string>([...known.results.map((r: any) => r.datahubId).filter(Boolean), ...Object.keys(fixture.records)])
  const pool: Array<{ borough: string; record: DatahubApplication; findings: ReturnType<typeof candidateFindingsFromDatahub>; outcomes: Record<string, unknown>; floor: boolean }> = []
  for (const [borough, name] of Object.entries(DATAHUB_BOROUGHS)) {
    const response = await fetch('https://planningdata.london.gov.uk/api-guest/applications/_search', {
      method: 'POST', headers: { 'X-API-AllowRequest': 'be2rmRnt&', 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 100, sort: [{ valid_date: 'desc' }], query: { bool: { filter: [
        { term: { 'lpa_name.raw': name } },
        { range: { valid_date: { gte: '01/08/2026', lte: '14/09/2026', format: 'dd/MM/yyyy' } } },
      ] } }, _source: ['id', 'lpa_name', 'lpa_app_no', 'description', 'application_type_full', 'last_updated', 'valid_date', 'url_planning_app', 'application_details.existing_proposed_floorspace_details', 'application_details.site_area', 'application_details.non_residential_details'] }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(`${borough}: ${response.status} ${await response.text()}`)
    const data = await response.json()
    for (const hit of data.hits.hits) {
      const record: DatahubApplication = hit._source
      if (excluded.has(record.id)) continue
      if (!record.application_details?.existing_proposed_floorspace_details?.some(r => isCommercialClass(datahubUseClass(r.use_class) ?? ''))) continue
      const described = findingsFromDescription(record.description, { councilUrl: null, at })
      const findings = candidateFindingsFromDatahub(record, at, { text: record.description,
        existing: described.existing_use_class.map(f => f.useClass!), proposed: described.proposed_use_class.map(f => f.useClass!) })
      const outcomes = Object.fromEntries(FACT_KEYS.map(f => [f, resolveFindings(f, findings[f])]))
      const floor = ['existing_floorspace', 'proposed_floorspace', 'net_floorspace'].some(f => (outcomes[f] as any)?.state === 'found')
      pool.push({ borough, record, findings, outcomes, floor })
    }
    console.log(`${borough}: pool ${pool.length}`)
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  const ordered = pool.sort((a, b) => hash(seed + a.record.id).localeCompare(hash(seed + b.record.id)))
  const selected: typeof pool = []
  for (const [floor, count] of [[true, 30], [false, 10]] as const) {
    const perBorough = new Map<string, number>()
    for (const candidate of ordered.filter(r => r.floor === floor)) {
      if ((perBorough.get(candidate.borough) ?? 0) >= 3) continue
      selected.push(candidate)
      perBorough.set(candidate.borough, (perBorough.get(candidate.borough) ?? 0) + 1)
      if (selected.filter(r => r.floor === floor).length === count) break
    }
  }
  if (selected.length !== 40) throw new Error(`Insufficient pool: ${selected.length}/40`)
  writeFileSync(join(output, 'frozen-adapter.ts.txt'), adapter)
  writeFileSync(join(output, 'frozen-facts.ts.txt'), factCode)
  writeFileSync(join(output, 'sample.json'), JSON.stringify({ methodology: { seed, at, adapterSha256: hash(adapter), factsSha256: hash(factCode), excluded: [...excluded], poolSize: pool.length, limitation: 'Recent public London records with commercial-class rows, not a random sample of our eligible developments. No independent application-form verification yet. Selection fixed before human labels.' }, selected }, null, 2))
  console.log(`Saved ${selected.length} records; ${selected.filter(r => r.floor).length} complete floor facts`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
