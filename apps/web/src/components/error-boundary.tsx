// =====================================================
// Error Boundary Component - QA Enhancement
// Catches and handles React component errors gracefully
// =====================================================

'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Bug, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMonitoring } from '@/lib/error-monitoring';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  context?: {
    component?: string;
    userId?: string;
    feature?: string;
  };
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
  resetCount: number;
  errorDetails?: {
    componentStack: string;
    timestamp: Date;
    userAgent: string;
  };
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorId: '',
      resetCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Enhanced error details
    const errorDetails = {
      componentStack: errorInfo.componentStack || 'Unknown',
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    };

    // Update state with error details
    this.setState({ errorDetails });

    // Log error to enhanced monitoring service
    const errorId = errorMonitoring.captureError({
      type: 'javascript',
      severity: 'high',
      message: error.message,
      stack: error.stack,
      context: {
        component: this.props.context?.component,
        userId: this.props.context?.userId,
        feature: this.props.context?.feature,
        componentStack: errorInfo.componentStack,
        resetCount: this.state.resetCount,
        errorBoundary: true,
        ...this.props.context
      }
    });

    console.error('ErrorBoundary caught an error:', {
      errorId,
      error,
      errorInfo,
      context: this.props.context
    });
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, idx) => 
        prevProps.resetKeys?.[idx] !== key
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  resetErrorBoundary = () => {
    this.resetTimeoutId = window.setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorId: '',
        resetCount: prevState.resetCount + 1
      }));
    }, 100);
  };

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  render() {
    const { hasError, error, errorId, errorDetails, resetCount } = this.state;
    const { children, fallback, context } = this.props;

    if (hasError) {
      // Custom fallback UI
      if (fallback) {
        return fallback;
      }

      // Enhanced error UI with better user guidance
      return (
        <div className="min-h-[200px] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <AlertTriangle className="h-12 w-12 text-red-500" />
              </div>
              <CardTitle className="text-red-600">
                {context?.feature ? `${context.feature} Error` : 'Something went wrong'}
              </CardTitle>
              <CardDescription>
                {resetCount > 0 
                  ? `We've tried ${resetCount} time${resetCount > 1 ? 's' : ''} to fix this. Your data is safe.`
                  : 'We encountered an unexpected error. Don\'t worry, your data is safe.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error context for user */}
              {context?.component && (
                <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                  <div className="flex items-center">
                    <Bug className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-800">
                      Error in: {context.component}
                    </span>
                  </div>
                </div>
              )}

              {/* Timestamp */}
              {errorDetails?.timestamp && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    Occurred at: {errorDetails.timestamp.toLocaleString()}
                  </div>
                </div>
              )}

              {/* Development error details */}
              {process.env.NODE_ENV === 'development' && error && (
                <details className="text-xs text-gray-600">
                  <summary className="cursor-pointer font-medium mb-2">
                    Error Details (Development Mode)
                  </summary>
                  <div className="space-y-2">
                    <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded border overflow-auto max-h-32">
                      {error.message}
                      {error.stack && `\n\n${error.stack}`}
                    </pre>
                    {errorDetails?.componentStack && (
                      <details>
                        <summary className="cursor-pointer font-medium">Component Stack</summary>
                        <pre className="whitespace-pre-wrap bg-gray-50 p-2 rounded border overflow-auto max-h-24 mt-1">
                          {errorDetails.componentStack}
                        </pre>
                      </details>
                    )}
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Error ID: {errorId}</p>
                      <p>Reset Count: {resetCount}</p>
                      {context?.userId && <p>User ID: {context.userId}</p>}
                    </div>
                  </div>
                </details>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={this.resetErrorBoundary}
                  className="flex-1"
                  variant="outline"
                  disabled={resetCount >= 3}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {resetCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
                </Button>
                <Button 
                  onClick={() => window.location.reload()}
                  className="flex-1"
                >
                  Reload Page
                </Button>
              </div>

              {/* Progressive error messages */}
              <div className="text-center">
                {resetCount === 0 && (
                  <p className="text-xs text-gray-500">
                    If this problem persists, try reloading the page.
                  </p>
                )}
                {resetCount >= 1 && resetCount < 3 && (
                  <p className="text-xs text-orange-600">
                    This error is recurring. Consider reloading the page or contacting support.
                  </p>
                )}
                {resetCount >= 3 && (
                  <p className="text-xs text-red-600">
                    Persistent error detected. Please reload the page or contact support with Error ID: {errorId}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manual error reporting
export function useErrorHandler() {
  return React.useCallback((error: Error, errorInfo?: { componentStack?: string }) => {
    // This will trigger the nearest error boundary
    throw error;
  }, []);
}