import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { runFamilyLookups } from '@/lib/planning-intelligence/family-lookup'
import { PlotaClient } from '@/lib/planning-intelligence/plota'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Development linking, step 4: spend a bounded number of Plota requests on missing families.
 *
 * Deliberately unscheduled until the pilot has measured what a lookup is worth. Off unless
 * PLOTA_FAMILY_LOOKUPS_ENABLED is set, and it spends nothing without an explicit monthly allowance.
 * Each run is capped, and never spends the discovery reserve.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.PLOTA_FAMILY_LOOKUPS_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Plota family lookups are disabled.' }, { status: 503 })
  }
  if (!process.env.PLOTA_API_KEY) return NextResponse.json({ error: 'PLOTA_API_KEY is not configured' }, { status: 500 })
  const allowance = Number.parseInt(process.env.PLOTA_FAMILY_LOOKUP_MONTHLY_ALLOWANCE ?? '0', 10)
  const perRun = Number.parseInt(process.env.PLOTA_FAMILY_LOOKUPS_PER_RUN ?? '10', 10)
  const councils = process.env.PLOTA_FAMILY_LOOKUP_COUNCILS?.split(',').map(council => council.trim()).filter(Boolean)
  if (!Number.isFinite(allowance) || allowance <= 0) {
    return NextResponse.json({ success: true, skipped: 'No monthly family lookup allowance is set' })
  }
  try {
    const result = await runFamilyLookups(createPlanningAdminClient(), new PlotaClient(process.env.PLOTA_API_KEY), {
      limit: Math.max(1, Math.min(Number.isFinite(perRun) ? perRun : 10, 50)),
      monthlyAllowance: allowance,
      councils,
      commit: true,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[plota-family-lookups] Failed', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Family lookups failed' }, { status: 500 })
  }
}
