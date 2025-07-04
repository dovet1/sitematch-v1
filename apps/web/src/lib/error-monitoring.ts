// =====================================================
// Error Monitoring Service - Story 3.1 Enhancement
// Centralized error reporting and monitoring
// =====================================================

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  route?: string;
  component?: string;
  action?: string;
  userAgent?: string;
  timestamp?: string;
  buildVersion?: string;
  [key: string]: any;
}

export interface ErrorEvent {
  id: string;
  type: 'javascript' | 'network' | 'validation' | 'authentication' | 'form' | 'file_upload';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  stack?: string;
  context: ErrorContext;
  fingerprint?: string; // For error grouping
  retryCount?: number;
}

class ErrorMonitoringService {
  private errors: ErrorEvent[] = [];
  private maxErrors = 100; // Keep last 100 errors in memory
  private isInitialized = false;

  initialize(config: { userId?: string; sessionId?: string }) {
    this.isInitialized = true;
    
    // Set up global error handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('error', this.handleGlobalError.bind(this));
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    }
    
    console.log('Error monitoring initialized', config);
  }

  private handleGlobalError(event: Event) {
    this.captureError({
      type: 'javascript',
      severity: 'high',
      message: (event as any).message || 'Unknown error',
      stack: (event as any).error?.stack,
      context: {
        filename: (event as any).filename,
        lineNumber: (event as any).lineno,
        columnNumber: (event as any).colno,
        timestamp: new Date().toISOString()
      }
    });
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    this.captureError({
      type: 'javascript',
      severity: 'high',
      message: `Unhandled Promise Rejection: ${event.reason}`,
      stack: event.reason?.stack,
      context: {
        type: 'unhandledrejection',
        timestamp: new Date().toISOString()
      }
    });
  }

  captureError(error: Partial<ErrorEvent> & { message: string; type: ErrorEvent['type'] }): string {
    const errorId = this.generateErrorId();
    
    const errorEvent: ErrorEvent = {
      id: errorId,
      type: error.type,
      severity: error.severity || 'medium',
      message: error.message,
      stack: error.stack,
      context: {
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
        buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION,
        ...error.context
      },
      fingerprint: this.generateFingerprint(error.message, error.stack),
      retryCount: error.retryCount || 0
    };

    // Add to local storage
    this.errors.push(errorEvent);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', errorEvent);
    }

    // Send to monitoring service (placeholder)
    this.sendToMonitoringService(errorEvent);

    return errorId;
  }

  captureFormError(formId: string, field: string, error: string, context?: ErrorContext): string {
    return this.captureError({
      type: 'form',
      severity: 'low',
      message: `Form validation error in ${formId}.${field}: ${error}`,
      context: {
        formId,
        field,
        errorType: 'validation',
        ...context
      }
    });
  }

  captureFileUploadError(fileName: string, error: string, context?: ErrorContext): string {
    return this.captureError({
      type: 'file_upload',
      severity: 'medium',
      message: `File upload error for ${fileName}: ${error}`,
      context: {
        fileName,
        fileUploadError: true,
        ...context
      }
    });
  }

  captureNetworkError(url: string, method: string, status: number, error: string): string {
    return this.captureError({
      type: 'network',
      severity: this.getNetworkErrorSeverity(status),
      message: `Network error: ${method} ${url} - ${status} ${error}`,
      context: {
        url,
        method,
        status,
        networkError: true
      }
    });
  }

  captureAuthenticationError(action: string, error: string): string {
    return this.captureError({
      type: 'authentication',
      severity: 'high',
      message: `Authentication error during ${action}: ${error}`,
      context: {
        action,
        authError: true
      }
    });
  }

  private getNetworkErrorSeverity(status: number): ErrorEvent['severity'] {
    if (status >= 500) return 'high';
    if (status >= 400) return 'medium';
    return 'low';
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFingerprint(message: string, stack?: string): string {
    const content = stack || message;
    // Simple hash function for error grouping
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `fp_${Math.abs(hash).toString(36)}`;
  }

  private sendToMonitoringService(error: ErrorEvent): void {
    // In production, this would send to services like:
    // - Sentry
    // - LogRocket
    // - Datadog
    // - Custom monitoring endpoint
    
    if (process.env.NODE_ENV === 'production') {
      // Example implementation:
      /*
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error)
      }).catch(err => {
        console.error('Failed to send error to monitoring service:', err);
      });
      */
    }
  }

  getRecentErrors(limit: number = 10): ErrorEvent[] {
    return this.errors.slice(-limit);
  }

  getErrorsByType(type: ErrorEvent['type']): ErrorEvent[] {
    return this.errors.filter(error => error.type === type);
  }

  getErrorStats(): {
    total: number;
    byType: Record<ErrorEvent['type'], number>;
    bySeverity: Record<ErrorEvent['severity'], number>;
  } {
    const stats = {
      total: this.errors.length,
      byType: {} as Record<ErrorEvent['type'], number>,
      bySeverity: {} as Record<ErrorEvent['severity'], number>
    };

    this.errors.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  clearErrors(): void {
    this.errors = [];
  }

  // Health check for monitoring
  isHealthy(): boolean {
    const recentErrors = this.getRecentErrors(5);
    const criticalErrors = recentErrors.filter(e => e.severity === 'critical');
    
    // Unhealthy if more than 2 critical errors in recent history
    return criticalErrors.length <= 2;
  }
}

// Singleton instance
export const errorMonitoring = new ErrorMonitoringService();

// React hook for error reporting
export function useErrorReporting() {
  return {
    captureError: (error: Error, context?: ErrorContext) => {
      return errorMonitoring.captureError({
        type: 'javascript',
        severity: 'medium',
        message: error.message,
        stack: error.stack,
        context
      });
    },
    
    captureFormError: (formId: string, field: string, error: string) => {
      return errorMonitoring.captureFormError(formId, field, error);
    },
    
    captureFileUploadError: (fileName: string, error: string) => {
      return errorMonitoring.captureFileUploadError(fileName, error);
    },
    
    captureNetworkError: (url: string, method: string, status: number, error: string) => {
      return errorMonitoring.captureNetworkError(url, method, status, error);
    }
  };
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Array<{
    name: string;
    value: number;
    timestamp: number;
    context?: any;
  }> = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  measureFormCompletion(formId: string, duration: number, completed: boolean): void {
    this.metrics.push({
      name: 'form_completion',
      value: duration,
      timestamp: Date.now(),
      context: { formId, completed }
    });

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  measureFileUpload(fileName: string, fileSize: number, duration: number, success: boolean): void {
    this.metrics.push({
      name: 'file_upload',
      value: duration,
      timestamp: Date.now(),
      context: { fileName, fileSize, success }
    });
  }

  getFormCompletionStats(): {
    averageTime: number;
    completionRate: number;
    totalAttempts: number;
  } {
    const formMetrics = this.metrics.filter(m => m.name === 'form_completion');
    const completed = formMetrics.filter(m => m.context?.completed);
    
    return {
      averageTime: completed.reduce((sum, m) => sum + m.value, 0) / completed.length || 0,
      completionRate: completed.length / formMetrics.length || 0,
      totalAttempts: formMetrics.length
    };
  }

  getFileUploadStats(): {
    averageTime: number;
    successRate: number;
    totalUploads: number;
  } {
    const uploadMetrics = this.metrics.filter(m => m.name === 'file_upload');
    const successful = uploadMetrics.filter(m => m.context?.success);
    
    return {
      averageTime: successful.reduce((sum, m) => sum + m.value, 0) / successful.length || 0,
      successRate: successful.length / uploadMetrics.length || 0,
      totalUploads: uploadMetrics.length
    };
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();