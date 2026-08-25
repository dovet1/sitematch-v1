import { NextRequest, NextResponse } from 'next/server'
import { getServerUserProfile } from '@/lib/auth'
import { periodFromMonth, previousCalendarMonth } from '@/lib/planning-alerts/period'
import {
  listAccessiblePlanningAlertSubscriptions,
  processPlanningAlertBatch,
} from '@/lib/planning-alerts/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const profile = await getServerUserProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { subscriptionId?: string; month?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const period = body.month ? periodFromMonth(body.month) : null
  const latest = previousCalendarMonth()
  if (!body.subscriptionId || !period || period.start > latest.start) {
    return NextResponse.json({ error: 'Invalid subscription or month' }, { status: 400 })
  }

  const accessible = await listAccessiblePlanningAlertSubscriptions({
    userId: profile.id,
    isAdmin: profile.role === 'admin',
  })
  if (!accessible.some((subscription) => subscription.id === body.subscriptionId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const state = await processPlanningAlertBatch(body.subscriptionId, period)
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[planning-alerts] Processing batch failed', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Planning alert processing failed' },
      { status: 500 }
    )
  }
}
