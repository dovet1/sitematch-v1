import { NextRequest, NextResponse } from 'next/server'
import { classifyPlanningBatch } from '@/lib/planning-intelligence/classify'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.PLANNING_CLASSIFICATION_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Planning classification is disabled' }, { status: 503 })
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 })
  }

  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? process.env.PLANNING_CLASSIFICATION_BATCH_SIZE ?? '20', 10)
  try {
    const result = await classifyPlanningBatch({
      db: createPlanningAdminClient(),
      apiKey: process.env.OPENROUTER_API_KEY,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 20,
    })
    return NextResponse.json({ success: result.failed === 0, ...result })
  } catch (error) {
    console.error('[planning-classification] Failed', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Planning classification failed',
    }, { status: 500 })
  }
}
