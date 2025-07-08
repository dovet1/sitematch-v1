import { createServerClient, createAdminClient } from '@/lib/supabase'
import { DbUser, UserRole } from '@/types/auth'

export interface AdminUserUpdate {
  role?: UserRole
  org_id?: string | null
}

export interface CreateOrganizationData {
  name: string
  type: 'occupier' | 'landlord' | 'agent'
}

export interface Organization {
  id: string
  name: string
  type: 'occupier' | 'landlord' | 'agent'
  logo_url: string | null
  created_at: string
  updated_at: string
}

export class AdminService {
  private supabase: any

  constructor() {
    this.supabase = createAdminClient()
  }

  async getAllUsers(): Promise<DbUser[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
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
      .select('*')
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

  async getModerationStats() {
    const { data, error } = await this.supabase
      .from('listings')
      .select('status, created_at')

    if (error) {
      console.warn('Failed to get moderation stats, returning defaults:', error.message)
      return {
        pending: 0,
        approvedToday: 0,
        totalListings: 0
      }
    }

    const today = new Date().toDateString()
    
    const stats = {
      pending: data.filter((l: any) => l.status === 'pending').length,
      approvedToday: data.filter((l: any) => 
        l.status === 'approved' && 
        new Date(l.created_at).toDateString() === today
      ).length,
      totalListings: data.length
    }

    return stats
  }

  async getAllListings() {
    // Get listings first
    const { data: listings, error } = await this.supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Failed to get listings:', error.message)
      return []
    }

    if (!listings || listings.length === 0) {
      return []
    }

    // Get reference data separately to avoid RLS issues with joins
    const { data: sectors } = await this.supabase
      .from('sectors')
      .select('id, name')

    const { data: useClasses } = await this.supabase
      .from('use_classes')
      .select('id, code, name')

    const { data: users } = await this.supabase
      .from('users')
      .select('id, email')

    // Create lookup maps
    const sectorsMap = new Map(sectors?.map((s: any) => [s.id, s]) || [])
    const useClassesMap = new Map(useClasses?.map((uc: any) => [uc.id, uc]) || [])
    const usersMap = new Map(users?.map((u: any) => [u.id, u]) || [])

    // Join data in JavaScript
    const listingsWithJoins = listings.map((listing: any) => ({
      ...listing,
      sectors: sectorsMap.get(listing.sector_id) || null,
      use_classes: useClassesMap.get(listing.use_class_id) || null,
      users: usersMap.get(listing.created_by) || null
    }))

    return listingsWithJoins
  }

  async getListingById(id: string) {
    // Get individual listing
    const { data: listing, error } = await this.supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      throw new Error(`Failed to get listing: ${error.message}`)
    }

    if (!listing) {
      return null
    }

    // Get reference data
    const { data: sectors } = await this.supabase
      .from('sectors')
      .select('id, name, description')

    const { data: useClasses } = await this.supabase
      .from('use_classes')
      .select('id, code, name, description')

    const { data: users } = await this.supabase
      .from('users')
      .select('id, email')

    // Get related data
    const { data: locations } = await this.supabase
      .from('listing_locations')
      .select('*')
      .eq('listing_id', id)

    const { data: faqs } = await this.supabase
      .from('faqs')
      .select('*')
      .eq('listing_id', id)
      .order('display_order')

    // Get all contacts (primary and additional)
    const { data: allContacts } = await this.supabase
      .from('listing_contacts')
      .select('*')
      .eq('listing_id', id)

    // Get file uploads associated with this listing
    const { data: fileUploads } = await this.supabase
      .from('file_uploads')
      .select('*')
      .eq('listing_id', id)

    // Create lookup maps
    const sectorsMap = new Map(sectors?.map((s: any) => [s.id, s]) || [])
    const useClassesMap = new Map(useClasses?.map((uc: any) => [uc.id, uc]) || [])
    const usersMap = new Map(users?.map((u: any) => [u.id, u]) || [])

    // Process file uploads by type
    const logoFiles = fileUploads?.filter((file: any) => file.file_type === 'logo') || []
    const headshotFiles = fileUploads?.filter((file: any) => file.file_type === 'headshot') || []
    const brochureFiles = fileUploads?.filter((file: any) => file.file_type === 'brochure') || []
    const sitePlanFiles = fileUploads?.filter((file: any) => ['sitePlan', 'site_plan'].includes(file.file_type)) || []
    const fitOutFiles = fileUploads?.filter((file: any) => ['fitOut', 'fit_out'].includes(file.file_type)) || []
    const mediaFiles = fileUploads?.filter((file: any) => ['image', 'video', 'pdf'].includes(file.file_type)) || []

    // Process contacts - separate primary from additional and link headshots
    let primaryContact = allContacts?.find((contact: any) => contact.is_primary_contact) || null
    let additionalContacts = allContacts?.filter((contact: any) => !contact.is_primary_contact) || []
    
    // Link headshot files to contacts using is_primary flag
    if (headshotFiles.length > 0) {
      // Find primary contact's headshot using is_primary flag
      const primaryHeadshot = headshotFiles.find((file: any) => file.is_primary === true)
      if (primaryContact && !primaryContact.headshot_url && primaryHeadshot) {
        primaryContact = {
          ...primaryContact,
          headshot_url: `https://***REMOVED***.supabase.co/storage/v1/object/public/${primaryHeadshot.bucket_name}/${primaryHeadshot.file_path}`
        }
      }
      
      // Find additional contacts' headshots using is_primary flag
      const additionalHeadshots = headshotFiles.filter((file: any) => file.is_primary === false)
      additionalContacts = additionalContacts.map((contact: any, index: number) => {
        if (!contact.headshot_url && additionalHeadshots[index]) {
          return {
            ...contact,
            headshot_url: `https://***REMOVED***.supabase.co/storage/v1/object/public/${additionalHeadshots[index].bucket_name}/${additionalHeadshots[index].file_path}`
          }
        }
        return contact
      })
    }

    // Join data
    const listingWithDetails = {
      ...listing,
      sectors: sectorsMap.get(listing.sector_id) || null,
      use_classes: useClassesMap.get(listing.use_class_id) || null,
      users: usersMap.get(listing.created_by) || null,
      locations: locations || [],
      faqs: faqs || [],
      // Contact information
      primary_contact: primaryContact,
      additional_contacts: additionalContacts,
      // File information organized by type - generate proper URLs
      logo_url: logoFiles?.[0] ? `https://***REMOVED***.supabase.co/storage/v1/object/public/${logoFiles[0].bucket_name}/${logoFiles[0].file_path}` : (listing.logo_url || null),
      brochure_url: brochureFiles?.[0] ? `https://***REMOVED***.supabase.co/storage/v1/object/public/${brochureFiles[0].bucket_name}/${brochureFiles[0].file_path}` : (listing.brochure_url || null),
      company_logos: logoFiles.slice(1).map((file: any) => ({
        id: file.id,
        file_url: `https://***REMOVED***.supabase.co/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
        file_name: file.file_name,
        file_size: file.file_size
      })),
      listing_documents: [...sitePlanFiles, ...fitOutFiles, ...brochureFiles].map((file: any) => ({
        id: file.id,
        document_type: file.file_type,
        file_url: `https://***REMOVED***.supabase.co/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
        file_name: file.file_name,
        file_size: file.file_size
      })),
      media_files: mediaFiles.map((file: any) => ({
        id: file.id,
        file_type: file.file_type,
        file_url: `https://***REMOVED***.supabase.co/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
        file_name: file.file_name,
        file_size: file.file_size
      })),
      // All files for debugging
      all_files: fileUploads || []
    }

    return listingWithDetails
  }

  async getAllOrganizations(): Promise<Organization[]> {
    const { data, error } = await this.supabase
      .from('organisations')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get organizations: ${error.message}`)
    }

    return data || []
  }

  async createOrganization(orgData: CreateOrganizationData): Promise<Organization> {
    const { data, error } = await this.supabase
      .from('organisations')
      .insert({
        name: orgData.name,
        type: orgData.type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create organization: ${error.message}`)
    }

    return data
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