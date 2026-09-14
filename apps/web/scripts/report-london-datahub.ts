/** How much the London Datahub adds to the checklist for our London tier applications.
 *
 * Samples intelligence-tier applications per borough (received 45–200 days ago, allowing for the
 * Datahub's lag), looks each up by exact borough and reference, and reports matches separately from
 * usable facts: a matched record that completes nothing is counted as such. Read-only: public GLA
 * guest API requests only (paced), no database writes, no model or Plota requests.
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/report-london-datahub.ts [--per-borough=10] [--boroughs=camden,wandsworth]
 */
import { writeFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { FACT_KEYS, findingsFromDescription, resolveFindings, type FactKey } from '../src/lib/planning-intelligence/facts'
import { DATAHUB_BOROUGHS, candidateFindingsFromDatahub, lookupDatahubApplication } from '../src/lib/planning-intelligence/london-datahub'

loadEnvConfig(process.cwd())
const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const PER_BOROUGH = Number(args.get('per-borough') ?? 10)
const boroughs = args.get('boroughs')?.split(',') ?? Object.keys(DATAHUB_BOROUGHS)
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type Outcome = Record<FactKey, 'found' | 'conflicting' | 'held_back' | 'absent'>

async function main() {
  const at = new Date().toISOString()
  const results: Array<{ borough: string; reference: string; description: string; matched: boolean; datahubId?: string; outcome?: Outcome; notes?: string[] }> = []
  for (const borough of boroughs) {
    const { data, error } = await db.from('planning_applications')
      .select('reference,description,commercial_work')
      .eq('authority_slug', borough).eq('intelligence_tier', true)
      .gte('date_received', daysAgo(200)).lte('date_received', daysAgo(45))
      .order('date_received', { ascending: false }).limit(60)
    if (error) throw error
    // Prefer commercial work, then take an even spread through the window.
    const rows = [...(data ?? [])].sort((a, b) => Number(Boolean(b.commercial_work)) - Number(Boolean(a.commercial_work)))
      .slice(0, PER_BOROUGH)
    for (const row of rows) {
      const record = await lookupDatahubApplication({ authoritySlug: borough, reference: row.reference })
      await pause(500)
      if (!record) {
        results.push({ borough, reference: row.reference, description: row.description ?? '', matched: false })
        continue
      }
      const described = findingsFromDescription(row.description, { councilUrl: null, at })
      const findings = candidateFindingsFromDatahub(record, at, {
        text: row.description,
        existing: described.existing_use_class.map(f => f.useClass!),
        proposed: described.proposed_use_class.map(f => f.useClass!),
      })
      const outcome = Object.fromEntries(FACT_KEYS.map(fact => {
        const resolved = resolveFindings(fact, findings[fact])
        return [fact, resolved?.state === 'found' ? 'found' : resolved?.state === 'conflicting' ? 'conflicting'
          : findings[fact].length > 0 ? 'held_back' : 'absent']
      })) as Outcome
      const notes = [...new Set(Object.values(findings).flat().map(f => f.note).filter((note): note is string => Boolean(note)))]
      results.push({ borough, reference: row.reference, description: row.description ?? '', matched: true, datahubId: record.id, outcome, notes })
    }
    const mine = results.filter(r => r.borough === borough)
    console.log(`${borough.padEnd(24)} matched ${mine.filter(r => r.matched).length}/${mine.length}`)
  }

  const matched = results.filter(r => r.matched)
  const perFact = Object.fromEntries(FACT_KEYS.filter(f => f !== 'operator').map(fact => [fact,
    ['found', 'conflicting', 'held_back', 'absent'].reduce((counts, state) => ({
      ...counts, [state]: matched.filter(r => r.outcome![fact] === state).length,
    }), {} as Record<string, number>),
  ]))
  const anyArea = matched.filter(r => ['existing_floorspace', 'proposed_floorspace', 'net_floorspace'].some(f => r.outcome![f as FactKey] === 'found')).length
  const noteCounts = matched.flatMap(r => r.notes ?? []).reduce<Record<string, number>>((counts, note) => ({ ...counts, [note]: (counts[note] ?? 0) + 1 }), {})
  const summary = {
    candidateOnly: true, publicationAllowed: false,
    at, perBorough: PER_BOROUGH, sampled: results.length, matched: matched.length,
    matchedWithAnyCommercialAreaFound: anyArea, perFact,
    byBorough: Object.fromEntries(boroughs.map(b => {
      const mine = results.filter(r => r.borough === b)
      return [b, { sampled: mine.length, matched: mine.filter(r => r.matched).length }]
    })),
    notes: Object.entries(noteCounts).sort((a, b) => b[1] - a[1]),
  }
  const file = `reports/london-datahub-${at.slice(0, 10)}.json`
  writeFileSync(file, JSON.stringify({ summary, results }, null, 2))
  console.log(JSON.stringify({ ...summary, byBorough: undefined }, null, 2), '\n', file)
}

main().catch(error => { console.error(error); process.exit(1) })
