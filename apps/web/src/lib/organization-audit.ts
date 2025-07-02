import { createAdminClient, Database } from '@/lib/supabase'

type OrganizationAuditInsert = Database['public']['Tables']['organization_audit']['Insert']
type OrganizationAuditAction = 'created' | 'updated' | 'merged'

interface OrganizationAuditMetadata {
  originalName?: string
  finalName?: string
  duplicateResolution?: boolean
  autoCreated?: boolean
  listingTriggered?: boolean
  errorDetails?: string
  [key: string]: any
}

export class OrganizationAuditService {
  private adminClient = createAdminClient()

  /**
   * Log organization creation event
   */
  async logOrganizationCreation(
    organizationId: string,
    createdByUserId: string,
    metadata: OrganizationAuditMetadata = {}
  ): Promise<{ success: boolean; error?: string }> {
    
    return this.logAuditEvent(organizationId, 'created', createdByUserId, {
      autoCreated: true,
      ...metadata
    })
  }

  /**
   * Log organization update event
   */
  async logOrganizationUpdate(
    organizationId: string,
    updatedByUserId: string,
    metadata: OrganizationAuditMetadata = {}
  ): Promise<{ success: boolean; error?: string }> {
    
    return this.logAuditEvent(organizationId, 'updated', updatedByUserId, metadata)
  }

  /**
   * Log organization merge event
   */
  async logOrganizationMerge(
    organizationId: string,
    mergedByUserId: string,
    metadata: OrganizationAuditMetadata = {}
  ): Promise<{ success: boolean; error?: string }> {
    
    return this.logAuditEvent(organizationId, 'merged', mergedByUserId, metadata)
  }

  /**
   * Generic audit event logging
   */
  private async logAuditEvent(
    organizationId: string,
    action: OrganizationAuditAction,
    userId: string,
    metadata: OrganizationAuditMetadata = {}
  ): Promise<{ success: boolean; error?: string }> {
    
    try {
      const auditRecord: OrganizationAuditInsert = {
        org_id: organizationId,
        action,
        created_by: userId,
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
          ...metadata
        }
      }

      const { error } = await this.adminClient
        .from('organization_audit')
        .insert(auditRecord)

      if (error) {
        console.error(`Failed to log organization ${action} event:`, error)
        return {
          success: false,
          error: `Audit logging failed: ${error.message}`
        }
      }

      console.log(`Organization ${action} event logged successfully`, {
        organizationId,
        action,
        userId
      })

      return { success: true }

    } catch (error) {
      console.error(`Unexpected error logging organization ${action} event:`, error)
      return {
        success: false,
        error: 'Unexpected error in audit logging'
      }
    }
  }

  /**
   * Get audit history for an organization
   */
  async getOrganizationAuditHistory(
    organizationId: string,
    limit: number = 50
  ): Promise<{
    success: boolean
    data?: Database['public']['Tables']['organization_audit']['Row'][]
    error?: string
  }> {
    
    try {
      const { data, error } = await this.adminClient
        .from('organization_audit')
        .select('*')
        .eq('org_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Failed to fetch organization audit history:', error)
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        data: data || []
      }

    } catch (error) {
      console.error('Unexpected error fetching audit history:', error)
      return {
        success: false,
        error: 'Unexpected error fetching audit history'
      }
    }
  }

  /**
   * Get organization creation metrics for admin dashboard
   */
  async getOrganizationCreationMetrics(
    startDate?: string,
    endDate?: string
  ): Promise<{
    success: boolean
    data?: {
      totalCreated: number
      autoCreated: number
      duplicateResolutions: number
      createdByDay: { date: string; count: number }[]
    }
    error?: string
  }> {
    
    try {
      let query = this.adminClient
        .from('organization_audit')
        .select('*')
        .eq('action', 'created')

      if (startDate) {
        query = query.gte('created_at', startDate)
      }
      if (endDate) {
        query = query.lte('created_at', endDate)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to fetch organization metrics:', error)
        return {
          success: false,
          error: error.message
        }
      }

      const records = data || []
      const totalCreated = records.length
      const autoCreated = records.filter(r => r.metadata?.autoCreated).length
      const duplicateResolutions = records.filter(r => r.metadata?.duplicateResolution).length

      // Group by day
      const createdByDay = records.reduce((acc, record) => {
        const date = record.created_at.split('T')[0] // Get date part only
        const existing = acc.find(item => item.date === date)
        if (existing) {
          existing.count++
        } else {
          acc.push({ date, count: 1 })
        }
        return acc
      }, [] as { date: string; count: number }[])

      return {
        success: true,
        data: {
          totalCreated,
          autoCreated,
          duplicateResolutions,
          createdByDay: createdByDay.sort((a, b) => a.date.localeCompare(b.date))
        }
      }

    } catch (error) {
      console.error('Unexpected error calculating metrics:', error)
      return {
        success: false,
        error: 'Unexpected error calculating metrics'
      }
    }
  }
}

// Singleton instance
export const organizationAuditService = new OrganizationAuditService()