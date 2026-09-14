/** Evaluate recovered Crawley evidence using the production budget ledger.
 * Writes an evaluation run, but does not alter queue state or reviewed product evidence.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { researchOperatorWithOpenRouter, DEFAULT_OPENROUTER_RESEARCH_MODEL, PLANNING_RESEARCH_PROMPT_VERSION, PLANNING_RESEARCH_SCHEMA_VERSION } from '../src/lib/planning-intelligence/research-openrouter'
import { configuredBudget, DEFAULT_RESEARCH_RESERVATION_USD, DEFAULT_MONTHLY_LLM_BUDGET_USD, DEFAULT_RESEARCH_STAGE_BUDGET_USD } from '../src/lib/planning-intelligence/budget'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'
loadEnvConfig(process.cwd())
async function main() {
  const reference = 'CR/2026/0416/FUL'
  if (!process.argv.includes('--commit')) { console.log(JSON.stringify({ reference, commit: false })); return }
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OpenRouter credentials are missing')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: app, error: appError } = await db.from('planning_applications').select('id,raw,input_hash').eq('reference', reference).single()
  if (appError) throw appError
  const { data: link, error: linkError } = await db.from('development_applications').select('development_id').eq('planning_application_id', app.id).single()
  if (linkError) throw linkError
  const report = JSON.parse(readFileSync('reports/planning-document-crawley-evidence.json', 'utf8'))
  const evidence = report.evidence.find((item: { reference: string }) => item.reference === reference)
  if (!evidence?.sources?.length) throw new Error('Recovered evidence is unavailable')
  const sources = evidence.sources.map((source: { url: string; title: string; text: string }) => ({ ...source, kind: 'document' as const }))
  const model = DEFAULT_OPENROUTER_RESEARCH_MODEL
  const reservation = configuredBudget('PLANNING_LLM_RESEARCH_RESERVATION_USD', DEFAULT_RESEARCH_RESERVATION_USD)
  // Insert rather than upsert: repeat execution must not silently overwrite the evaluation.
  const { data: run, error: runError } = await db.from('planning_classification_runs').insert({
    planning_application_id: app.id, development_id: link.development_id, stage: 'web', provider: 'openrouter', model,
    prompt_version: `${PLANNING_RESEARCH_PROMPT_VERSION}-crawley-evaluation`, schema_version: PLANNING_RESEARCH_SCHEMA_VERSION,
    input_hash: app.input_hash, status: 'running', started_at: new Date().toISOString(),
  }).select('id').single()
  if (runError) throw runError
  const { data: usageId, error: reserveError } = await db.rpc('reserve_planning_ai_usage', {
    p_planning_application_id: app.id, p_classification_run_id: run.id, p_stage: 'web', p_provider: 'openrouter', p_model: model,
    p_reserved_usd: reservation,
    p_monthly_budget_usd: configuredBudget('PLANNING_LLM_MONTHLY_BUDGET_USD', DEFAULT_MONTHLY_LLM_BUDGET_USD),
    p_stage_budget_usd: configuredBudget('PLANNING_LLM_RESEARCH_BUDGET_USD', DEFAULT_RESEARCH_STAGE_BUDGET_USD),
  })
  if (reserveError || !usageId) {
    await db.from('planning_classification_runs').update({ status: reserveError ? 'failed' : 'deferred_budget', finished_at: new Date().toISOString() }).eq('id', run.id)
    if (reserveError) throw reserveError
    console.log('Research budget refused the evaluation; no model call made.'); return
  }
  let actualCost = reservation
  try {
    const result = await researchOperatorWithOpenRouter({ application: app.raw as PlotaApplication, sources, apiKey, model, signal: AbortSignal.timeout(240000) })
    actualCost = result.costUsd ?? reservation
    const { error } = await db.from('planning_classification_runs').update({ status: 'complete', output: { ...result, evaluation: true }, cost_usd: actualCost, finished_at: new Date().toISOString() }).eq('id', run.id)
    if (error) throw error
    console.log(JSON.stringify({ reference, runId: run.id, result }, null, 2))
  } catch (error) {
    await db.from('planning_classification_runs').update({ status: 'failed', error: error instanceof Error ? error.message : String(error), cost_usd: actualCost, finished_at: new Date().toISOString() }).eq('id', run.id)
    throw error
  } finally {
    const { error } = await db.from('planning_ai_usage').update({ status: 'complete', actual_usd: actualCost }).eq('id', usageId)
    if (error) throw error
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
