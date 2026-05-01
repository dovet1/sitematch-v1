import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { checkSubscriptionAccess } from '@/lib/subscription'
import type { TravelTimeResponse } from '@/types/travel-time'

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20 // 20 app requests per minute = up to 40 Mapbox calls

// In-memory storage: userId -> array of request timestamps
const rateLimitStore = new Map<string, number[]>()

// Cleanup old entries periodically (prevent memory leaks)
setInterval(() => {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS

  for (const [userId, timestamps] of Array.from(rateLimitStore.entries())) {
    const validTimestamps = timestamps.filter((ts: number) => ts > cutoff)
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(userId)
    } else {
      rateLimitStore.set(userId, validTimestamps)
    }
  }
}, 60 * 1000) // Run cleanup every minute

/**
 * Check if user has exceeded rate limit
 */
function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS

  // Get user's request history
  const timestamps = rateLimitStore.get(userId) || []

  // Filter to only recent requests (within the window)
  const recentRequests = timestamps.filter((ts) => ts > cutoff)

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded - calculate when they can retry
    const oldestRequest = Math.min(...recentRequests)
    const retryAfter = Math.ceil((oldestRequest + RATE_LIMIT_WINDOW_MS - now) / 1000)

    return { allowed: false, retryAfter }
  }

  // Add current request
  recentRequests.push(now)
  rateLimitStore.set(userId, recentRequests)

  return { allowed: true }
}

/**
 * Mapbox Directions API response (simplified)
 */
interface MapboxDirectionsResponse {
  routes?: Array<{
    duration: number // seconds
    distance: number // meters
  }>
  code: string // 'Ok', 'NoRoute', etc.
  message?: string
}

/**
 * Fetch travel time from Mapbox Directions API
 */
async function fetchMapboxDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  profile: 'walking' | 'driving'
): Promise<{ duration: number; distance: number }> {
  // Use private server-side token only (no fallback to public token for security)
  const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN

  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox access token not configured')
  }

  // Mapbox Directions API format: lng,lat (note: longitude first!)
  const coordinates = `${originLng},${originLat};${destLng},${destLat}`
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries: 'geojson',
    overview: 'false', // We don't need the full route geometry
  })

  const response = await fetch(`${url}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Mapbox API error: ${response.status}`)
  }

  const data: MapboxDirectionsResponse = await response.json()

  // Check Mapbox response code (not just HTTP status)
  // Mapbox can return 200 with code: 'NoRoute' or other error codes
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(data.message || 'No route found')
  }

  const route = data.routes[0]
  return {
    duration: Math.round(route.duration), // seconds
    distance: Math.round(route.distance), // meters
  }
}

/**
 * GET /api/public/stores/travel-time
 * Calculate walking and driving travel times between two points
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Parse and validate parameters
    const { searchParams } = new URL(request.url)
    const originLat = Number(searchParams.get('originLat'))
    const originLng = Number(searchParams.get('originLng'))
    const destLat = Number(searchParams.get('destLat'))
    const destLng = Number(searchParams.get('destLng'))
    const storeId = searchParams.get('storeId')

    if (!storeId || isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    // 2. Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 3. Check subscription (allows trial + paid users)
    const hasAccess = await checkSubscriptionAccess(user.id)
    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: 'Subscription required',
          requiresUpgrade: true,
        },
        { status: 403 }
      )
    }

    // 4. Check rate limit
    const { allowed, retryAfter } = checkRateLimit(user.id)
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
          rateLimitExceeded: true,
          retryAfter,
        },
        { status: 429 }
      )
    }

    // 5. Fetch travel times in parallel (2 Mapbox Directions API calls)
    const [walkingResult, drivingResult] = await Promise.allSettled([
      fetchMapboxDirections(originLat, originLng, destLat, destLng, 'walking'),
      fetchMapboxDirections(originLat, originLng, destLat, destLng, 'driving'),
    ])

    // 6. Build response with partial data if needed
    const response: TravelTimeResponse = {
      success: false, // Will set to true if at least one succeeds
      storeId,
    }

    if (walkingResult.status === 'fulfilled') {
      response.walking = walkingResult.value
      response.success = true
    }

    if (drivingResult.status === 'fulfilled') {
      response.driving = drivingResult.value
      response.success = true
    }

    // If both failed, return error
    if (walkingResult.status === 'rejected' && drivingResult.status === 'rejected') {
      return NextResponse.json(
        {
          success: false,
          storeId,
          error: 'Unable to calculate travel times. Location may be unreachable.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Travel time calculation error:', error)

    // Check if it's a token configuration error
    if (error instanceof Error && error.message === 'Mapbox access token not configured') {
      return NextResponse.json(
        {
          success: false,
          error: 'Mapbox access token not configured',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
