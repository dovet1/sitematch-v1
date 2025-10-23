import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkSubscriptionAccess } from '@/lib/subscription'

export async function middleware(request: NextRequest) {
  // Skip middleware for auth routes
  if (request.nextUrl.pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // Skip session validation if already being logged out
  const logoutReason = request.nextUrl.searchParams.get('logout_reason')
  if (logoutReason === 'session_invalid' && request.nextUrl.pathname === '/') {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Session validation for authenticated users
  if (user) {
    // Get session ID from cookie
    const sessionIdCookie = request.cookies.get('session_id')?.value

    if (sessionIdCookie) {
      // Fetch the user's stored session ID
      const { data: userData } = await supabase
        .from('users')
        .select('current_session_id')
        .eq('id', user.id)
        .single()

      // If there's a stored session ID and it doesn't match, redirect to logout
      if (userData?.current_session_id && userData.current_session_id !== sessionIdCookie) {
        const logoutUrl = new URL('/', request.url)
        logoutUrl.searchParams.set('logout_reason', 'session_invalid')
        return NextResponse.redirect(logoutUrl)
      }
    }
  }

  // Admin route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/?login=1', request.url))
    }

    // Check if user has admin role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // Occupier route protection
  if (request.nextUrl.pathname.startsWith('/occupier')) {
    if (!user) {
      return NextResponse.redirect(new URL('/?login=1', request.url))
    }

    // Check if user has occupier or admin role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    console.log('Middleware auth check:', { 
      userId: user.id, 
      profile, 
      pathname: request.nextUrl.pathname 
    });

    if (!profile || (profile.role !== 'occupier' && profile.role !== 'admin')) {
      console.log('Middleware redirect: unauthorized');
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  // Protected routes that require any authentication
  const protectedRoutes = ['/dashboard', '/listings/create', '/listings/manage']
  if (protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    if (!user) {
      return NextResponse.redirect(new URL('/?login=1', request.url))
    }
  }

  // Subscription-protected routes (excluding search and agencies/create which we handle differently)
  const subscriptionRoutes = ['/sitesketcher']

  // Allow access to SiteSketcher landing page for unpaid users only
  const isLandingPage = request.nextUrl.pathname === '/sitesketcher/landing'

  // For paid users accessing landing page, redirect to tool directly
  if (isLandingPage && user) {
    try {
      const hasAccess = await checkSubscriptionAccess(user.id)
      if (hasAccess) {
        // Paid user should skip landing and go straight to tool
        return NextResponse.redirect(new URL('/sitesketcher', request.url))
      }
    } catch (error) {
      console.error('Subscription check error for landing page:', error)
      // On error, allow access to landing page (safer fallback)
    }
  }

  const isSubscriptionRoute = subscriptionRoutes.some(route =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
  ) && !isLandingPage

  // Check individual listing pages (except user's own listings)
  const isListingPage = request.nextUrl.pathname.match(/^\/listings\/[^/]+$/)

  // Handle search page differently - allow access but client will show modal if no subscription
  const isSearchPage = request.nextUrl.pathname === '/search'

  // For subscription routes, redirect based on auth and subscription status
  if (isSubscriptionRoute || isListingPage) {
    if (user) {
      // Logged in user - check subscription
      try {
        const hasAccess = await checkSubscriptionAccess(user.id)

        if (!hasAccess) {
          // Special handling for individual listings - check if user owns it
          if (isListingPage) {
            const listingId = request.nextUrl.pathname.split('/')[2]
            const { data: listing } = await supabase
              .from('listings')
              .select('user_id')
              .eq('id', listingId)
              .single()

            // Allow access to own listings
            if (listing?.user_id === user.id) {
              return response
            }
          }

          // For SiteSketcher, redirect free users to landing page
          if (request.nextUrl.pathname.startsWith('/sitesketcher')) {
            return NextResponse.redirect(new URL('/sitesketcher/landing', request.url))
          }

          // For other subscription routes, redirect to pricing with return URL
          const pricingUrl = new URL('/pricing', request.url)
          pricingUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
          pricingUrl.searchParams.set('reason', 'subscription_required')
          return NextResponse.redirect(pricingUrl)
        }
      } catch (error) {
        console.error('Subscription check error:', error)
        // On error, redirect to landing for SiteSketcher, pricing for others
        if (request.nextUrl.pathname.startsWith('/sitesketcher')) {
          return NextResponse.redirect(new URL('/sitesketcher/landing', request.url))
        }
        const pricingUrl = new URL('/pricing', request.url)
        pricingUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
        return NextResponse.redirect(pricingUrl)
      }
    } else {
      // Not logged in - redirect to landing page for SiteSketcher
      if (request.nextUrl.pathname.startsWith('/sitesketcher')) {
        return NextResponse.redirect(new URL('/sitesketcher/landing', request.url))
      }

      // For other routes, redirect to pricing
      const pricingUrl = new URL('/pricing', request.url)
      pricingUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      pricingUrl.searchParams.set('reason', 'subscription_required')
      return NextResponse.redirect(pricingUrl)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}