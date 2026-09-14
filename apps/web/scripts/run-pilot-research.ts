/** Pilot completion plan: research named developments once and report their checklist.
 *
 * Dry-run by default: prints each development's current state. With --commit it queues the named
 * developments (only if research has not already finished or started), researches exactly those,
 * and reports each fact's state, reason and value, with the cost. The research budget ledger
 * applies as normal. Needs migration 20261009000000_planning_development_facts.sql.
 *
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/run-pilot-research.ts --developments=id1,id2 [--commit]
 */
import { writeFileSync } from 'fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { FACT_KEYS } from '../src/lib/planning-intelligence/facts'
import { researchPlanningBatch, RESEARCH_ATTEMPT_LIMIT } from '../src/lib/planning-intelligence/research'

loadEnvConfig(process.cwd())

const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const ids = (args.get('developments') ?? '').split(',').filter(Boolean)
const commit = args.has('commit')

async function main() {
  if (ids.length === 0 || ids.length > 10) throw new Error('Name between 1 and 10 developments with --developments=')
  const apiKey = process.env.OPENROUTER_API_KEY
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: before, error } = await db.from('developments')
    .select('id,canonical_name,relevance,escalate_for_research,research_state,research_attempts,research_outcome')
    .in('id', ids)
  if (error) throw error
  console.log(JSON.stringify({ commit, developments: before }, null, 2))
  if ((before ?? []).length !== ids.length) throw new Error('Some developments were not found')
  if (!commit) return
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured')

  const startedAt = new Date().toISOString()
  const { error: queueError } = await db.from('developments')
    .update({ escalate_for_research: true, research_state: 'queued', research_started_at: null })
    .in('id', ids)
    .in('research_state', ['not_eligible', 'queued', 'failed', 'deferred_budget'])
  if (queueError) throw queueError

  // The batch stops at a failure so it never pays twice in one call; keep calling until every named
  // development has finished or used its attempts.
  const results = []
  for (let pass = 0; pass < ids.length * RESEARCH_ATTEMPT_LIMIT; pass++) {
    const result = await researchPlanningBatch({ db: db as never, apiKey, limit: ids.length, developmentIds: ids })
    results.push(result)
    console.log(JSON.stringify({ pass, result }))
    if (result.considered === 0 || result.deferredBudget > 0) break
  }

  const [{ data: after }, { data: facts }, { data: runs }] = await Promise.all([
    db.from('developments').select('id,canonical_name,research_state,research_attempts,research_outcome').in('id', ids),
    db.from('development_facts').select('development_id,fact,state,reason,value,findings').in('development_id', ids),
    db.from('planning_classification_runs').select('development_id,status,cost_usd,error').eq('stage', 'web').gte('started_at', startedAt).in('development_id', ids),
  ])
  const report = (after ?? []).map(development => ({
    ...development,
    costUsd: (runs ?? []).filter(run => run.development_id === development.id).reduce((sum, run) => sum + Number(run.cost_usd ?? 0), 0),
    errors: (runs ?? []).filter(run => run.development_id === development.id && run.error).map(run => run.error),
    facts: Object.fromEntries(FACT_KEYS.map(fact => {
      const row = (facts ?? []).find(item => item.development_id === development.id && item.fact === fact)
      return [fact, row ? { state: row.state, reason: row.reason, value: row.value, findings: (row.findings as unknown[]).length } : null]
    })),
  }))
  const file = `reports/pilot-research-${startedAt.slice(0, 19).replace(/:/g, '')}.json`
  writeFileSync(file, JSON.stringify({ startedAt, results, report }, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(`wrote ${file}`)
}

main().catch(error => { console.error(error); process.exit(1) })
