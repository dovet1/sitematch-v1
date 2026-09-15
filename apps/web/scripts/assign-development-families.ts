/** Development linking, step 5: put each family's applications in one Development.
 *
 * Plans every family in the named councils from stored links (development-membership.ts), prints and
 * writes a report, and with --commit applies each family through `planning_apply_family_plan`, one
 * transaction per family. No provider or model calls. A plan queues the principal for
 * classification when it must describe its Development; the report counts those first.
 *
 * The report lists:
 * - families grouped, and the Development each lands in;
 * - families awaiting their original, with the state of that original's Plota lookup (a failed or
 *   missing lookup is listed for review, never left silently ungraded);
 * - families held for review, with the reason;
 * - classifications a commit would queue.
 *
 * --only=family (or awaiting_original) limits what is applied to plans of that family state; the
 * report still shows every family. Families whose original is stored do not depend on a Plota lookup,
 * so they can be applied before the lookups run.
 *
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/assign-development-families.ts --councils=broadland,wandsworth,glasgow [--only=family] [--commit]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { FamilyPlan } from '../src/lib/planning-intelligence/development-membership'
import { prioritiseFamilyLookups } from '../src/lib/planning-intelligence/family-priority'
import { applyFamilyPlans, planCouncilMemberships } from '../src/lib/planning-intelligence/membership-ingest'

loadEnvConfig(process.cwd())

const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const commit = args.has('commit')
const councils = args.get('councils')?.split(',').filter(Boolean) ?? []
if (councils.length === 0) throw new Error('--councils is required; step 5 runs council by council')
const only = args.get('only')
if (only && only !== 'family' && only !== 'awaiting_original') throw new Error('--only must be family or awaiting_original')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) },
})

async function main() {
  const report: Record<string, unknown>[] = []
  for (const council of councils) {
    const { input, plans } = await planCouncilMemberships(db as never, council)
    const reference = new Map(input.applications.map(application => [application.id, application.reference]))
    const refs = (ids: string[]) => ids.map(id => reference.get(id) ?? id)

    const { data: lookups, error } = await db.from('planning_family_lookups')
      .select('parent_key,status,last_error').eq('authority_slug', council)
    if (error) throw error
    const lookupFor = new Map((lookups ?? []).map(row => [row.parent_key as string, row]))

    const describe = (plan: FamilyPlan) => {
      if (plan.action === 'hold') return { family: plan.familyKey, reason: plan.reason, detail: plan.detail, applications: refs(plan.applicationIds) }
      if (plan.action === 'unchanged') return { family: plan.familyKey, applications: refs(plan.applicationIds) }
      return {
        family: plan.familyKey,
        development: plan.targetDevelopmentId ?? 'new',
        principal: plan.principalApplicationId ? reference.get(plan.principalApplicationId) : null,
        familyState: plan.familyState,
        members: plan.members.map(member => `${reference.get(member.applicationId)} (${member.role})`),
        clearsPaperworkGrade: plan.clearMachineGrade,
        queuesClassification: refs(plan.queueClassification),
        admitsByFamily: refs(plan.admitByFamily),
        originalLookups: plan.familyState === 'awaiting_original'
          ? plan.missingParentKeys.map(key => ({ key, status: lookupFor.get(key)?.status ?? 'not queued', error: lookupFor.get(key)?.last_error ?? null }))
          : [],
      }
    }
    const applies = plans.filter((plan): plan is Extract<FamilyPlan, { action: 'apply' }> => plan.action === 'apply')
    const awaiting = applies.filter(plan => plan.familyState === 'awaiting_original')
    const lookupProblems = awaiting.filter(plan => plan.missingParentKeys.some(key => !['queued', 'deferred', 'processing'].includes(lookupFor.get(key)?.status ?? 'missing')))

    const selected = applies.filter(plan => !only || plan.familyState === only)
    const summary = {
      council,
      only: only ?? null,
      selectedToApply: selected.length,
      selectedClassificationsQueued: selected.reduce((total, plan) => total + plan.queueClassification.length, 0),
      selectedPaperworkGradesCleared: selected.filter(plan => plan.clearMachineGrade).length,
      families: plans.length,
      toApply: applies.length,
      unchanged: plans.filter(plan => plan.action === 'unchanged').length,
      heldForReview: plans.filter(plan => plan.action === 'hold').length,
      awaitingOriginal: awaiting.length,
      awaitingOriginalWithLookupProblem: lookupProblems.length,
      classificationsQueued: applies.reduce((total, plan) => total + plan.queueClassification.length, 0),
      paperworkGradesCleared: applies.filter(plan => plan.clearMachineGrade).length,
    }
    console.log(JSON.stringify(summary))

    let applied: Awaited<ReturnType<typeof applyFamilyPlans>> | null = null
    if (commit) {
      applied = await applyFamilyPlans(db as never, selected, { actor: 'script:assign-development-families', reason: 'step 5 pilot assignment' })
      if (applied.awaitingOriginal > 0) await prioritiseFamilyLookups(db as never, [council])
      console.log(JSON.stringify({ council, applied }))
    }

    report.push({
      ...summary,
      applied,
      apply: applies.map(describe),
      selected: selected.map(plan => plan.familyKey),
      heldForReview: plans.filter(plan => plan.action === 'hold').map(describe),
      awaitingOriginalWithLookupProblem: lookupProblems.map(describe),
    })
  }

  mkdirSync('reports', { recursive: true })
  const file = `reports/development-families-${commit ? 'commit' : 'dry-run'}-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), commit, councils: report }, null, 2))
  console.log(`wrote ${file}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
