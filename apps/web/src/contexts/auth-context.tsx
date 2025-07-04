'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthContextType, AuthUser, UserProfile, UserRole } from '@/types/auth'
import { createClientClient } from '@/lib/supabase'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClientClient()
  
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchingProfile, setFetchingProfile] = useState(false)

  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    // Prevent multiple simultaneous fetches
    if (fetchingProfile) {
      return null
    }

    try {
      setFetchingProfile(true)
      
      // Add timeout to prevent hanging
      const profilePromise = supabase
        .from('users')
        .select(`
          *,
          organisation:organisations(*)
        `)
        .eq('id', userId)
        .single()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      )

      const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any

      if (error) {
        console.warn('Profile fetch failed, retrying...', error.message)
        // Try one more time with a simpler query
        try {
          const { data: simpleData, error: simpleError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()
          
          if (simpleError) {
            console.error('Simple profile fetch also failed:', simpleError)
            return null
          }
          
          return simpleData as UserProfile
        } catch (retryError) {
          console.error('Retry profile fetch failed:', retryError)
          return null
        }
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
        setUser(null)
        setProfile(null)
        return
      }

      if (authUser) {
        const authUserWithMetadata = authUser as AuthUser
        setUser(authUserWithMetadata)
        
        const userProfile = await fetchUserProfile(authUser.id)
        setProfile(userProfile)
      } else {
        setUser(null)
        setProfile(null)
      }
    } catch (error) {
      console.error('Error refreshing auth state:', error)
      setUser(null)
      setProfile(null)
    } finally {
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
            return
          }

          setLoading(true)
          const authUser = session.user as AuthUser
          setUser(authUser)
          
          try {
            const userProfile = await fetchUserProfile(session.user.id)
            if (userProfile) {
              setProfile(userProfile)
            } else {
              // Create a fallback profile if database fetch fails
              setProfile({
                id: authUser.id,
                email: authUser.email || '',
                role: 'occupier',
                org_id: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            }
          } catch (error) {
            console.error('Failed to fetch user profile:', error)
          } finally {
            setLoading(false)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
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

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, redirectTo?: string) => {
    // Ensure consistent hostname for callback URL
    const origin = window.location.origin.replace('127.0.0.1', 'localhost')
    const callbackUrl = redirectTo || `${origin}/auth/callback`
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl
      }
    })

    if (error) {
      throw error
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
    
    setUser(null)
    setProfile(null)
    router.push('/')
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
    signOut,
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