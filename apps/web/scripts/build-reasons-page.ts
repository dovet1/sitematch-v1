/**
 * Build the standalone reasoning page: the records where the classifier disagrees with the
 * expert, with room to say why.
 *
 * Standalone rather than an Artifact because the expert is outside the organisation. An
 * artifact that declares a shared store is organisation-internal by construction, so it
 * cannot reach him at all. This posts to `planning_label_reasons` with the public anon key,
 * which grants INSERT and nothing else, the same route the labelling page already uses.
 *
 * Only records from the TUNING split are included. The held-out third must stay untouched,
 * or the reasoning gathered here contaminates the only honest test of whether the prompt
 * generalises.
 *
 * Run from apps/web:
 *   npx tsx scripts/build-reasons-page.ts <out.html> [--labeller rob] [--offline]
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

loadEnvConfig(process.cwd())

const TEMPLATE = join(process.cwd(), 'scripts', 'labelling', 'reasons.template.html')
const HOLDOUT_FRACTION = 1 / 3
const isHoldout = (recordId: string) =>
  createHash('sha256').update(`holdout:${recordId}`).digest().readUInt32BE(0) / 0xffffffff < HOLDOUT_FRACTION

/** The payload sits inside a <script>, so `<` is escaped or a description could close it. */
const embed = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

/** Ordered by what the disagreement costs, worst first. */
const GROUPS: Record<string, { group: string; kind: string; rank: number }> = {
  'high|low':     { group: 'missed', kind: 'MISSED',    rank: 1 },
  'low|high':     { group: 'wasted', kind: 'WASTED',    rank: 2 },
  'high|medium':  { group: 'near',   kind: 'NEAR MISS', rank: 3 },
}

async function main() {
  const out = process.argv[2] ?? 'planning-reasons.html'
  const labellerFlag = process.argv.indexOf('--labeller')
  const labeller = labellerFlag === -1 ? 'rob' : process.argv[labellerFlag + 1]
  const offline = process.argv.includes('--offline')

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: apps, error } = await db
    .from('planning_applications')
    .select('id,provider_id,reference,authority_name,address,description,commercial_work,commercial_use_class,links')
    .eq('intelligence_tier', true)
    .order('provider_id', { ascending: true })
  if (error) throw error

  const { data: runs, error: runError } = await db
    .from('planning_classification_runs')
    .select('planning_application_id,output,finished_at')
    .eq('status', 'complete')
    .order('finished_at', { ascending: true })
  if (runError) throw runError
  const providerOf = new Map(apps!.map((a) => [a.id as string, a.provider_id as string]))
  const verdict = new Map<string, string>()
  for (const r of runs ?? []) {
    const o = r.output as Record<string, unknown> | null
    if (o?.relevance) verdict.set(providerOf.get(r.planning_application_id as string)!, String(o.relevance))
  }

  const { data: labels, error: labelError } = await db
    .from('planning_label_submissions')
    .select('record_id,relevance,submitted_at')
    .eq('labeller', labeller)
    .order('submitted_at', { ascending: true })
  if (labelError) throw labelError
  const human = new Map<string, string>()
  for (const l of labels ?? []) human.set(String(l.record_id), String(l.relevance))

  const records = apps!
    .map((a) => {
      const id = a.provider_id as string
      const mine = human.get(id)
      const theirs = verdict.get(id)
      if (!mine || !theirs || mine === theirs || isHoldout(id)) return null
      const spec = GROUPS[`${mine}|${theirs}`]
      if (!spec) return null
      return {
        app: a, rob: mine, model: theirs,
        group: spec.group, kind: spec.kind, rank: spec.rank,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((r, i) => ({
      id: `r${String(i + 1).padStart(2, '0')}`,
      reference: r.app.reference,
      authority: r.app.authority_name,
      address: r.app.address,
      description: r.app.description,
      commercialWork: r.app.commercial_work,
      useClass: r.app.commercial_use_class,
      councilUrl: (r.app.links as { council?: string } | null)?.council ?? null,
      rob: r.rob, model: r.model, kind: r.kind, group: r.group,
    }))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!offline && (!url || !key)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are needed, or pass --offline')
  }

  let html = readFileSync(TEMPLATE, 'utf8')
  html = html.replace(/\/\*__RECORDS__\*\/[\s\S]*?\/\*__RECORDS__\*\//, embed(records))
  html = html.replace(/\/\*__REMOTE__\*\/[\s\S]*?\/\*__REMOTE__\*\//, offline ? 'null' : embed({ url, key }))
  html = html.replace(/\/\*__LABELLER__\*\/[\s\S]*?\/\*__LABELLER__\*\//, embed(labeller))
  if (/__RECORDS__|__REMOTE__|__LABELLER__/.test(html)) throw new Error('template placeholders were not all replaced')
  writeFileSync(out, html)

  const byGroup: Record<string, number> = {}
  for (const r of records) byGroup[r.kind] = (byGroup[r.kind] ?? 0) + 1
  console.log(`wrote ${out}`)
  console.log(`  ${records.length} disagreement(s) for "${labeller}", tuning split only`)
  console.log(`  ${JSON.stringify(byGroup)}`)
  console.log(`  posts to the shared table: ${offline ? 'no (--offline)' : 'yes'}`)
}
main()
