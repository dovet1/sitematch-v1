import { createClient, createAdminClient } from '@/lib/supabase'
import { organizationAuditService } from '@/lib/organization-audit'
import { 
  OrganizationAutoCreationData, 
  OrganizationCreationResult,
  UserOrganizationInfo 
} from '@/types/organization'

export class OrganizationService {
  private supabase = createClient()
  private adminClient = createAdminClient()

  /**
   * Check if user already has an organization
   */
  async getUserOrganizationInfo(userId: string): Promise<UserOrganizationInfo> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('org_id, organisations(id, name)')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return { hasOrganization: false }
    }

    if (user.org_id && user.organisations) {
      return {
        hasOrganization: true,
        organizationId: user.org_id,
        organizationName: (user.organisations as any).name
      }
    }

    return { hasOrganization: false }
  }

  /**
   * Create organization from company info with automatic unique name resolution
   */
  async createOrganizationFromCompanyInfo(
    data: OrganizationAutoCreationData
  ): Promise<OrganizationCreationResult> {
    try {
      // Ensure unique organization name
      const originalName = data.name.trim()
      const uniqueName = await this.ensureUniqueOrganizationName(originalName)
      const nameWasModified = uniqueName !== originalName

      // Create organization with admin client for elevated permissions
      const { data: org, error: orgError } = await this.adminClient
        .from('organisations')
        .insert({
          name: uniqueName,
          type: data.type,
        })
        .select()
        .single()

      if (orgError) {
        console.error('Organization creation error:', orgError)
        
        // Log audit event for failed creation - note: using placeholder ID since org wasn't created
        console.log('Failed to create organization:', {
          originalName,
          finalName: uniqueName,
          errorDetails: orgError.message,
          duplicateResolution: nameWasModified,
          userId: data.createdByUserId
        })

        return {
          success: false,
          error: 'Failed to create organization',
          errorCode: 'DATABASE_ERROR'
        }
      }

      // Assign user to organization
      const assignmentResult = await this.assignUserToOrganization(
        data.createdByUserId, 
        org.id
      )

      if (!assignmentResult.success) {
        // Rollback organization creation if user assignment fails
        await this.adminClient
          .from('organisations')
          .delete()
          .eq('id', org.id)

        // Log audit event for failed assignment
        await organizationAuditService.logOrganizationCreation(
          org.id,
          data.createdByUserId,
          {
            originalName,
            finalName: uniqueName,
            duplicateResolution: nameWasModified,
            errorDetails: assignmentResult.error,
            rollbackPerformed: true
          }
        )

        return {
          success: false,
          error: assignmentResult.error,
          errorCode: 'USER_ASSIGNMENT_ERROR'
        }
      }

      // Log successful organization creation
      await organizationAuditService.logOrganizationCreation(
        org.id,
        data.createdByUserId,
        {
          originalName,
          finalName: uniqueName,
          duplicateResolution: nameWasModified,
          listingTriggered: true
        }
      )

      return {
        success: true,
        organizationId: org.id,
        organizationName: org.name
      }

    } catch (error) {
      console.error('Unexpected error in organization creation:', error)
      return {
        success: false,
        error: 'Unexpected error during organization creation',
        errorCode: 'DATABASE_ERROR'
      }
    }
  }

  /**
   * Ensure organization name is unique by appending numbers if needed
   */
  async ensureUniqueOrganizationName(baseName: string): Promise<string> {
    let name = baseName.trim()
    let counter = 1

    while (await this.organizationNameExists(name)) {
      counter++
      name = `${baseName} (${counter})`
    }

    return name
  }

  /**
   * Check if organization name already exists
   */
  private async organizationNameExists(name: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('organisations')
      .select('id')
      .eq('name', name)
      .maybeSingle()

    if (error) {
      console.error('Error checking organization name:', error)
      return false // Assume doesn't exist on error to allow creation
    }

    return !!data
  }

  /**
   * Assign user to organization by updating their org_id
   */
  async assignUserToOrganization(
    userId: string, 
    organizationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.adminClient
        .from('users')
        .update({ 
          org_id: organizationId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('User assignment error:', error)
        return {
          success: false,
          error: 'Failed to assign user to organization'
        }
      }

      return { success: true }

    } catch (error) {
      console.error('Unexpected error in user assignment:', error)
      return {
        success: false,
        error: 'Unexpected error during user assignment'
      }
    }
  }

  /**
   * Validate organization creation data
   */
  validateOrganizationData(data: OrganizationAutoCreationData): { valid: boolean; error?: string } {
    if (!data.name || data.name.trim().length === 0) {
      return { valid: false, error: 'Organization name is required' }
    }

    if (data.name.trim().length > 255) {
      return { valid: false, error: 'Organization name is too long (max 255 characters)' }
    }

    if (!data.createdByUserId) {
      return { valid: false, error: 'User ID is required' }
    }

    return { valid: true }
  }
}

// Singleton instance
export const organizationService = new OrganizationService()