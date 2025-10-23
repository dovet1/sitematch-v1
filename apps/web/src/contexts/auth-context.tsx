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
    refresh()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
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

          // Start periodic session validation
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
    try {
      const response = await fetch('/api/auth/update-session', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success && data.sessionId) {
        // Store session ID in localStorage and cookie for validation
        localStorage.setItem('session_id', data.sessionId)
        // Set cookie that expires in 30 days
        document.cookie = `session_id=${data.sessionId}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`
        console.log('Session ID stored:', data.sessionId)
      } else {
        console.error('Failed to get session ID:', data)
      }
    } catch (error) {
      console.error('Error updating session:', error)
      // Don't block login if session update fails
    }

    // Handle redirect after successful sign in
    if (redirectTo && redirectTo !== 'SKIP_REDIRECT') {
      router.push(redirectTo)
    } else if (!redirectTo || redirectTo !== 'SKIP_REDIRECT') {
      router.push('/occupier/dashboard')
    }
    // If redirectTo === 'SKIP_REDIRECT', don't redirect anywhere
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