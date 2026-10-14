/** Development linking: release families held only because Plota's family lacks local follow-ons.
 *
 * A family held because Plota's family disagrees with local links is released when every
 * disagreement is one scheme on the family's site (`recheckPendingConflicts`, agreed 14 October
 * 2026). The rest stay pending for review. Dry run by default; no provider calls.
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/recheck-family-conflicts.ts --councils=south-norfolk-broadland,wandsworth,glasgow [--commit]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { recheckPendingConflicts } from '../src/lib/planning-intelligence/family-lookup'

loadEnvConfig(process.cwd())
const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const commit = args.has('commit')
const councils = args.get('councils')?.split(',').filter(Boolean) ?? []
if (councils.length === 0) throw new Error('--councils is required')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const conflicts = await recheckPendingConflicts(db as never, { councils, commit })
  const count = (state: string) => conflicts.filter(row => row.reviewState === state).length
  console.log(JSON.stringify({ pendingBefore: conflicts.length, resolvedSameScheme: count('resolved'), noLongerConflicting: count('none'), stillPending: count('pending') }))

  mkdirSync('reports', { recursive: true })
  const file = `reports/family-conflicts-${commit ? 'commit' : 'dry-run'}-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), commit, conflicts }, null, 2))
  console.log(`wrote ${file}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
