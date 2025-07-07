import { createServerClient } from '@/lib/supabase'
import { UserRole, UserProfile } from '@/types/auth'
import { redirect } from 'next/navigation'

export async function getServerUser() {
  const supabase = createServerClient()
  
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    return user
  } catch (error) {
    console.error('Error getting server user:', error)
    return null
  }
}

export async function getServerUserProfile(): Promise<UserProfile | null> {
  const user = await getServerUser()
  
  if (!user) {
    return null
  }

  const supabase = createServerClient()
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, created_at, updated_at')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching server user profile:', error)
      return null
    }

    return data as UserProfile
  } catch (error) {
    console.error('Error fetching server user profile:', error)
    return null
  }
}

export async function requireAuth(redirectTo: string = '/login') {
  const user = await getServerUser()
  
  if (!user) {
    redirect(redirectTo)
  }
  
  return user
}

export async function requireRole(
  roles: UserRole | UserRole[],
  redirectTo: string = '/unauthorized'
) {
  const profile = await getServerUserProfile()
  
  if (!profile) {
    redirect('/login')
  }
  
  const rolesArray = Array.isArray(roles) ? roles : [roles]
  
  if (!rolesArray.includes(profile.role)) {
    redirect(redirectTo)
  }
  
  return profile
}

export async function requireAdmin(redirectTo: string = '/unauthorized') {
  return requireRole('admin', redirectTo)
}

export function isValidRole(role: string): role is UserRole {
  return role === 'occupier' || role === 'admin'
}

export function hasRole(userRole: UserRole, requiredRoles: UserRole | UserRole[]): boolean {
  const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
  return rolesArray.includes(userRole)
}

export function isAdmin(userRole: UserRole): boolean {
  return userRole === 'admin'
}

export function isOccupier(userRole: UserRole): boolean {
  return userRole === 'occupier'
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = createServerClient()
  
  try {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Get the user profile with role information
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, created_at, updated_at')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Error getting user profile:', profileError)
      return null
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role as UserRole,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}