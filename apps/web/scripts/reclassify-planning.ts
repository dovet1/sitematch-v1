/**
 * Re-run the classifier over the intelligence tier under the current prompt.
 *
 * Deliberately NOT done by enabling `PLANNING_CLASSIFICATION_ENABLED` and calling the cron
 * route. The standing rule for this subsystem is never to turn a flag on and walk away, and
 * the safest way to honour that is not to turn it on at all: this calls the same library
 * function the worker calls, once, and exits.
 *
 * It resets `classification_state` to `queued` first, because the queue selects only
 * queued | failed | deferred_budget and every record is currently `classified`.
 *
 * Previous runs are preserved: `planning_classification_runs` is keyed on prompt_version
 * among other things, so a new prompt writes new rows beside the old ones rather than
 * overwriting them. `developments` rows ARE overwritten, which is the point.
 *
 * Run from apps/web:
 *   npx tsx scripts/reclassify-planning.ts            # dry run, changes nothing
 *   npx tsx scripts/reclassify-planning.ts --commit
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { classifyPlanningBatch } from '../src/lib/planning-intelligence/classify'
import { PLANNING_PROMPT_VERSION, DEFAULT_OPENROUTER_MODEL } from '../src/lib/planning-intelligence/openrouter'

loadEnvConfig(process.cwd())

async function main() {
  const commit = process.argv.includes('--commit')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: tier, error } = await db
    .from('planning_applications')
    .select('id,classification_state')
    .eq('intelligence_tier', true)
  if (error) throw error

  // Human-approved evidence must survive. persistClassification only deletes rows still
  // `pending`, but a reviewed development row would still have its summary and relevance
  // overwritten, so refuse rather than quietly discard someone's work.
  const { data: reviewed } = await db
    .from('developments').select('id').neq('review_state', 'pending')
  if ((reviewed ?? []).length > 0) {
    throw new Error(`${reviewed!.length} development(s) have been human-reviewed; reclassifying would overwrite them. Resolve deliberately before running this.`)
  }

  console.log(`prompt   ${PLANNING_PROMPT_VERSION}`)
  console.log(`model    ${process.env.OPENROUTER_PLANNING_MODEL ?? DEFAULT_OPENROUTER_MODEL}`)
  console.log(`records  ${tier!.length} in the intelligence tier`)
  if (!commit) {
    console.log('\nDRY RUN — nothing changed. Re-run with --commit to reclassify.')
    return
  }

  const { error: resetError } = await db
    .from('planning_applications')
    .update({ classification_state: 'queued', classification_started_at: null })
    .eq('intelligence_tier', true)
  if (resetError) throw resetError
  console.log(`\nreset ${tier!.length} record(s) to queued`)

  let classified = 0, failed = 0, deferred = 0, rounds = 0
  for (;;) {
    const result = await classifyPlanningBatch({
      db, apiKey: process.env.OPENROUTER_API_KEY!, limit: 100,
    })
    rounds++
    classified += result.classified
    failed += result.failed
    deferred += result.deferredBudget
    console.log(`  round ${rounds}: considered ${result.considered}, classified ${result.classified}, failed ${result.failed}, deferred ${result.deferredBudget}`)
    // A budget refusal stops the whole queue by design, so retrying would spin.
    if (result.considered === 0 || result.deferredBudget > 0) break
    if (rounds > 10) { console.log('  stopping: more rounds than expected'); break }
  }
  console.log(`\nclassified ${classified}, failed ${failed}, deferred ${deferred}`)
  if (deferred > 0) console.log('DEFERRED means the budget ceiling was hit. Nothing is lost; re-run after raising it.')
}
main()
