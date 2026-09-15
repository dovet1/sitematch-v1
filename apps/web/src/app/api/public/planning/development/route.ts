import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { HISTORY_COLUMNS, historyApplication, type HistoryRow } from './history'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** A masterplan can be large; the timeline is for reading, not a census. */
const MAX_APPLICATIONS = 200

/**
 * Every application in one development, for the Planning tab's timeline. The tab lists only what
 * falls inside the searched area and passes its scheme filter, so a card opened from it would
 * otherwise show part of a scheme's history as though it were all of it.
 */
export async function GET(request: NextRequest) {
  const developmentId = request.nextUrl.searchParams.get('developmentId') ?? ''
  if (!UUID.test(developmentId)) return NextResponse.json({ error: 'A development id is required' }, { status: 400 })
  try {
    const { data, error } = await createPlanningAdminClient()
      .from('development_applications')
      .select(HISTORY_COLUMNS)
      .eq('development_id', developmentId)
      .limit(MAX_APPLICATIONS + 1)
    if (error) throw error
    const rows = (data ?? []) as unknown as HistoryRow[]
    const applications = rows.slice(0, MAX_APPLICATIONS)
      .map((row) => historyApplication(row, developmentId))
      .filter((application) => application !== null)
    return NextResponse.json({ applications, truncated: rows.length > MAX_APPLICATIONS })
  } catch (error) {
    console.error('[planning-development] History read failed', error)
    return NextResponse.json({ error: 'The development history is unavailable' }, { status: 500 })
  }
}
