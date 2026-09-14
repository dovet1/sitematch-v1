/** Full-census backfill, with explicit fixed dates so later invocations resume the same walk.
 * Run from apps/web:
 * npx tsx scripts/backfill-planning.ts 2025-09-10 2026-09-10 --councils=wandsworth,birmingham,canterbury [--commit]
 * Each invocation is capped at 1,000 requests and respects the worker's provider reserve.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { runPlotaSync } from '../src/lib/planning-intelligence/ingest'
import { PlotaClient, PlotaError } from '../src/lib/planning-intelligence/plota'
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { backfillDeadlineReached } from './lib/backfill-deadline'

loadEnvConfig(process.cwd())

let releaseLock: (() => void) | undefined
function acquireLock() {
  mkdirSync('reports', { recursive: true })
  const path = 'reports/planning-backfill.lock'
  try {
    const previous = JSON.parse(readFileSync(path, 'utf8')) as { pid: number }
    if (!Number.isInteger(previous.pid) || previous.pid <= 0) throw new Error('Invalid backfill lock; inspect before restarting')
    try { process.kill(previous.pid, 0) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
      unlinkSync(path)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const file = openSync(path, 'wx') // A live owner or simultaneous start fails closed.
  writeFileSync(file, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }))
  closeSync(file)
  releaseLock = () => {
    const owner = JSON.parse(readFileSync(path, 'utf8'))
    if (owner.pid === process.pid) unlinkSync(path)
  }
}
async function main() {
  const [from, to] = process.argv.slice(2)
  const stopAt = process.argv.find(arg => arg.startsWith('--stop-at='))?.slice('--stop-at='.length)
  const checkDeadline = () => {
    if (backfillDeadlineReached(stopAt)) throw new Error('Backfill deadline reached; no further provider requests permitted')
  }
  checkDeadline()
  let councils = process.argv.find(arg => arg.startsWith('--councils='))?.slice('--councils='.length).split(',')
  const allCouncils = process.argv.includes('--all-councils')
  if (allCouncils && councils) throw new Error('Choose --all-councils or --councils, not both')
  if (!allCouncils && (!councils?.length || councils.some(council => !/^[a-z0-9-]+$/.test(council)))) {
    throw new Error('Supply --all-councils or verified slugs with --councils=wandsworth,birmingham,canterbury')
  }
  for (const date of [from, to]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ||
      !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
      throw new Error('Supply valid YYYY-MM-DD start and end dates')
    }
  }
  if (from > to || to > new Date().toISOString().slice(0, 10)) throw new Error('Dates must be ordered and not in the future')
  const windows: Array<{ from: string; to: string }> = []
  let cursor = from
  while (cursor <= to) {
    const start = new Date(cursor)
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    windows.push({ from: cursor, to: end < to ? end : to })
    cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
  }
  console.log(JSON.stringify({ scope: 'full', councils: allCouncils ? 'provider catalogue' : councils,
    windows, maxSearchRequests: 1000, commit: process.argv.includes('--commit') }))
  if (!process.argv.includes('--commit')) return
  acquireLock()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.PLOTA_API_KEY
  if (!url || !key || !apiKey) throw new Error('Supabase and Plota credentials are required')
  if (allCouncils) {
    checkDeadline()
    const response = await fetch('https://api.plota.co.uk/v1/councils', {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) throw new Error(`Council catalogue failed (${response.status})`)
    const body = await response.json() as { data?: Array<{ slug: string }>; meta?: { count?: number; next_cursor?: string } }
    if (!Array.isArray(body.data) || !body.data.length || body.meta?.count !== body.data.length || body.meta?.next_cursor ||
      body.data.some(row => !/^[a-z0-9-]+$/.test(row.slug))) {
      throw new Error('Council catalogue is incomplete or invalid; refusing a partial national baseline')
    }
    councils = [...new Set(body.data.map(row => row.slug))].sort()
    console.log(JSON.stringify({ catalogueCouncils: councils.length }))
  }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const client = new PlotaClient(apiKey)
  const search = client.search.bind(client)
  let searched = 0
  let nextSearchAt = 0
  client.search = async (params, options) => {
    // Keep this consumer below the Starter minute limit, including fast empty pages.
    // A rate-limited page has not advanced its checkpoint and can be retried safely.
    let result: Awaited<ReturnType<typeof search>> | undefined
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, nextSearchAt - Date.now())))
      nextSearchAt = Date.now() + 750
      try {
        checkDeadline()
        result = await search(params, { signal: options?.signal ?? AbortSignal.timeout(55000) })
        break
      } catch (error) {
        if (!(error instanceof PlotaError) || error.status !== 429 || attempt === 3) throw error
        const waitSeconds = Math.max(1, Math.min(error.retryAfterSeconds ?? 60, 300))
        console.log(JSON.stringify({ rateLimited: true, retryInSeconds: waitSeconds }))
        nextSearchAt = Date.now() + waitSeconds * 1000
      }
    }
    if (!result) throw new Error('Plota search did not return a page')
    if (++searched % 25 === 0) console.log(JSON.stringify({ searchRequests: searched,
      council: params.council, monthlyRemaining: result.usage.monthlyRemaining }))
    return result
  }
  let requestsLeft = 1000
  for (const window of windows) {
    while (requestsLeft > 0) {
      const result = await runPlotaSync({ db, client, kind: 'backfill', scope: 'full',
        councils,
        dateFrom: window.from, dateTo: window.to, pageSize: 50, maxPages: Math.min(100, requestsLeft),
        brandLimbEnabled: process.env.PLANNING_BRAND_LIMB_ENABLED === 'true' })
      requestsLeft -= result.requestsMade
      console.log(JSON.stringify({ window, requestsLeft, ...result }))
      if (result.stoppedForReserve) return
      if (result.status === 'complete') break
      if (!result.requestsMade) throw new Error('Backfill made no progress')
    }
    if (requestsLeft <= 0) {
      console.log('Request cap reached. Repeat the same dated command to resume; the baseline is not yet confirmed complete.')
      return
    }
  }
  console.log(allCouncils ? 'All requested monthly windows completed for the provider council catalogue.' :
    'All requested monthly windows completed for the selected councils. This does not establish national coverage.')
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => releaseLock?.())
