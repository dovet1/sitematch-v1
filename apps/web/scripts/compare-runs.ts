/**
 * Compare two cached evaluation runs.
 *
 * The point is to separate a real prompt improvement from this model's own randomness.
 * Run the SAME prompt twice and the disagreement between those two runs is the noise floor:
 * any difference between two DIFFERENT prompts smaller than that floor means nothing.
 *
 * Run from apps/web:
 *   npx tsx scripts/compare-runs.ts runs/a.json runs/b.json
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
loadEnvConfig(process.cwd())

const isHoldout = (id: string) =>
  createHash('sha256').update(`holdout:${id}`).digest().readUInt32BE(0) / 0xffffffff < 1 / 3

async function main() {
  const [aPath, bPath] = process.argv.slice(2)
  if (!aPath || !bPath) throw new Error('usage: compare-runs.ts <a.json> <b.json>')
  const a = JSON.parse(readFileSync(aPath, 'utf8'))
  const b = JSON.parse(readFileSync(bPath, 'utf8'))

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: lab } = await db.from('planning_label_submissions')
    .select('record_id,relevance,submitted_at').eq('labeller', 'rob').order('submitted_at')
  const rob = new Map<string, string>()
  for (const r of lab ?? []) rob.set(String(r.record_id), String(r.relevance))

  // Only records BOTH runs classified and rob labelled, outside the held-out third.
  const ids = [...rob.keys()].filter((id) =>
    !isHoldout(id) && a.results[id]?.classification && b.results[id]?.classification)

  const relA = (id: string) => a.results[id].classification.relevance as string
  const relB = (id: string) => b.results[id].classification.relevance as string
  const agreeA = ids.filter((id) => relA(id) === rob.get(id)).length
  const agreeB = ids.filter((id) => relB(id) === rob.get(id)).length
  const flips = ids.filter((id) => relA(id) !== relB(id))

  const pct = (n: number) => ((n / ids.length) * 100).toFixed(1) + '%'
  console.log(`comparing on ${ids.length} records both runs classified\n`)
  console.log(`  ${aPath}`)
  console.log(`    prompt ${a.promptVersion}, model ${a.model ?? 'default'}, run ${a.classifiedAt}`)
  console.log(`    agrees with rob: ${agreeA}/${ids.length} (${pct(agreeA)})`)
  console.log(`  ${bPath}`)
  console.log(`    prompt ${b.promptVersion}, model ${b.model ?? 'default'}, run ${b.classifiedAt}`)
  console.log(`    agrees with rob: ${agreeB}/${ids.length} (${pct(agreeB)})`)
  console.log(`\n  difference: ${(((agreeB - agreeA) / ids.length) * 100).toFixed(1)} points`)
  console.log(`  records that changed answer between runs: ${flips.length} (${pct(flips.length)})`)
  console.log(`\n  >>> The flip rate IS the noise floor. A difference smaller than it is not a result.`)

  const dist = (rel: (id: string) => string) => {
    const d: Record<string, number> = { high: 0, medium: 0, low: 0 }
    for (const id of ids) d[rel(id)]++
    return `high ${d.high}, medium ${d.medium}, low ${d.low}`
  }
  console.log(`\n  distribution A: ${dist(relA)}`)
  console.log(`  distribution B: ${dist(relB)}`)
}
main()
