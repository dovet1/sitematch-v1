/** Development linking, step 4: prioritise and run Plota family lookups.
 *
 * Dry-run by default: lists the families a run would fetch, in priority order, and spends nothing.
 * A committed run spends at most --limit requests, never beyond --allowance associated-endpoint
 * requests this calendar month, and never below the discovery reserve.
 *
 * Needs migrations 20261007000000 and 20261008000000. Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/run-family-lookups.ts --councils=a,b [--prioritise] [--limit=10]
 *   ../../node_modules/.bin/tsx scripts/run-family-lookups.ts --councils=a,b --limit=50 --allowance=300 --commit
 * Agreed pilot (14 Sep 2026): South Norfolk Broadland, Wandsworth and Glasgow, 300 requests from October.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { runFamilyLookups } from '../src/lib/planning-intelligence/family-lookup'
import { prioritiseFamilyLookups } from '../src/lib/planning-intelligence/family-priority'
import { PlotaClient } from '../src/lib/planning-intelligence/plota'

loadEnvConfig(process.cwd())
const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))

async function main() {
  const commit = args.has('commit')
  const councils = args.get('councils')?.split(',').filter(Boolean)
  const limit = Number(args.get('limit') ?? 10)
  const allowance = Number(args.get('allowance') ?? (commit ? NaN : 300))
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('--limit must be 1-500')
  if (!Number.isInteger(allowance) || allowance < 0) throw new Error('A committed run needs an explicit --allowance (agreed pilot: 300)')
  if (commit && !councils?.length) throw new Error('A committed run must name --councils')

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  if (args.has('prioritise')) console.log(JSON.stringify({ prioritised: await prioritiseFamilyLookups(db as never, councils) }))

  const client = commit ? new PlotaClient(process.env.PLOTA_API_KEY ?? '') : { associated: () => { throw new Error('dry run') } }
  const result = await runFamilyLookups(db as never, client as never, { limit, monthlyAllowance: allowance, councils, commit })
  console.log(JSON.stringify({
    commit, usedThisMonthBefore: result.usedThisMonthBefore, requestsMade: result.requestsMade, stoppedFor: result.stoppedFor,
    planned: result.planned, stored: result.stored, failures: result.failures,
  }, null, 2))
}

main().catch(error => { console.error(error); process.exitCode = 1 })
