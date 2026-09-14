/** Add use classes stated in each application description to already-researched developments.
 *
 * No model or Plota requests and no research attempt is recorded; findings merge into the stored
 * checklist and states are recomputed (admin decisions untouched). Research runs from 15 Sep 2026
 * include these findings themselves. Dry-run by default.
 *
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/apply-description-facts.ts --developments=id1,id2 [--commit]
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { findingsFromDescription, refreshFactRows, type FactRow } from '../src/lib/planning-intelligence/facts'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())
const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const ids = (args.get('developments') ?? '').split(',').filter(Boolean)
const commit = args.has('commit')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  for (const id of ids) {
    const { data: head, error } = await db.from('development_applications')
      .select('planning_applications(reference,raw)').eq('development_id', id).in('role', ['primary', 'principal']).limit(1).single()
    if (error) throw error
    const application = (head as unknown as { planning_applications: { reference: string; raw: PlotaApplication } }).planning_applications
    const { data: stored, error: factsError } = await db.from('development_facts')
      .select('fact,state,reason,value,findings,attempts,decided_by,decided_at').eq('development_id', id)
    if (factsError) throw factsError
    const at = new Date().toISOString()
    const incoming = findingsFromDescription(application.raw.description, { councilUrl: application.raw.links?.council ?? null, at })
    const rows = refreshFactRows((stored ?? []) as FactRow[], incoming)
    const changed = rows.filter(row => ['existing_use_class', 'proposed_use_class'].includes(row.fact))
      .map(row => ({ fact: row.fact, state: row.state, value: row.value, descriptionFindings: incoming[row.fact as 'existing_use_class'].map(f => f.useClass) }))
    console.log(JSON.stringify({ development: id, reference: application.reference, changed }))
    if (!commit) continue
    const { error: writeError } = await db.rpc('planning_record_development_facts', { p_development_id: id, p_rows: rows })
    if (writeError) throw writeError
  }
}
main().catch(error => { console.error(error); process.exit(1) })
