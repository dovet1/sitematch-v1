/** Development linking, step 5: verify merge, detach and the protections against the live database.
 *
 * Uses isolated, labelled synthetic fixtures (authority 'step5-verification', located at 0,0) and
 * removes every row it created in `finally`, as verify-planning-review.ts does. No provider or model
 * calls; no real application or Development is touched. Run after applying
 * 20261011000000_development_family_membership.sql.
 *
 * Checks the step's "done when":
 * - a condition submission arriving leaves the Development's description, relevance and figures
 *   unchanged;
 * - merge then detach restores every moved row, and a detached link is not recreated by relinking;
 * - a reviewed Development is refused, and paperwork alone may join one.
 *
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/verify-development-membership.ts
 */
import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(20000) }) },
})

const COUNCIL = 'step5-verification'
const run = randomUUID().slice(0, 8)
const marker = `STEP 5 VERIFICATION ${run}`
const ids = { original: randomUUID(), a: randomUUID(), b: randomUUID(), c: randomUUID() }
const linkIds = { a: randomUUID(), b: randomUUID(), c: randomUUID() }
const actor = 'script:verify-development-membership'
const checks: string[] = []

function check(ok: unknown, message: string) {
  if (!ok) throw new Error(`FAILED: ${message}`)
  checks.push(message)
  console.log(`ok: ${message}`)
}
async function ok<T>(request: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await request
  if (error) throw error
  return data as NonNullable<T>
}
const developmentOf = async (applicationId: string) =>
  (await ok(db.from('development_applications').select('development_id,role').eq('planning_application_id', applicationId).single())) as { development_id: string; role: string }
const development = async (id: string) =>
  (await ok(db.from('developments').select('*').eq('id', id).single())) as Record<string, unknown>

function application(id: string, reference: string, description: string, overrides: Record<string, unknown> = {}) {
  return {
    id, provider: 'plota', provider_id: `${marker} ${reference}`, authority_slug: COUNCIL, authority_name: 'Synthetic verification',
    reference: `${run}/${reference}`, description: `${marker}: ${description}`, raw: {}, input_hash: marker,
    address: `${marker} site`, location: 'SRID=4326;POINT(0 0)', location_provenance: 'source_exact',
    intelligence_tier: true, classification_state: 'not_eligible', eligibility_limbs: ['A'], ...overrides,
  }
}
function plan(targetDevelopmentId: string | null, principal: string | null, familyState: string, members: Array<[string, string, string[]]>, extra: Record<string, unknown> = {}) {
  return {
    targetDevelopmentId, headApplicationId: principal ?? members[0][0], principalApplicationId: principal, familyState,
    members: members.map(([applicationId, role, links]) => ({ applicationId, role, linkIds: links })),
    clearMachineGrade: false, queueClassification: [], admitByFamily: [], ...extra,
  }
}
async function refused(label: string, request: PromiseLike<{ error: unknown }>) {
  const { error } = await request
  check(error, label)
}

async function main() {
  const { error: preflight } = await db.from('developments').select('principal_application_id,family_state').limit(1)
  if (preflight) throw new Error(`Apply 20261011000000_development_family_membership.sql first: ${JSON.stringify(preflight)}`)

  // Three paperwork applications of one missing original, each given a Development by the trigger.
  await ok(db.from('planning_applications').insert([
    application(ids.a, 'COND1', 'Details of condition 9 of the warehouse permission', { procedure: 'discharge', date_received: '2026-04-01' }),
    application(ids.b, 'COND2', 'Discharge of condition 14 of the warehouse permission', { procedure: 'discharge', date_received: '2026-06-01' }),
    application(ids.c, 'NMA1', 'Non-material amendment to the warehouse permission', { procedure: 'amendment', date_received: '2026-09-01' }),
  ]))
  const devA = (await developmentOf(ids.a)).development_id
  const devB = (await developmentOf(ids.b)).development_id
  const devC = (await developmentOf(ids.c)).development_id
  check(new Set([devA, devB, devC]).size === 3, 'the trigger gives each tier application its own Development')
  await ok(db.from('developments').update({ relevance: 'high', summary: `${marker}: paperwork grade`, escalate_for_research: true, research_state: 'queued' }).in('id', [devA, devB, devC]))
  await ok(db.from('planning_application_links').insert([ids.a, ids.b, ids.c].map((child, index) => ({
    id: [linkIds.a, linkIds.b, linkIds.c][index], authority_slug: COUNCIL, child_application_id: child,
    parent_reference: `${run}/PERMISSION`, parent_key: `${run}/PERMISSION`, kind: 'condition', strength: 'strong', source: 'cited_reference',
  }))))

  await ok(db.rpc('planning_apply_family_plan', {
    p_plan: plan(devA, null, 'awaiting_original', [[ids.a, 'condition', [linkIds.a]], [ids.b, 'condition', [linkIds.b]], [ids.c, 'related', [linkIds.c]]], { clearMachineGrade: true }),
    p_actor: actor, p_reason: marker,
  }))
  check((await developmentOf(ids.b)).development_id === devA && (await developmentOf(ids.c)).development_id === devA, 'paperwork of one original shares one Development')
  const waiting = await development(devA)
  check(waiting.relevance === null && waiting.family_state === 'awaiting_original' && waiting.escalate_for_research === false, 'the paperwork grade is cleared while the original is missing')
  check((await development(devB)).merged_into_development_id === devA, 'an emptied Development is kept, marked merged')

  // The original arrives outside the tier and becomes principal.
  await ok(db.from('planning_applications').insert(application(ids.original, 'PERMISSION', 'Erection of a warehouse club', {
    intelligence_tier: false, eligibility_limbs: ['A'], address: `${marker} permission site`, stage: 'approved', date_decided: '2024-11-01',
  })))
  await ok(db.rpc('planning_apply_family_plan', {
    p_plan: plan(devA, ids.original, 'family', [[ids.original, 'principal', []]], { admitByFamily: [ids.original], queueClassification: [ids.original] }),
    p_actor: actor, p_reason: marker,
  }))
  const described = await development(devA)
  check(described.principal_application_id === ids.original && described.family_state === 'family' && described.lifecycle_stage === 'approved', 'the original becomes principal and describes the Development')
  const admitted = await ok(db.from('planning_applications').select('intelligence_tier,eligibility_limbs,classification_state').eq('id', ids.original).single()) as { intelligence_tier: boolean; eligibility_limbs: string[]; classification_state: string }
  check(admitted.intelligence_tier && admitted.eligibility_limbs.includes('F') && admitted.classification_state === 'queued', 'the original is admitted by family and queued for classification')
  // Keep the fixture out of the real classifier's queue.
  await ok(db.from('planning_applications').update({ classification_state: 'not_eligible' }).eq('id', ids.original))

  // Stand in for the principal's classification, then a condition changing stage and address.
  await ok(db.from('developments').update({ relevance: 'high', summary: `${marker}: warehouse club`, model_dwelling_count: 0 }).eq('id', devA))
  await ok(db.from('planning_applications').update({ stage: 'decided', address: `${marker} elsewhere` }).eq('id', ids.a))
  const after = await development(devA)
  check(after.relevance === 'high' && after.summary === `${marker}: warehouse club` && after.model_dwelling_count === 0
    && after.lifecycle_stage === 'approved' && after.site_address === `${marker} permission site`,
  'a condition submission changing leaves the description, relevance, figures, stage and address unchanged')

  // Detach restores, removes the joining link, and relinking cannot recreate it.
  await ok(db.rpc('planning_detach_application', { p_application_id: ids.b, p_actor: actor, p_reason: marker }))
  check((await developmentOf(ids.b)).development_id === devB, 'detach restores the previous Development')
  const restored = await development(devB)
  check(restored.merged_into_development_id === null && restored.relevance === 'high' && restored.research_state === 'queued', 'detach restores its grade and queue state')
  await ok(db.from('developments').update({ escalate_for_research: false, research_state: 'not_eligible' }).eq('id', devB))
  const link = await ok(db.from('planning_application_links').select('removed_at').eq('id', linkIds.b).single()) as { removed_at: string | null }
  check(link.removed_at !== null, 'the joining link is marked removed')
  await ok(db.from('planning_application_links').upsert({
    authority_slug: COUNCIL, child_application_id: ids.b, parent_reference: `${run}/PERMISSION`, parent_key: `${run}/PERMISSION`,
    kind: 'condition', strength: 'strong', source: 'cited_reference',
  }, { onConflict: 'child_application_id,parent_key,source', ignoreDuplicates: true }))
  const relinked = await ok(db.from('planning_application_links').select('removed_at').eq('child_application_id', ids.b)) as Array<{ removed_at: string | null }>
  check(relinked.length === 1 && relinked[0].removed_at !== null, 'relinking does not recreate a detached link')

  await refused('the principal cannot be detached', db.rpc('planning_detach_application', { p_application_id: ids.original, p_actor: actor, p_reason: marker }))

  // Protections.
  await ok(db.from('developments').update({ review_state: 'approved' }).eq('id', devB))
  await refused('a reviewed Development is never merged away', db.rpc('planning_apply_family_plan', {
    p_plan: plan(devA, ids.original, 'family', [[ids.b, 'condition', []]]), p_actor: actor, p_reason: marker,
  }))
  await ok(db.from('developments').update({ review_state: 'pending' }).eq('id', devB))
  await ok(db.from('developments').update({ review_state: 'approved' }).eq('id', devA))
  await refused('only paperwork may join a reviewed Development', db.rpc('planning_apply_family_plan', {
    p_plan: plan(devA, ids.original, 'family', [[ids.b, 'amendment', []]]), p_actor: actor, p_reason: marker,
  }))
  await ok(db.rpc('planning_apply_family_plan', {
    p_plan: plan(devA, ids.original, 'family', [[ids.b, 'condition', []]]), p_actor: actor, p_reason: marker,
  }))
  check((await developmentOf(ids.b)).development_id === devA, 'paperwork may join a reviewed Development')

  // The tab read carries roles and ranks paperwork last.
  const boundary = { type: 'Polygon', coordinates: [[[-0.0001, -0.0001], [0.0001, -0.0001], [0.0001, 0.0001], [-0.0001, 0.0001], [-0.0001, -0.0001]]] }
  const rows = await ok(db.rpc('planning_tab_applications_v4', { p_boundary: boundary, p_limit: 2000 })) as Array<{ id: string; development_role: string | null; sort_rank: number }>
  const fixtureIds: string[] = Object.values(ids)
  const ours = rows.filter(row => fixtureIds.includes(row.id))
  const lastScheme = Math.max(...ours.filter(row => !['condition', 'related'].includes(row.development_role ?? '')).map(row => row.sort_rank))
  const firstPaperwork = Math.min(...ours.filter(row => ['condition', 'related'].includes(row.development_role ?? '')).map(row => row.sort_rank))
  if (!(ours.some(row => row.development_role === 'principal') && firstPaperwork > lastScheme)) console.log(JSON.stringify(ours.map(row => ({ role: row.development_role, rank: row.sort_rank }))))
  check(ours.some(row => row.development_role === 'principal') && firstPaperwork > lastScheme, 'tab v4 returns roles and ranks paperwork after schemes')

  console.log(JSON.stringify({ passed: checks.length }))
}

async function cleanup() {
  const applicationIds = Object.values(ids)
  const { data: memberships } = await db.from('development_applications').select('development_id').in('planning_application_id', applicationIds)
  const { data: events } = await db.from('development_membership_events').select('development_id').in('planning_application_id', applicationIds)
  const developmentIds = [...new Set([...(memberships ?? []), ...(events ?? [])].map(row => row.development_id as string))]
  await db.from('planning_applications').delete().in('id', applicationIds)
  if (developmentIds.length) await db.from('developments').delete().in('id', developmentIds)
  const { count } = await db.from('planning_applications').select('id', { count: 'exact', head: true }).eq('authority_slug', COUNCIL)
  console.log(JSON.stringify({ cleanedDevelopments: developmentIds.length, remainingFixtureApplications: count }))
}

main()
  .catch(error => { console.error(error); process.exitCode = 1 })
  .finally(cleanup)
