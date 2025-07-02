// =====================================================
// Enhanced Error Handling Hook - QA Enhancement
// Comprehensive error handling with user feedback
// =====================================================

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface ErrorDetails {
  code?: string;
  message: string;
  field?: string;
  type: 'validation' | 'network' | 'server' | 'permission' | 'unknown';
  retryable: boolean;
  timestamp: Date;
}

export interface ErrorHandlingState {
  errors: Record<string, ErrorDetails>;
  isShowingError: boolean;
  retryCount: number;
}

interface ErrorHandlingOptions {
  maxRetries?: number;
  showToast?: boolean;
  logErrors?: boolean;
  onError?: (error: ErrorDetails) => void;
}

export function useErrorHandling(options: ErrorHandlingOptions = {}) {
  const {
    maxRetries = 3,
    showToast = true,
    logErrors = true,
    onError
  } = options;

  const [state, setState] = useState<ErrorHandlingState>({
    errors: {},
    isShowingError: false,
    retryCount: 0
  });

  // Clear specific error
  const clearError = useCallback((key: string) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [key]: undefined as any
      }
    }));
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: {},
      isShowingError: false
    }));
  }, []);

  // Handle different types of errors
  const handleError = useCallback((
    error: Error | string | unknown,
    context: {
      key?: string;
      field?: string;
      action?: string;
      retryable?: boolean;
    } = {}
  ) => {
    const { key = 'general', field, action = 'operation', retryable = false } = context;
    
    let errorDetails: ErrorDetails;

    if (error instanceof Error) {
      errorDetails = {
        message: error.message,
        code: (error as any).code,
        field,
        type: determineErrorType(error),
        retryable: retryable || isRetryableError(error),
        timestamp: new Date()
      };
    } else if (typeof error === 'string') {
      errorDetails = {
        message: error,
        field,
        type: 'unknown',
        retryable,
        timestamp: new Date()
      };
    } else {
      errorDetails = {
        message: `An unexpected error occurred during ${action}`,
        field,
        type: 'unknown',
        retryable,
        timestamp: new Date()
      };
    }

    // Log error if enabled
    if (logErrors) {
      console.error(`Error [${key}]:`, errorDetails, error);
    }

    // Update state
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [key]: errorDetails
      },
      isShowingError: true
    }));

    // Show toast notification
    if (showToast) {
      const toastMessage = getUserFriendlyMessage(errorDetails);
      
      if (errorDetails.type === 'validation') {
        toast.error(toastMessage, {
          description: 'Please check your input and try again.',
          duration: 5000
        });
      } else if (errorDetails.retryable) {
        toast.error(toastMessage, {
          description: 'You can try again in a moment.',
          action: {
            label: 'Retry',
            onClick: () => {
              // Emit retry event - parent can listen to this
              window.dispatchEvent(new CustomEvent(`error-retry-${key}`, { detail: errorDetails }));
            }
          },
          duration: 8000
        });
      } else {
        toast.error(toastMessage, {
          description: 'Please contact support if this persists.',
          duration: 10000
        });
      }
    }

    // Call custom error handler
    onError?.(errorDetails);

    return errorDetails;
  }, [showToast, logErrors, onError]);

  // Handle form validation errors
  const handleValidationErrors = useCallback((errors: Record<string, string>) => {
    const errorDetails: Record<string, ErrorDetails> = {};
    
    Object.entries(errors).forEach(([field, message]) => {
      errorDetails[field] = {
        message,
        field,
        type: 'validation',
        retryable: false,
        timestamp: new Date()
      };
    });

    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        ...errorDetails
      },
      isShowingError: Object.keys(errorDetails).length > 0
    }));

    if (showToast && Object.keys(errorDetails).length > 0) {
      toast.error('Please correct the form errors', {
        description: `${Object.keys(errorDetails).length} field(s) need attention.`,
        duration: 5000
      });
    }

    return errorDetails;
  }, [showToast]);

  // Handle API/network errors with retry logic
  const handleApiError = useCallback(async <T>(
    apiCall: () => Promise<T>,
    context: {
      key?: string;
      action?: string;
      onRetry?: () => void;
    } = {}
  ): Promise<T | null> => {
    const { key = 'api', action = 'API call', onRetry } = context;
    
    try {
      const result = await apiCall();
      
      // Clear error on success
      clearError(key);
      setState(prev => ({ ...prev, retryCount: 0 }));
      
      return result;
    } catch (error) {
      const errorDetails = handleError(error, {
        key,
        action,
        retryable: true
      });

      // Auto-retry logic for retryable errors
      if (errorDetails.retryable && state.retryCount < maxRetries) {
        setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, state.retryCount), 10000);
        
        setTimeout(async () => {
          onRetry?.();
          toast.info(`Retrying ${action}... (${state.retryCount + 1}/${maxRetries})`, {
            duration: 3000
          });
          
          return handleApiError(apiCall, context);
        }, delay);
      }

      return null;
    }
  }, [handleError, clearError, maxRetries, state.retryCount]);

  // Get error message for a specific field/key
  const getError = useCallback((key: string): ErrorDetails | undefined => {
    return state.errors[key];
  }, [state.errors]);

  // Check if there are any errors
  const hasErrors = Object.values(state.errors).some(error => error !== undefined);

  // Get all field errors for form display
  const getFieldErrors = (): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};
    
    Object.entries(state.errors).forEach(([key, error]) => {
      if (error && error.field) {
        fieldErrors[error.field] = error.message;
      }
    });
    
    return fieldErrors;
  };

  return {
    // State
    errors: state.errors,
    hasErrors,
    isShowingError: state.isShowingError,
    retryCount: state.retryCount,
    
    // Actions
    handleError,
    handleValidationErrors,
    handleApiError,
    clearError,
    clearAllErrors,
    getError,
    getFieldErrors
  };
}

// Helper functions
function determineErrorType(error: Error): ErrorDetails['type'] {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'network';
  }
  
  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return 'permission';
  }
  
  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation';
  }
  
  if (message.includes('server') || error.name === 'ServerError') {
    return 'server';
  }
  
  return 'unknown';
}

function isRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /503/,  // Service unavailable
    /502/,  // Bad gateway
    /500/,  // Internal server error
    /429/   // Too many requests
  ];
  
  return retryablePatterns.some(pattern => 
    pattern.test(error.message) || pattern.test(error.name)
  );
}

function getUserFriendlyMessage(error: ErrorDetails): string {
  switch (error.type) {
    case 'network':
      return 'Connection issue - please check your internet';
    case 'validation':
      return error.message;
    case 'permission':
      return 'You don\'t have permission for this action';
    case 'server':
      return 'Server is experiencing issues';
    default:
      return error.message || 'Something unexpected happened';
  }
}