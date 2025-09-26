import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { checkSubscriptionAccess } from '@/lib/subscription'

/**
 * Middleware to check subscription access for protected routes
 */
export async function withSubscriptionCheck(
  request: NextRequest,
  protectedPaths: string[] = [
    '/search',
    '/listings/',
    '/sitesketcher',
    '/agencies/create'
  ]
): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl

  // Check if current path requires subscription
  const requiresSubscription = protectedPaths.some(path => {
    if (path.endsWith('/')) {
      return pathname.startsWith(path)
    }
    return pathname === path || pathname.startsWith(path + '/')
  })

  if (!requiresSubscription) {
    return null // Continue to next middleware/handler
  }

  // Get user from request
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Redirect to login with return URL
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check subscription access
  const hasAccess = await checkSubscriptionAccess(user.id)

  if (!hasAccess) {
    // Special handling for different routes
    if (pathname.startsWith('/listings/')) {
      // For individual listings, check if user owns the listing
      const listingId = pathname.split('/')[2]
      if (listingId && await userOwnsListing(user.id, listingId)) {
        return null // Allow access to own listing
      }
    }

    // Redirect to paywall/pricing page with return URL
    const paywallUrl = new URL('/pricing', request.url)
    paywallUrl.searchParams.set('redirectTo', pathname)
    paywallUrl.searchParams.set('reason', 'subscription_required')
    return NextResponse.redirect(paywallUrl)
  }

  return null // User has access, continue
}

/**
 * Check if user owns a specific listing
 */
async function userOwnsListing(userId: string, listingId: string): Promise<boolean> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('listings')
      .select('user_id')
      .eq('id', listingId)
      .single()

    if (error || !data) {
      return false
    }

    return data.user_id === userId
  } catch (error) {
    console.error('Error checking listing ownership:', error)
    return false
  }
}

/**
 * Protected route wrapper for API routes
 */
export async function requireSubscription(
  request: NextRequest,
  handler: (request: NextRequest, userId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const hasAccess = await checkSubscriptionAccess(user.id)

  if (!hasAccess) {
    return NextResponse.json({
      error: 'Subscription required',
      code: 'SUBSCRIPTION_REQUIRED'
    }, { status: 403 })
  }

  return handler(request, user.id)
}