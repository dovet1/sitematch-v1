import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { FAMILY_ENDPOINT, runFamilyLookups } from '@/lib/planning-intelligence/family-lookup'
import { prioritiseFamilyLookups } from '@/lib/planning-intelligence/family-priority'
import { expectedDailyNeed, familyTopUpBudget } from '@/lib/planning-intelligence/family-topup'
import { PlotaClient } from '@/lib/planning-intelligence/plota'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Month-end top-up of family lookups: from the 26th, spend what the scheduled workers will not need
 * before the allowance resets (family-topup.ts). Scheduled hourly on the last days of the month;
 * each run re-reads the remaining allowance and spends at most PLOTA_FAMILY_TOPUP_PER_RUN.
 *
 * Off unless PLOTA_FAMILY_TOPUP_ENABLED is set. Only lookups judged worth a request are taken
 * (priority above 0), highest first, and never below the discovery reserve.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.PLOTA_FAMILY_TOPUP_ENABLED !== 'true') {
    return NextResponse.json({ error: 'The month-end family lookup top-up is disabled.' }, { status: 503 })
  }
  if (!process.env.PLOTA_API_KEY) return NextResponse.json({ error: 'PLOTA_API_KEY is not configured' }, { status: 500 })
  const perRun = Number.parseInt(process.env.PLOTA_FAMILY_TOPUP_PER_RUN ?? '40', 10)
  const councils = process.env.PLOTA_FAMILY_LOOKUP_COUNCILS?.split(',').map(council => council.trim()).filter(Boolean)

  try {
    const db = createPlanningAdminClient()
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const { data: latest, error: latestError } = await db.from('planning_provider_usage')
      .select('monthly_remaining').eq('provider', 'plota').gte('occurred_at', monthStart)
      .not('monthly_remaining', 'is', null).order('occurred_at', { ascending: false }).limit(1).maybeSingle()
    if (latestError) throw latestError
    const { count: recent, error: recentError } = await db.from('planning_provider_usage')
      .select('id', { count: 'exact', head: true }).eq('provider', 'plota').neq('endpoint', FAMILY_ENDPOINT)
      .gte('occurred_at', new Date(now.getTime() - 3 * 86_400_000).toISOString())
    if (recentError) throw recentError

    const budget = familyTopUpBudget({
      now,
      monthlyRemaining: typeof latest?.monthly_remaining === 'number' ? latest.monthly_remaining : null,
      dailyNeed: expectedDailyNeed(recent ?? 0),
      perRunCap: Math.max(1, Math.min(Number.isFinite(perRun) ? perRun : 40, 60)),
    })
    if (!budget.eligible) return NextResponse.json({ success: true, skipped: budget.reason, budget })

    await prioritiseFamilyLookups(db, councils)
    const result = await runFamilyLookups(db, new PlotaClient(process.env.PLOTA_API_KEY), {
      limit: budget.thisRun,
      // The budget above is the allowance; runFamilyLookups still stops at the reserve per request.
      monthlyAllowance: Number.MAX_SAFE_INTEGER,
      councils,
      commit: true,
    })
    return NextResponse.json({ success: true, budget, ...result })
  } catch (error) {
    console.error('[plota-family-topup] Failed', error)
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Family lookup top-up failed' }, { status: 500 })
  }
}
