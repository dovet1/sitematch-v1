import { NextResponse } from 'next/server'
import { adminClient, adminError, requireAdminUser } from '@/lib/admin-auth'
import { deriveFreshness, readPipelineStatus } from '@/lib/planning-intelligence/freshness'

export const dynamic = 'force-dynamic'

/**
 * What the planning pipeline is doing, in one request.
 *
 * Queue depth and freshness were spread across four tables with nothing joining them, so a
 * classification queue that had stopped draining and a quiet week looked identical. The
 * derived `freshness` block is the same judgement the planning tab applies, read from the
 * same function, so an operator and a user cannot be told different things about the same
 * data.
 */
export async function GET() {
  try {
    const gate = await requireAdminUser()
    if (gate.error) return gate.error
    const status = await readPipelineStatus(adminClient())
    return NextResponse.json({ ...status, freshness_state: deriveFreshness(status) })
  } catch (error) {
    return adminError('Error reading planning pipeline status', error)
  }
}
