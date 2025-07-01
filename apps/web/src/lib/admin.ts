import { createServerClient, createAdminClient } from '@/lib/supabase'
import { DbUser, UserRole } from '@/types/auth'

export interface AdminUserUpdate {
  role?: UserRole
  org_id?: string | null
}

export class AdminService {
  private supabase: any

  constructor() {
    this.supabase = createAdminClient()
  }

  async getAllUsers(): Promise<DbUser[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select(`
        *,
        organisation:organisations(*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get users: ${error.message}`)
    }

    return data || []
  }

  async updateUser(userId: string, updates: AdminUserUpdate): Promise<DbUser> {
    const { data, error } = await this.supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select(`
        *,
        organisation:organisations(*)
      `)
      .single()

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`)
    }

    return data
  }

  async promoteToAdmin(userId: string): Promise<DbUser> {
    return this.updateUser(userId, { role: 'admin' })
  }

  async demoteFromAdmin(userId: string): Promise<DbUser> {
    return this.updateUser(userId, { role: 'occupier' })
  }

  async assignUserToOrganization(userId: string, orgId: string): Promise<DbUser> {
    return this.updateUser(userId, { org_id: orgId })
  }

  async removeUserFromOrganization(userId: string): Promise<DbUser> {
    return this.updateUser(userId, { org_id: null })
  }

  async deleteUser(userId: string): Promise<void> {
    // First delete from public.users table
    const { error: userError } = await this.supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (userError) {
      throw new Error(`Failed to delete user profile: ${userError.message}`)
    }

    // Then delete from auth.users table
    const { error: authError } = await this.supabase.auth.admin.deleteUser(userId)

    if (authError) {
      throw new Error(`Failed to delete auth user: ${authError.message}`)
    }
  }

  async getUserStats() {
    const { data, error } = await this.supabase
      .from('users')
      .select('role')

    if (error) {
      throw new Error(`Failed to get user stats: ${error.message}`)
    }

    const stats = {
      total: data.length,
      admins: data.filter((u: DbUser) => u.role === 'admin').length,
      occupiers: data.filter((u: DbUser) => u.role === 'occupier').length,
    }

    return stats
  }
}

export function createAdminService() {
  return new AdminService()
}

export async function requireServerAdmin() {
  const supabase = createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return { user, profile }
}