import { createServerClient, createClientClient } from '@/lib/supabase'
import { DbOrganisation, OrganisationType } from '@/types/auth'

export interface CreateOrganizationData {
  name: string
  type: OrganisationType
  logo_url?: string
}

export interface UpdateOrganizationData {
  name?: string
  type?: OrganisationType
  logo_url?: string
}

export class OrganizationService {
  private supabase: any

  constructor(useServer = false) {
    this.supabase = useServer ? createServerClient() : createClientClient()
  }

  async createOrganization(data: CreateOrganizationData): Promise<DbOrganisation> {
    const { data: organization, error } = await this.supabase
      .from('organisations')
      .insert([data])
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create organization: ${error.message}`)
    }

    return organization
  }

  async getOrganization(id: string): Promise<DbOrganisation | null> {
    const { data, error } = await this.supabase
      .from('organisations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null // Not found
      }
      throw new Error(`Failed to get organization: ${error.message}`)
    }

    return data
  }

  async updateOrganization(id: string, data: UpdateOrganizationData): Promise<DbOrganisation> {
    const { data: organization, error } = await this.supabase
      .from('organisations')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update organization: ${error.message}`)
    }

    return organization
  }

  async deleteOrganization(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('organisations')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete organization: ${error.message}`)
    }
  }

  async getOrganizationUsers(orgId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('org_id', orgId)

    if (error) {
      throw new Error(`Failed to get organization users: ${error.message}`)
    }

    return data
  }

  async getUserOrganizations(userId: string): Promise<DbOrganisation[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select(`
        organisations (*)
      `)
      .eq('id', userId)

    if (error) {
      throw new Error(`Failed to get user organizations: ${error.message}`)
    }

    if (!data || !data[0]?.organisations) {
      return []
    }

    return [data[0].organisations] as DbOrganisation[]
  }

  async assignUserToOrganization(userId: string, orgId: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ 
        org_id: orgId,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      throw new Error(`Failed to assign user to organization: ${error.message}`)
    }
  }

  async removeUserFromOrganization(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ 
        org_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      throw new Error(`Failed to remove user from organization: ${error.message}`)
    }
  }

  async listOrganizations(type?: OrganisationType): Promise<DbOrganisation[]> {
    let query = this.supabase
      .from('organisations')
      .select('*')
      .order('name')

    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to list organizations: ${error.message}`)
    }

    return data || []
  }
}

// Convenience functions
export function createOrganizationService(useServer = false) {
  return new OrganizationService(useServer)
}

export async function getCurrentUserOrganization(): Promise<DbOrganisation | null> {
  const supabase = createClientClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('users')
    .select(`
      org_id,
      organisations!inner (*)
    `)
    .eq('id', user.id)
    .single()

  if (error || !data?.organisations) {
    return null
  }

  // organisations is an array due to the join, get the first one
  const org = Array.isArray(data.organisations) ? data.organisations[0] : data.organisations
  return org as DbOrganisation
}

export function isValidOrganizationType(type: string): type is OrganisationType {
  return ['occupier', 'landlord', 'agent'].includes(type)
}