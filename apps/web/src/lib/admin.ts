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
    // Get listings first - include rejected listings from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
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

    // Get junction table data for all listings
    const listingIds = listings.map((l: any) => l.id);
    
    const { data: allListingSectors } = await this.supabase
      .from('listing_sectors')
      .select(`
        listing_id,
        sector:sectors(id, name)
      `)
      .in('listing_id', listingIds)

    const { data: allListingUseClasses } = await this.supabase
      .from('listing_use_classes')
      .select(`
        listing_id,
        use_class:use_classes(id, code, name)
      `)
      .in('listing_id', listingIds)

    // Get pending review versions for all listings
    const { data: allListingVersions } = await this.supabase
      .from('listing_versions')
      .select('id, listing_id, status')
      .eq('status', 'pending_review')
      .in('listing_id', listingIds)
    
    // Get latest rejected versions to show recently rejected listings
    const { data: rejectedVersions } = await this.supabase
      .from('listing_versions')
      .select('listing_id, status, reviewed_at, review_notes')
      .eq('status', 'rejected')
      .gte('reviewed_at', sevenDaysAgo.toISOString())
      .in('listing_id', listingIds)

    // Get all rejected versions to identify resubmissions
    const { data: allRejectedVersions } = await this.supabase
      .from('listing_versions')
      .select('listing_id, status, reviewed_at, review_notes')
      .eq('status', 'rejected')
      .in('listing_id', listingIds)

    // Create lookup maps
    const sectorsMap = new Map(sectors?.map((s: any) => [s.id, s]) || [])
    const useClassesMap = new Map(useClasses?.map((uc: any) => [uc.id, uc]) || [])
    const usersMap = new Map(users?.map((u: any) => [u.id, u]) || [])

    // Create junction data maps
    const listingSectorsMap = new Map<string, any[]>();
    const listingUseClassesMap = new Map<string, any[]>();
    const listingVersionsMap = new Map<string, string>();
    const rejectedVersionsMap = new Map<string, any>();
    const allRejectedVersionsMap = new Map<string, any[]>();

    allListingSectors?.forEach((ls: any) => {
      if (!listingSectorsMap.has(ls.listing_id)) {
        listingSectorsMap.set(ls.listing_id, []);
      }
      if (ls.sector) {
        listingSectorsMap.get(ls.listing_id)!.push(ls.sector);
      }
    });

    allListingUseClasses?.forEach((luc: any) => {
      if (!listingUseClassesMap.has(luc.listing_id)) {
        listingUseClassesMap.set(luc.listing_id, []);
      }
      if (luc.use_class) {
        listingUseClassesMap.get(luc.listing_id)!.push(luc.use_class);
      }
    });

    allListingVersions?.forEach((version: any) => {
      listingVersionsMap.set(version.listing_id, version.id);
    });

    rejectedVersions?.forEach((version: any) => {
      rejectedVersionsMap.set(version.listing_id, version);
    });

    // Group all rejected versions by listing_id to count rejections
    allRejectedVersions?.forEach((version: any) => {
      if (!allRejectedVersionsMap.has(version.listing_id)) {
        allRejectedVersionsMap.set(version.listing_id, []);
      }
      allRejectedVersionsMap.get(version.listing_id)!.push(version);
    });

    // Join data in JavaScript - support both junction tables and legacy single relationships
    const listingsWithJoins = listings.map((listing: any) => {
      const sectorsFromJunction = listingSectorsMap.get(listing.id) || [];
      const useClassesFromJunction = listingUseClassesMap.get(listing.id) || [];
      const rejectedVersion = rejectedVersionsMap.get(listing.id);
      const allRejectedForListing = allRejectedVersionsMap.get(listing.id) || [];

      return {
        ...listing,
        // Use junction table data if available, fallback to single relationships
        sectors: sectorsFromJunction.length > 0 ? sectorsFromJunction : (sectorsMap.get(listing.sector_id) ? [sectorsMap.get(listing.sector_id)] : []),
        use_classes: useClassesFromJunction.length > 0 ? useClassesFromJunction : (useClassesMap.get(listing.use_class_id) ? [useClassesMap.get(listing.use_class_id)] : []),
        users: usersMap.get(listing.created_by) || null,
        pending_version_id: listingVersionsMap.get(listing.id) || null,
        // Add rejection info for recently rejected listings
        recent_rejection: rejectedVersion ? {
          reviewed_at: rejectedVersion.reviewed_at,
          review_notes: rejectedVersion.review_notes
        } : null,
        // Mark as recently rejected if it has a rejected version within 7 days
        is_recently_rejected: !!rejectedVersion,
        // Mark as resubmission if status is pending and has previous rejections
        is_resubmission: listing.status === 'pending' && allRejectedForListing.length > 0,
        // Count of previous rejections
        rejection_count: allRejectedForListing.length,
        // Most recent rejection details for resubmissions
        previous_rejection: allRejectedForListing.length > 0 ? allRejectedForListing
          .sort((a: any, b: any) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())[0] : null
      };
    })

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

    // Get junction table data for multiple sectors and use classes
    const { data: listingSectors } = await this.supabase
      .from('listing_sectors')
      .select(`
        sector:sectors(id, name, description)
      `)
      .eq('listing_id', id)

    const { data: listingUseClasses } = await this.supabase
      .from('listing_use_classes')
      .select(`
        use_class:use_classes(id, code, name, description)
      `)
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
    
    // If no primary contact in listing_contacts, create one from main listing data
    if (!primaryContact) {
      primaryContact = {
        contact_name: listing.contact_name,
        contact_title: listing.contact_title,
        contact_email: listing.contact_email,
        contact_phone: listing.contact_phone,
        is_primary_contact: true,
        headshot_url: null
      }
    }
    
    // Link headshot files to contacts using is_primary flag
    if (headshotFiles.length > 0) {
      // Find primary contact's headshot using is_primary flag
      const primaryHeadshot = headshotFiles.find((file: any) => file.is_primary === true)
      if (primaryContact && primaryHeadshot) {
        primaryContact = {
          ...primaryContact,
          headshot_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${primaryHeadshot.bucket_name}/${primaryHeadshot.file_path}`
        }
      }
      
      // Find additional contacts' headshots using is_primary flag
      const additionalHeadshots = headshotFiles.filter((file: any) => file.is_primary === false)
      additionalContacts = additionalContacts.map((contact: any, index: number) => {
        if (!contact.headshot_url && additionalHeadshots[index]) {
          return {
            ...contact,
            headshot_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${additionalHeadshots[index].bucket_name}/${additionalHeadshots[index].file_path}`
          }
        }
        return contact
      })
    }

    // Join data - support both junction tables (new) and single relationships (legacy)
    const sectorsFromJunction = listingSectors?.map((ls: any) => ls.sector).filter(Boolean) || [];
    const useClassesFromJunction = listingUseClasses?.map((luc: any) => luc.use_class).filter(Boolean) || [];
    
    const listingWithDetails = {
      ...listing,
      // Use junction table data if available, fallback to single relationships
      sectors: sectorsFromJunction.length > 0 ? sectorsFromJunction : (sectorsMap.get(listing.sector_id) ? [sectorsMap.get(listing.sector_id)] : []),
      use_classes: useClassesFromJunction.length > 0 ? useClassesFromJunction : (useClassesMap.get(listing.use_class_id) ? [useClassesMap.get(listing.use_class_id)] : []),
      users: usersMap.get(listing.created_by) || null,
      locations: locations || [],
      faqs: faqs || [],
      // Contact information
      primary_contact: primaryContact,
      additional_contacts: additionalContacts,
      // File information organized by type - generate proper URLs
      logo_url: logoFiles?.[0] ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${logoFiles[0].bucket_name}/${logoFiles[0].file_path}` : (listing.logo_url || null),
      brochure_url: brochureFiles?.[0] ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${brochureFiles[0].bucket_name}/${brochureFiles[0].file_path}` : (listing.brochure_url || null),
      company_logos: logoFiles.slice(1).map((file: any) => ({
        id: file.id,
        file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
        file_name: file.file_name,
        file_size: file.file_size
      })),
      listing_documents: [...sitePlanFiles, ...fitOutFiles, ...brochureFiles].map((file: any) => ({
        id: file.id,
        document_type: file.file_type,
        file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
        file_name: file.file_name,
        file_size: file.file_size
      })),
      media_files: mediaFiles.map((file: any) => ({
        id: file.id,
        file_type: file.file_type,
        file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${file.bucket_name}/${file.file_path}`,
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