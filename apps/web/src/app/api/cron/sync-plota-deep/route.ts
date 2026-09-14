import { NextRequest } from 'next/server'
import { runDiscoveryLaneRoute } from '@/lib/planning-intelligence/discovery-lane-route'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Re-read receipt dates 120-365 days old, where large schemes are validated late most often. */
export function GET(request: NextRequest) {
  return runDiscoveryLaneRoute(request, 'deep')
}
