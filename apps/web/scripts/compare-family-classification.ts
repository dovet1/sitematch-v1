/** Grouped classification: grade each pilot family both ways and compare, writing nothing.
 *
 * For every development with a principal and at least one other application in the named councils,
 * grades it from the family input (planning-family-v1) and from the principal alone
 * (planning-stage1-v6), each twice, so both the difference between the two reads and the stability
 * of each can be seen. Results go to reports/; nothing is written to the database.
 *
 * Spends OpenRouter credit directly (about $0.0003-0.0005 per call) without a usage reservation,
 * so keep it to the pilot. The report states the total.
 *
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/compare-family-classification.ts --councils=south-norfolk-broadland,wandsworth [--limit=30]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { loadFamily } from '../src/lib/planning-intelligence/classify'
import { classifyFamilyWithOpenRouter, classifyWithOpenRouter } from '../src/lib/planning-intelligence/openrouter'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())
const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const councils = args.get('councils')?.split(',').filter(Boolean) ?? []
const limit = Number(args.get('limit') ?? 30)
if (!councils.length) throw new Error('--councils is required')
if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

type Reading = { relevance: string; creates: string; homes: number | null; summary: string; cost: number | null }

async function main() {
  const { data: developments, error } = await db.from('developments')
    .select('id,family_state,principal_application_id,planning_applications!developments_principal_application_id_fkey(id,reference,authority_slug,raw)')
    .in('family_state', ['family', 'awaiting_original']).not('principal_application_id', 'is', null)
  if (error) throw error
  const rows = ((developments ?? []) as unknown as Array<{ id: string; family_state: string; planning_applications: { id: string; reference: string; authority_slug: string; raw: PlotaApplication } | null }>)
    .filter(row => row.planning_applications && councils.includes(row.planning_applications.authority_slug))
    .slice(0, limit)

  const options = { apiKey: process.env.OPENROUTER_API_KEY! }
  const results: Record<string, unknown>[] = []
  let spent = 0
  for (const row of rows) {
    const principal = row.planning_applications!
    const family = await loadFamily(db as never, { id: principal.id, raw: principal.raw }, row.id)
    if (!family) continue
    const read = async (kind: 'family' | 'alone'): Promise<Reading> => {
      const result = kind === 'family'
        ? await classifyFamilyWithOpenRouter(family.input, options)
        : await classifyWithOpenRouter(principal.raw, options)
      spent += result.costUsd ?? 0
      const c = result.classification
      return { relevance: c.relevance, creates: c.commercialSpace.creates, homes: c.dwellings.count, summary: c.substantiveProposal, cost: result.costUsd }
    }
    const familyReads = [await read('family'), await read('family')]
    const aloneReads = [await read('alone'), await read('alone')]
    const same = (a: Reading, b: Reading) => a.relevance === b.relevance && a.creates === b.creates && a.homes === b.homes
    const entry = {
      council: principal.authority_slug, principal: principal.reference, familyState: row.family_state,
      changes: family.input.changes.map(change => `${change.reference} (${change.kind})`), paperwork: family.input.paperwork,
      family: familyReads[0], alone: aloneReads[0],
      differs: !same(familyReads[0], aloneReads[0]),
      familyStable: same(familyReads[0], familyReads[1]), aloneStable: same(aloneReads[0], aloneReads[1]),
    }
    results.push(entry)
    console.log(JSON.stringify({ principal: entry.principal, changes: entry.changes.length, family: `${entry.family.relevance}/${entry.family.creates}/${entry.family.homes}`, alone: `${entry.alone.relevance}/${entry.alone.creates}/${entry.alone.homes}`, differs: entry.differs, stable: entry.familyStable && entry.aloneStable }))
  }
  const summary = {
    families: results.length,
    differ: results.filter(r => r.differs).length,
    familyUnstable: results.filter(r => !r.familyStable).length,
    aloneUnstable: results.filter(r => !r.aloneStable).length,
    spentUsd: Number(spent.toFixed(4)),
  }
  mkdirSync('reports', { recursive: true })
  const file = `reports/family-classification-compare-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), councils, summary, results }, null, 2))
  console.log(JSON.stringify(summary), `\nwrote ${file}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
