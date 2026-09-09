import { NextRequest, NextResponse } from 'next/server'
import { createPlanningAdminClient } from '@/lib/planning-intelligence/db'
import { researchPlanningBatch } from '@/lib/planning-intelligence/research'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (process.env.PLANNING_RESEARCH_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Planning research is disabled' }, { status: 503 })
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 })
  }

  const requestedLimit = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '3', 10)
  try {
    const result = await researchPlanningBatch({
      db: createPlanningAdminClient(),
      apiKey: process.env.OPENROUTER_API_KEY,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 3,
    })
    return NextResponse.json({ success: result.failed === 0, ...result })
  } catch (error) {
    console.error('[planning-research] Failed', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Planning research failed',
    }, { status: 500 })
  }
}

