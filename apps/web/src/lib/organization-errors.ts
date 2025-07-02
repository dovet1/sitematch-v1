import { OrganizationCreationResult } from '@/types/organization'

/**
 * User-friendly error messages for organization creation failures
 */
export const organizationErrorMessages = {
  DUPLICATE_NAME: 'An organization with this name already exists. We\'ve automatically adjusted the name to make it unique.',
  VALIDATION_ERROR: 'Please check that all required information is provided and try again.',
  DATABASE_ERROR: 'We encountered a technical issue while creating your organization. Please try again in a moment.',
  USER_ASSIGNMENT_ERROR: 'Your organization was created but we couldn\'t associate it with your account. Please contact support.',
} as const

/**
 * Get user-friendly error message from organization creation result
 */
export function getOrganizationErrorMessage(result: OrganizationCreationResult): string {
  if (result.success) {
    return ''
  }

  if (result.errorCode && result.errorCode in organizationErrorMessages) {
    return organizationErrorMessages[result.errorCode]
  }

  return result.error || 'An unexpected error occurred while creating your organization.'
}

/**
 * Check if an organization creation error is retryable
 */
export function isRetryableError(errorCode?: string): boolean {
  const retryableErrors = ['DATABASE_ERROR']
  return errorCode ? retryableErrors.includes(errorCode) : false
}

/**
 * Format organization creation success message
 */
export function getOrganizationSuccessMessage(
  organizationName: string, 
  wasNameModified: boolean
): string {
  const baseMessage = `Successfully created organization "${organizationName}".`
  
  if (wasNameModified) {
    return `${baseMessage} The name was automatically adjusted to ensure uniqueness.`
  }
  
  return baseMessage
}

/**
 * Organization creation retry handler
 */
export class OrganizationRetryHandler {
  private maxRetries = 3
  private retryDelay = 1000 // 1 second

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    isRetryable: (error: any) => boolean = () => true
  ): Promise<T> {
    let lastError: any
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        if (attempt === this.maxRetries || !isRetryable(error)) {
          throw error
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt))
      }
    }
    
    throw lastError
  }
}

export const organizationRetryHandler = new OrganizationRetryHandler()