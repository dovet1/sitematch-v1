import { NextRequest } from 'next/server'
import { runDiscoveryLaneRoute } from '@/lib/planning-intelligence/discovery-lane-route'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Re-read receipt dates 7-120 days old for applications councils published late. */
export function GET(request: NextRequest) {
  return runDiscoveryLaneRoute(request, 'late')
}
