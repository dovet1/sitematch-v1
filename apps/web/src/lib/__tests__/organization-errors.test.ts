import {
  getOrganizationErrorMessage,
  isRetryableError,
  getOrganizationSuccessMessage,
  OrganizationRetryHandler
} from '../organization-errors'
import { OrganizationCreationResult } from '@/types/organization'

describe('Organization Error Handling', () => {
  describe('getOrganizationErrorMessage', () => {
    it('should return empty string for successful result', () => {
      const result: OrganizationCreationResult = {
        success: true,
        organizationId: 'org-123',
        organizationName: 'Test Org'
      }

      expect(getOrganizationErrorMessage(result)).toBe('')
    })

    it('should return specific message for known error codes', () => {
      const result: OrganizationCreationResult = {
        success: false,
        errorCode: 'DUPLICATE_NAME',
        error: 'Duplicate detected'
      }

      const message = getOrganizationErrorMessage(result)
      expect(message).toContain('An organization with this name already exists')
    })

    it('should return generic message for unknown error codes', () => {
      const result: OrganizationCreationResult = {
        success: false,
        errorCode: 'UNKNOWN_ERROR' as any,
        error: 'Unknown issue'
      }

      const message = getOrganizationErrorMessage(result)
      expect(message).toBe('Unknown issue')
    })

    it('should return fallback message when no error provided', () => {
      const result: OrganizationCreationResult = {
        success: false
      }

      const message = getOrganizationErrorMessage(result)
      expect(message).toBe('An unexpected error occurred while creating your organization.')
    })

    it('should handle all defined error codes', () => {
      const errorCodes = ['DUPLICATE_NAME', 'VALIDATION_ERROR', 'DATABASE_ERROR', 'USER_ASSIGNMENT_ERROR']
      
      errorCodes.forEach(errorCode => {
        const result: OrganizationCreationResult = {
          success: false,
          errorCode: errorCode as any
        }
        
        const message = getOrganizationErrorMessage(result)
        expect(message.length).toBeGreaterThan(0)
        expect(message).not.toBe('An unexpected error occurred while creating your organization.')
      })
    })
  })

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError('DATABASE_ERROR')).toBe(true)
    })

    it('should identify non-retryable errors', () => {
      expect(isRetryableError('VALIDATION_ERROR')).toBe(false)
      expect(isRetryableError('DUPLICATE_NAME')).toBe(false)
      expect(isRetryableError('USER_ASSIGNMENT_ERROR')).toBe(false)
    })

    it('should handle undefined error codes', () => {
      expect(isRetryableError(undefined)).toBe(false)
      expect(isRetryableError('')).toBe(false)
    })
  })

  describe('getOrganizationSuccessMessage', () => {
    it('should return basic success message when name not modified', () => {
      const message = getOrganizationSuccessMessage('Test Company', false)
      
      expect(message).toBe('Successfully created organization "Test Company".')
    })

    it('should include modification notice when name was changed', () => {
      const message = getOrganizationSuccessMessage('Test Company (2)', true)
      
      expect(message).toContain('Successfully created organization "Test Company (2)"')
      expect(message).toContain('automatically adjusted to ensure uniqueness')
    })
  })

  describe('OrganizationRetryHandler', () => {
    let retryHandler: OrganizationRetryHandler

    beforeEach(() => {
      retryHandler = new OrganizationRetryHandler()
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should succeed on first try', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success')

      const promise = retryHandler.executeWithRetry(mockOperation)
      const result = await promise

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure and eventually succeed', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success')

      const promise = retryHandler.executeWithRetry(mockOperation)
      
      // Fast-forward timers for retry delay
      jest.advanceTimersByTime(1000)
      
      const result = await promise

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should respect max retries', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Persistent failure'))

      const promise = retryHandler.executeWithRetry(mockOperation)
      
      // Fast-forward through all retry delays
      jest.advanceTimersByTime(10000)
      
      await expect(promise).rejects.toThrow('Persistent failure')
      expect(mockOperation).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should respect isRetryable function', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Non-retryable error'))
      const isRetryable = jest.fn().mockReturnValue(false)

      const promise = retryHandler.executeWithRetry(mockOperation, isRetryable)
      
      await expect(promise).rejects.toThrow('Non-retryable error')
      expect(mockOperation).toHaveBeenCalledTimes(1) // No retries
      expect(isRetryable).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should increase delay between retries', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success')

      const promise = retryHandler.executeWithRetry(mockOperation)
      
      // First retry after 1 second
      jest.advanceTimersByTime(1000)
      await Promise.resolve() // Allow async operations to complete
      
      // Second retry after 2 more seconds (2 * 1000)
      jest.advanceTimersByTime(2000)
      
      const result = await promise

      expect(result).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(3)
    })
  })
})