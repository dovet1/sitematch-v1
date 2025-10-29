'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthContextType, AuthUser, UserProfile, UserRole, UserType } from '@/types/auth'
import { createClientClient } from '@/lib/supabase'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClientClient()
  
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingProfile, setFetchingProfile] = useState(false)
  const [sessionCheckInterval, setSessionCheckInterval] = useState<NodeJS.Timeout | null>(null)

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    // Prevent multiple simultaneous fetches
    if (fetchingProfile) {
      return null
    }

    try {
      setFetchingProfile(true)
      
      // Shorter timeout for better UX - 3 seconds should be plenty
      const profilePromise = supabase
        .from('users')
        .select('id, email, role, user_type, newsletter_opt_in, created_at, updated_at')
        .eq('id', userId)
        .single()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      )

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any

      if (error) {
        console.warn('Profile fetch failed:', error.message)
        return null
      }

      return data as UserProfile
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    } finally {
      setFetchingProfile(false)
    }
  }

  const refresh = async () => {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser()
      
      if (error) {
        // Only log errors that aren't "Auth session missing" (which is normal on first load)
        if (error.message !== 'Auth session missing!') {
          console.error('Error getting user:', error)
        }
        // Also try getSession as backup
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (session?.user) {
          const authUserWithMetadata = session.user as AuthUser
          setUser(authUserWithMetadata)
          setLoading(false)
          return
        }
        
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      if (authUser) {
        const authUserWithMetadata = authUser as AuthUser
        setUser(authUserWithMetadata)
        
        // Fetch profile async - don't block user display
        fetchUserProfile(authUser.id).then(userProfile => {
          if (userProfile) {
            setProfile(userProfile)
          } else {
            // Create fallback profile from auth data
            setProfile({
              id: authUser.id,
              email: authUser.email || '',
              role: 'occupier',
              user_type: 'Other',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          }
        }).catch(error => {
          console.error('Failed to fetch profile:', error)
          // Still create fallback profile
          setProfile({
            id: authUser.id,
            email: authUser.email || '',
            role: 'occupier',
            user_type: 'Other',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        })
        
        // Set loading to false immediately after getting user
        setLoading(false)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    } catch (error) {
      console.error('Error refreshing auth state:', error)
      setUser(null)
      setProfile(null)
      setLoading(false)
    }
  }

  useEffect(() => {
    // Check if we're being logged out before doing anything
    let shouldContinue = true
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('logout_reason') === 'session_invalid') {
        // Clear local session data only - don't call supabase.auth.signOut()
        // as that would revoke the JWT globally and log out all devices
        console.log('[AUTH-CONTEXT] Session invalid detected, clearing local session')
        localStorage.removeItem('session_id')

        // Clear all possible session_id cookies
        document.cookie = 'session_id=; path=/; max-age=0; samesite=lax'
        document.cookie = 'session_id=; path=/; max-age=0'
        console.log('[AUTH-CONTEXT] Cleared session_id cookies')

        // Clear Supabase session locally only (scope: 'local')
        supabase.auth.signOut({ scope: 'local' }).then(() => {
          setUser(null)
          setProfile(null)
          setLoading(false)
        })
        shouldContinue = false
      }
    }

    if (!shouldContinue) {
      // Return empty cleanup function
      return () => {}
    }

    refresh()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          // For INITIAL_SESSION, double-check we're not in a logout flow
          if (event === 'INITIAL_SESSION' && typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search)
            if (urlParams.get('logout_reason') === 'session_invalid') {
              // Don't restore session, clear local session only
              console.log('Skipping session restoration due to logout_reason=session_invalid')
              await supabase.auth.signOut({ scope: 'local' })
              setUser(null)
              setProfile(null)
              setLoading(false)
              return
            }
          }

          // Skip if user is already set and same user
          if (user?.id === session.user.id && profile) {
            setLoading(false)
            return
          }

          const authUser = session.user as AuthUser
          setUser(authUser)

          // Fetch profile async - don't block user display
          fetchUserProfile(session.user.id).then(userProfile => {
            if (userProfile) {
              setProfile(userProfile)
            } else {
              // Create fallback profile from auth data
              setProfile({
                id: authUser.id,
                email: authUser.email || '',
                role: 'occupier',
                user_type: 'Other',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            }
          }).catch(error => {
            console.error('Failed to fetch profile:', error)
            // Still create fallback profile
            setProfile({
              id: authUser.id,
              email: authUser.email || '',
              role: 'occupier',
              user_type: 'Other',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
          })

          // Set loading to false immediately after setting user
          setLoading(false)

          // Only start session validation interval for new sign-ins
          // For INITIAL_SESSION, the middleware will handle immediate validation
          if (event === 'SIGNED_IN') {
            if (sessionCheckInterval) {
              clearInterval(sessionCheckInterval)
            }
            const interval = setInterval(async () => {
              try {
                const sessionId = localStorage.getItem('session_id')
                if (!sessionId) {
                  console.warn('No session ID found in localStorage')
                  return
                }

                const response = await fetch('/api/auth/validate-session', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ sessionId }),
                })
                const data = await response.json()

                if (!data.valid) {
                  // Session is invalid, redirect to logout
                  console.log('Session invalid, logging out. Reason:', data.reason)
                  router.push('/?logout_reason=session_invalid')
                }
              } catch (error) {
                console.error('Error validating session:', error)
              }
            }, 60000) // Check every 60 seconds
            setSessionCheckInterval(interval)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)

          // Clear session validation interval
          if (sessionCheckInterval) {
            clearInterval(sessionCheckInterval)
            setSessionCheckInterval(null)
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Only refresh if user is different
          if (user?.id !== session.user.id) {
            const authUser = session.user as AuthUser
            setUser(authUser)

            const userProfile = await fetchUserProfile(session.user.id)
            if (userProfile) {
              setProfile(userProfile)
            }
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval)
      }
    }
  }, [])

  const signIn = async (email: string, password: string, redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('Supabase auth error:', error)
      throw error
    }

    // Update the session ID in the database to invalidate other sessions
    let sessionId: string | null = null
    try {
      console.log('[AUTH-CONTEXT] Calling update-session API...')
      const response = await fetch('/api/auth/update-session', {
        method: 'POST',
        credentials: 'include' // Ensure cookies are included in request and response
      })
      const data = await response.json()

      if (data.success && data.sessionId) {
        sessionId = data.sessionId
        console.log('[AUTH-CONTEXT] Received session ID:', data.sessionId)

        // First, explicitly delete any existing session_id cookies
        // Try multiple variations to ensure all old cookies are removed
        const cookiesToClear = [
          'session_id=; path=/; max-age=0; samesite=lax',
          'session_id=; path=/; max-age=0; samesite=strict',
          'session_id=; path=/; max-age=0; samesite=none; secure',
          'session_id=; path=/; max-age=0',
          'session_id=; max-age=0',
        ]
        cookiesToClear.forEach(cookieStr => {
          document.cookie = cookieStr
        })
        console.log('[AUTH-CONTEXT] Cleared all existing session_id cookie variations')

        // Also clear from localStorage
        localStorage.removeItem('session_id')

        // Store session ID in localStorage for client-side validation
        localStorage.setItem('session_id', data.sessionId)
        console.log('[AUTH-CONTEXT] Stored in localStorage')

        // Note: Cookie is set by the server in the response, but we also set it client-side as backup
        document.cookie = `session_id=${data.sessionId}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`
        console.log('[AUTH-CONTEXT] Set NEW cookie via document.cookie')

        // Wait and verify cookie is set correctly
        let attempts = 0
        let cookieSet = false
        while (attempts < 10 && !cookieSet) {
          await new Promise(resolve => setTimeout(resolve, 50))
          const cookies = document.cookie.split(';').map(c => c.trim())
          const sessionCookie = cookies.find(c => c.startsWith('session_id='))

          if (sessionCookie && sessionCookie.includes(data.sessionId)) {
            cookieSet = true
            console.log('[AUTH-CONTEXT] Cookie verified after', attempts * 50, 'ms:', sessionCookie)
          } else {
            console.log('[AUTH-CONTEXT] Cookie check attempt', attempts + 1, ':', sessionCookie || 'NOT FOUND')
          }
          attempts++
        }

        if (!cookieSet) {
          console.error('[AUTH-CONTEXT] WARNING: Cookie was not set correctly after 500ms! This will cause logout.')
        }
      } else {
        console.error('[AUTH-CONTEXT] Failed to get session ID:', data)
      }
    } catch (error) {
      console.error('[AUTH-CONTEXT] Error updating session:', error)
      // Don't block login if session update fails
    }

    // Handle redirect after successful sign in
    // Use window.location.replace for a full page reload that replaces history
    // This ensures cookies are properly set and no race conditions occur
    const targetUrl = redirectTo && redirectTo !== 'SKIP_REDIRECT' ? redirectTo :
                      (!redirectTo || redirectTo !== 'SKIP_REDIRECT' ? '/occupier/dashboard' : null)

    if (targetUrl) {
      console.log('[AUTH-CONTEXT] Redirecting to:', targetUrl)
      // Add a small delay to ensure the Set-Cookie header is fully processed
      await new Promise(resolve => setTimeout(resolve, 200))
      // Use replace instead of href to prevent back button issues
      window.location.replace(targetUrl)
    } else {
      console.log('[AUTH-CONTEXT] No redirect, staying on current page')
    }
  }

  const signUp = async (email: string, password: string, companyName?: string, redirectTo?: string, newsletterOptIn?: boolean, userType?: string) => {
    console.log('signUp called with:', {
      email,
      companyName,
      userType,
      newsletterOptIn,
      newsletterOptInType: typeof newsletterOptIn
    })

    // First, sign up the user
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userType ? { user_type: userType } : undefined
      }
    })

    if (error) {
      console.error('Supabase signup error:', error)
      throw error
    }

    // If signup was successful and we have a user, create their profile
    if (data.user) {
      const profileData = {
        id: data.user.id,
        email: data.user.email!,
        role: 'occupier' as UserRole,
        user_company_name: companyName || null,
        user_type: userType as UserType || 'Other',
        newsletter_opt_in: newsletterOptIn || false,
      }

      console.log('Creating user profile with data:', profileData)

      const { error: profileError } = await supabase
        .from('users')
        .upsert([profileData], {
          onConflict: 'id'
        })

      if (profileError) {
        console.error('Error creating user profile:', profileError)
        // Don't throw here - the auth signup was successful, profile creation is secondary
      } else {
        console.log('User profile created successfully')
      }
    }

    // Auto sign in after successful signup (which will also update the session)
    await signIn(email, password, redirectTo)
  }

  const resetPassword = async (email: string) => {
    // Get the correct redirect URL dynamically
    let redirectUrl: string
    
    if (process.env.NEXT_PUBLIC_SITE_URL) {
      // Fallback to manual override
      redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
    } else if (typeof window !== 'undefined') {
      // Client-side fallback - use current origin
      redirectUrl = window.location.origin.replace('127.0.0.1', 'localhost')
    } else {
      // Server-side fallback for local development
      redirectUrl = 'http://localhost:3000'
    }
    
    console.log('Password reset redirect URL:', `${redirectUrl}/auth/reset-password`)
    console.log('Environment check:', {
      vercelUrl: process.env.VERCEL_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      finalUrl: redirectUrl
    })
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectUrl}/auth/reset-password`
    })

    if (error) {
      console.error('Password reset error:', error)
      throw error
    }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      console.error('Password update error:', error)
      throw error
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }

    // Clear stored session ID from localStorage and cookie
    localStorage.removeItem('session_id')
    document.cookie = 'session_id=; path=/; max-age=0'

    setUser(null)
    setProfile(null)
    // Use replace instead of push to avoid back button issues
    router.replace('/')
  }

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    if (!profile) return false
    
    const rolesArray = Array.isArray(roles) ? roles : [roles]
    return rolesArray.includes(profile.role)
  }

  const isAdmin = hasRole('admin')
  const isOccupier = hasRole('occupier')

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    hasRole,
    isAdmin,
    isOccupier,
    refresh
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}