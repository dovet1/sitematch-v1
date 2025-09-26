import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkSubscriptionAccess } from '@/lib/subscription'

export async function middleware(request: NextRequest) {
  // Skip middleware for auth routes
  if (request.nextUrl.pathname.startsWith('/auth/')) {
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

  // Subscription-protected routes
  const subscriptionRoutes = ['/search', '/sitesketcher', '/agencies/create']
  const isSubscriptionRoute = subscriptionRoutes.some(route =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
  )

  // Check individual listing pages (except user's own listings)
  const isListingPage = request.nextUrl.pathname.match(/^\/listings\/[^/]+$/)

  // For subscription routes, always redirect to pricing if no subscription
  // (whether logged in or not, since subscription is required)
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

          // Redirect to pricing with return URL
          const pricingUrl = new URL('/pricing', request.url)
          pricingUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
          pricingUrl.searchParams.set('reason', 'subscription_required')
          return NextResponse.redirect(pricingUrl)
        }
      } catch (error) {
        console.error('Subscription check error:', error)
        // On error, redirect to pricing to be safe
        const pricingUrl = new URL('/pricing', request.url)
        pricingUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
        return NextResponse.redirect(pricingUrl)
      }
    } else {
      // Not logged in - redirect to pricing (they'll need to sign up for subscription anyway)
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