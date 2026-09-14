/** Pilot completion plan, step 1: group one family into a single development for the pilot.
 *
 * Plans the family with the same rules as the grouped assessment count (assessment-groups.ts) from
 * stored applications only, then moves significant amendments (role 'amendment') and paperwork
 * (role 'condition' or 'related') into the head application's development. Evidence rows follow
 * their application. A development left with no applications keeps its record for undo but has its
 * relevance cleared, so it drops out of the review queue and the planning tab; its machine answer
 * remains in the classification run.
 *
 * Refuses any development a person has reviewed, any with admin-decided facts, and any whose
 * research has started. The step-5 merge with transactional detach is still unfinished; this
 * script writes an undo file instead. Dry-run by default.
 *
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/group-pilot-family.ts --council=wandsworth --head=2025/3409 [--commit]
 *   ../../node_modules/.bin/tsx scripts/group-pilot-family.ts --undo=reports/pilot-family-<file>.json --commit
 */
import { readFileSync, writeFileSync } from 'fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { planCouncilAssessments, type AssessableApplication } from '../src/lib/planning-intelligence/assessment-groups'
import { followOnKind } from '../src/lib/planning-intelligence/linking'

loadEnvConfig(process.cwd())

const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const commit = args.has('commit')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

type Move = {
  applicationId: string; reference: string; role: string
  previous: { developmentId: string; role: string; relationshipSource: string; relevance: string | null } | null
}

async function check<T>(label: string, run: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const { data, error } = await run
  if (error) throw new Error(`${label}: ${JSON.stringify(error)}`)
  return data
}

async function undo(file: string) {
  const plan = JSON.parse(readFileSync(file, 'utf8')) as { headDevelopmentId: string; moves: Move[] }
  for (const move of plan.moves) {
    if (!commit) { console.log('would restore', move.reference); continue }
    if (!move.previous) {
      await check('remove membership', db.from('development_applications').delete().eq('planning_application_id', move.applicationId).eq('development_id', plan.headDevelopmentId))
      continue
    }
    await check('restore membership', db.from('development_applications').update({
      development_id: move.previous.developmentId, role: move.previous.role, relationship_source: move.previous.relationshipSource,
    }).eq('planning_application_id', move.applicationId))
    for (const table of ['development_observations', 'development_brand_signals']) {
      await check(`restore ${table}`, db.from(table).update({ development_id: move.previous.developmentId })
        .eq('planning_application_id', move.applicationId).eq('development_id', plan.headDevelopmentId))
    }
    await check('restore relevance', db.from('developments').update({ relevance: move.previous.relevance }).eq('id', move.previous.developmentId))
  }
  console.log(commit ? 'restored' : 'dry run')
}

async function main() {
  if (args.get('undo')) return undo(args.get('undo')!)
  const council = args.get('council')
  const headReference = args.get('head')
  if (!council || !headReference) throw new Error('--council and --head are required')

  const rows: Array<AssessableApplication & { intelligence_tier: boolean }> = []
  for (let from = 0; ; from += 1000) {
    const page = await check('applications', db.from('planning_applications')
      .select('id,reference,description,procedure,address,postcode,uprn,intelligence_tier')
      .eq('authority_slug', council).order('id').range(from, from + 999))
    rows.push(...((page ?? []) as typeof rows).map(row => ({ ...row, description: row.description ?? '' })))
    if ((page ?? []).length < 1000) break
  }
  const head = rows.find(row => row.reference === headReference)
  if (!head) throw new Error(`No stored application ${headReference} at ${council}`)
  const unit = planCouncilAssessments(rows).units.find(candidate => candidate.memberIds.includes(head.id))
  if (!unit) throw new Error(`${headReference} heads no assessment unit`)
  if (unit.uncertain) throw new Error(`${headReference}'s family is uncertain; it stays separate`)
  if (unit.headId !== head.id) throw new Error(`${headReference} is read inside ${rows.find(r => r.id === unit.headId)?.reference}'s assessment; group from that head`)

  const headMembership = await check('head membership', db.from('development_applications').select('development_id').eq('planning_application_id', head.id).single())
  const headDevelopmentId = (headMembership as unknown as { development_id: string }).development_id
  const byId = new Map(rows.map(row => [row.id, row]))
  const targets = [
    ...unit.memberIds.filter(id => id !== head.id).map(id => ({ id, role: 'amendment' })),
    ...unit.timelineIds.map(id => ({ id, role: followOnKind(byId.get(id)!) === 'condition' ? 'condition' : 'related' })),
  ]

  const moves: Move[] = []
  for (const target of targets) {
    const membership = await check('membership', db.from('development_applications')
      .select('development_id,role,relationship_source,developments(relevance,review_state,research_state)')
      .eq('planning_application_id', target.id).maybeSingle()) as null | {
        development_id: string; role: string; relationship_source: string
        developments: { relevance: string | null; review_state: string; research_state: string } | null
      }
    if (membership?.development_id === headDevelopmentId) continue
    if (membership) {
      const development = membership.developments!
      if (development.review_state !== 'pending') throw new Error(`${byId.get(target.id)!.reference}: its development has been reviewed by a person`)
      if (['processing', 'complete'].includes(development.research_state)) throw new Error(`${byId.get(target.id)!.reference}: research has started on its development`)
      const decided = await check('decided facts', db.from('development_facts').select('fact').eq('development_id', membership.development_id).not('decided_by', 'is', null))
      if ((decided ?? []).length) throw new Error(`${byId.get(target.id)!.reference}: its development has admin-decided facts`)
    }
    moves.push({
      applicationId: target.id, reference: byId.get(target.id)!.reference, role: target.role,
      previous: membership ? { developmentId: membership.development_id, role: membership.role, relationshipSource: membership.relationship_source, relevance: membership.developments!.relevance } : null,
    })
  }

  const plan = { council, head: headReference, headDevelopmentId, missingParentReferences: unit.missingParentReferences, moves }
  console.log(JSON.stringify({ commit, ...plan }, null, 2))
  if (!commit) return

  for (const move of moves) {
    if (move.previous) {
      await check('move membership', db.from('development_applications').update({
        development_id: headDevelopmentId, role: move.role, relationship_source: 'cited_reference',
      }).eq('planning_application_id', move.applicationId).eq('development_id', move.previous.developmentId))
      for (const table of ['development_observations', 'development_brand_signals']) {
        await check(`move ${table}`, db.from(table).update({ development_id: headDevelopmentId })
          .eq('planning_application_id', move.applicationId).eq('development_id', move.previous.developmentId))
      }
      const remaining = await check('remaining', db.from('development_applications').select('planning_application_id').eq('development_id', move.previous.developmentId))
      if ((remaining ?? []).length === 0) {
        await check('clear emptied development', db.from('developments').update({ relevance: null, escalate_for_research: false, research_state: 'not_eligible', updated_at: new Date().toISOString() }).eq('id', move.previous.developmentId))
      }
    } else {
      await check('add membership', db.from('development_applications').insert({
        development_id: headDevelopmentId, planning_application_id: move.applicationId, role: move.role,
        relationship_source: 'cited_reference', confidence: 0.9,
      }))
    }
  }
  const file = `reports/pilot-family-${council}-${headReference.replace(/\W+/g, '-')}.json`
  writeFileSync(file, JSON.stringify(plan, null, 2))
  console.log(`grouped; undo file ${file}`)
}

main().catch(error => { console.error(error); process.exit(1) })
