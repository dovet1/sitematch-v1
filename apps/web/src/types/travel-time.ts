/**
 * Travel time data structure
 */
export interface TravelTimeData {
  walking?: {
    duration: number // seconds
    distance: number // meters
  }
  driving?: {
    duration: number // seconds
    distance: number // meters
  }
}

/**
 * Travel times storage (keyed by store ID)
 */
export type TravelTimesMap = Record<string, TravelTimeData>

/**
 * API request parameters
 */
export interface TravelTimeRequestParams {
  originLat: number
  originLng: number
  destLat: number
  destLng: number
  storeId: string
}

/**
 * API response
 */
export interface TravelTimeResponse {
  success: boolean
  storeId: string
  walking?: {
    duration: number
    distance: number
  }
  driving?: {
    duration: number
    distance: number
  }
  error?: string
  rateLimitExceeded?: boolean
  retryAfter?: number
  requiresUpgrade?: boolean
}
