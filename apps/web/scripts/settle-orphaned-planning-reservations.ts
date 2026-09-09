/**
 * Settle abandoned planning AI reservations without deleting ledger history.
 *
 * The script is intentionally conservative: it re-reads every reserved row and only charges
 * one when its application is not processing and its linked run is not running. Active work
 * is printed as skipped. Run from apps/web with:
 *   npx tsx scripts/settle-orphaned-planning-reservations.ts
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials are not configured')

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: reservations, error } = await db
    .from('planning_ai_usage')
    .select('id,reserved_usd,planning_application_id,classification_run_id')
    .eq('status', 'reserved')
    .eq('stage', 'initial')
  if (error) throw error

  let settled = 0
  let skipped = 0
  for (const reservation of reservations ?? []) {
    const [{ data: application, error: applicationError }, { data: run, error: runError }] =
      await Promise.all([
        reservation.planning_application_id
          ? db.from('planning_applications')
            .select('classification_state')
            .eq('id', reservation.planning_application_id)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        reservation.classification_run_id
          ? db.from('planning_classification_runs')
            .select('status')
            .eq('id', reservation.classification_run_id)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])
    if (applicationError) throw applicationError
    if (runError) throw runError

    if (application?.classification_state === 'processing' || run?.status === 'running') {
      skipped++
      continue
    }

    const { error: settleError } = await db.from('planning_ai_usage').update({
      status: 'complete',
      actual_usd: reservation.reserved_usd,
    }).eq('id', reservation.id).eq('status', 'reserved')
    if (settleError) throw settleError
    settled++
  }

  console.info(JSON.stringify({ reservedFound: reservations?.length ?? 0, settled, skipped }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Failed to settle reservations')
  process.exit(1)
})
