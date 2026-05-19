import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/lib/supabase'
import { UserType } from '@/types/auth'

// Security: Validate return URLs to prevent open redirect vulnerabilities
function isValidReturnUrl(url: string): boolean {
  // Must be relative path starting with /
  if (!url || !url.startsWith('/')) return false
  // Reject protocol-relative URLs (//evil.com)
  if (url.startsWith('//')) return false
  // Reject data URLs or javascript:
  if (url.includes(':')) return false
  return true
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const redirect = searchParams.get('redirect') // OAuth redirects use 'redirect'
  const redirectTo = searchParams.get('redirect_to') // Password recovery uses 'redirect_to'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  console.log('Auth callback hit:', {
    hasCode: !!code,
    hasToken: !!token,
    type,
    redirect,
    redirectTo,
    origin,
    error,
    errorDescription
  })

  // Handle auth errors
  if (error) {
    console.error('Auth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=${error}`)
  }

  // Handle password recovery flow
  if (token && type === 'recovery') {
    const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/auth/reset-password'
    const response = NextResponse.redirect(`${origin}${finalRedirect}`)
    
    const supabase = createSSRServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            request.cookies.set({ name, value: '', ...options })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data: { user }, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery'
    })
    
    console.log('Recovery token verification result:', { success: !error, error, userId: user?.id })
    
    if (!error && user) {
      console.log('Password recovery session established, redirecting to:', `${origin}${finalRedirect}`)
      return response
    } else {
      console.error('Password recovery error:', error)
      return NextResponse.redirect(`${origin}/auth/auth-code-error?error=recovery_failed`)
    }
  }

  if (code) {
    // Validate and sanitize OAuth redirect URL
    let finalRedirect = '/new-dashboard' // Safe default

    if (redirect) {
      const decodedRedirect = decodeURIComponent(redirect)
      if (isValidReturnUrl(decodedRedirect)) {
        finalRedirect = decodedRedirect
        console.log('Using validated OAuth redirect:', finalRedirect)
      } else {
        console.warn('Invalid redirect URL rejected:', decodedRedirect, '- using default')
      }
    }

    const response = NextResponse.redirect(`${origin}${finalRedirect}`)
    
    const supabase = createSSRServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({ name, value, ...options })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            request.cookies.set({ name, value: '', ...options })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('Code exchange result:', { success: !error, error, userId: user?.id })
    
    if (!error && user) {
      // Set a cross-domain accessible cookie for mobile scenarios
      response.cookies.set('auth-success', 'true', {
        path: '/',
        maxAge: 300, // 5 minutes
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
      })

      // Check if user profile exists
      const { data: profile } = await supabase
        .from('users')
        .select('id, user_type')
        .eq('id', user.id)
        .single()

      // Log OAuth provider info
      const provider = user.app_metadata?.provider
      console.log('OAuth provider:', provider)

      // Profile should already exist from handle_new_user() trigger
      // Trigger creates profile with NULL user_type for OAuth users
      if (!profile) {
        console.log('No user profile found (unexpected - trigger should have created it), creating fallback profile')
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email!,
            role: 'occupier',
            user_type: null, // OAuth users get NULL user_type
            user_company_name: null,
            newsletter_opt_in: false
          })

        if (insertError) {
          console.error('Error creating fallback user profile:', insertError)
        } else {
          console.log('Fallback user profile created successfully for OAuth user')
        }
      } else {
        console.log('User profile exists (created by trigger):', {
          id: profile.id,
          user_type: profile.user_type
        })
      }

      // If redirecting to search, mark as just authenticated for toast
      if (finalRedirect.startsWith('/search')) {
        response.cookies.set('justAuthenticated', 'true', {
          path: '/',
          maxAge: 60, // 1 minute
          httpOnly: false
        })
      }

      console.log('Redirecting to:', `${origin}${finalRedirect}`)
      return response
    } else {
      console.error('Auth callback error:', error)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}