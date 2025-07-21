import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/lib/supabase'
import { UserType } from '@/types/auth'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'
  const redirect = searchParams.get('redirect')
  const redirectTo = searchParams.get('redirect_to')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  console.log('Auth callback hit:', { 
    hasCode: !!code, 
    hasToken: !!token,
    type,
    next, 
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
    // Use redirect if provided, otherwise fall back to next
    const finalRedirect = redirect ? decodeURIComponent(redirect) : next
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

      // Get user_type from metadata if available
      const userTypeFromMetadata = user.user_metadata?.user_type
      console.log('User metadata:', user.user_metadata)
      console.log('User type from metadata:', userTypeFromMetadata)

      // If no profile exists, create one with user_type from metadata or default
      if (!profile) {
        console.log('No user profile found, creating default profile')
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email!,
            role: 'occupier',
            user_type: userTypeFromMetadata || 'Commercial Occupier' // Use metadata first, fallback to default
          })
        
        if (insertError) {
          console.error('Error creating user profile:', insertError)
        } else {
          console.log('User profile created successfully with user_type:', userTypeFromMetadata || 'Commercial Occupier')
        }
      } else if (userTypeFromMetadata && profile.user_type !== userTypeFromMetadata) {
        // If profile exists but user_type from metadata is different, update it
        console.log('Updating user_type from metadata:', userTypeFromMetadata)
        const { error: updateError } = await supabase
          .from('users')
          .update({ user_type: userTypeFromMetadata })
          .eq('id', user.id)
        
        if (updateError) {
          console.error('Error updating user_type:', updateError)
        } else {
          console.log('User type updated successfully to:', userTypeFromMetadata)
        }
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