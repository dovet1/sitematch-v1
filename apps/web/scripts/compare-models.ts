/**
 * Summarise a model sweep: for each candidate, how stable is it, and how well does it agree
 * with the expert?
 *
 * Stability comes first and is the gate. A model that disagrees with itself cannot be tuned,
 * and its agreement score is a single sample from a wide distribution rather than a result.
 *
 * Run from apps/web:
 *   npx tsx scripts/compare-models.ts flashlite haiku flash
 * expecting runs/<name>-a.json and runs/<name>-b.json for each.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
loadEnvConfig(process.cwd())

const isHoldout = (id: string) =>
  createHash('sha256').update(`holdout:${id}`).digest().readUInt32BE(0) / 0xffffffff < 1 / 3

function table(rows: string[][]) {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)))
  return rows.map((r, ri) => {
    const line = r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ')
    return ri === 0 ? `${line}\n${w.map((n) => '-'.repeat(n)).join('  ')}` : line
  }).join('\n')
}

async function main() {
  const names = process.argv.slice(2)
  if (names.length === 0) throw new Error('usage: compare-models.ts <name> [<name>...]')

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: lab } = await db.from('planning_label_submissions')
    .select('record_id,relevance,creates_commercial_space,dwelling_count,submitted_at')
    .eq('labeller', 'rob').order('submitted_at')
  const rob = new Map<string, any>()
  for (const r of lab ?? []) rob.set(String(r.record_id), r)

  const rows: string[][] = [[
    'model', 'runs', 'flip rate', 'failed', 'rel A', 'rel B', 'swing', '16+ cut', '$/80',
  ]]

  for (const name of names) {
    const aPath = `runs/${name}-a.json`, bPath = `runs/${name}-b.json`
    if (!existsSync(aPath) || !existsSync(bPath)) { rows.push([name, 'missing', '', '', '', '', '', '', '']); continue }
    const a = JSON.parse(readFileSync(aPath, 'utf8'))
    const b = JSON.parse(readFileSync(bPath, 'utf8'))

    const ids = [...rob.keys()].filter((id) =>
      !isHoldout(id) && a.results[id]?.classification && b.results[id]?.classification)
    if (ids.length === 0) { rows.push([name, '0 shared', '', '', '', '', '', '', '']); continue }

    const relOf = (run: any, id: string) => run.results[id].classification.relevance as string
    const flips = ids.filter((id) => relOf(a, id) !== relOf(b, id)).length
    const agree = (run: any) => ids.filter((id) => relOf(run, id) === rob.get(id).relevance).length
    const pc = (n: number) => ((n / ids.length) * 100).toFixed(1) + '%'

    // The 16+ dwelling cut is what objective 3 actually acts on, averaged over both runs.
    const big = (n: number | null) => n !== null && n >= 16
    const cutHits = [a, b].flatMap((run) => ids.map((id) => {
      const human = rob.get(id).dwelling_count
      return big(human === null || human === undefined ? null : Number(human))
        === big(run.results[id].classification.dwellings.count)
    })).filter(Boolean).length
    const failedA = Object.values(a.results).filter((r: any) => r.error).length
    const failedB = Object.values(b.results).filter((r: any) => r.error).length

    rows.push([
      (a.model ?? name).replace(/^[a-z-]+\//, ''),
      String(ids.length),
      pc(flips),
      `${failedA}+${failedB}`,
      pc(agree(a)),
      pc(agree(b)),
      Math.abs(((agree(b) - agree(a)) / ids.length) * 100).toFixed(1) + 'pt',
      ((cutHits / (ids.length * 2)) * 100).toFixed(1) + '%',
      '',
    ])
  }

  console.log(table(rows))
  console.log('\nflip rate = share of records answered differently by two runs of the SAME model.')
  console.log('It is the resolution limit: a prompt change smaller than it cannot be detected.')
  console.log('For reference, openai/gpt-oss-120b measured 32.3%.')
}
main()
