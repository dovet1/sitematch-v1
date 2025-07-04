/**
 * @jest-environment jsdom
 */
import { errorMonitoring, PerformanceMonitor, useErrorReporting } from '../error-monitoring';
import { renderHook } from '@testing-library/react';

// Mock console methods
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe('Error Monitoring Service', () => {
  beforeEach(() => {
    // Clear errors before each test
    errorMonitoring.clearErrors();
    
    // Mock console methods
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  describe('Error Capturing', () => {
    it('should capture basic errors', () => {
      const errorId = errorMonitoring.captureError({
        type: 'javascript',
        message: 'Test error',
        severity: 'medium'
      });

      expect(errorId).toMatch(/^err_\d+_[a-z0-9]+$/);
      
      const recentErrors = errorMonitoring.getRecentErrors(1);
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('Test error');
      expect(recentErrors[0].type).toBe('javascript');
      expect(recentErrors[0].severity).toBe('medium');
    });

    it('should capture errors with context', () => {
      const errorId = errorMonitoring.captureError({
        type: 'form',
        message: 'Validation failed',
        context: {
          userId: 'user-123',
          component: 'ContactForm',
          field: 'email'
        }
      });

      const recentErrors = errorMonitoring.getRecentErrors(1);
      const error = recentErrors[0];
      
      expect(error.context.userId).toBe('user-123');
      expect(error.context.component).toBe('ContactForm');
      expect(error.context.field).toBe('email');
      expect(error.context.timestamp).toBeDefined();
    });

    it('should generate fingerprints for error grouping', () => {
      const error1 = errorMonitoring.captureError({
        type: 'javascript',
        message: 'Same error message',
        stack: 'Same stack trace'
      });

      const error2 = errorMonitoring.captureError({
        type: 'javascript',
        message: 'Same error message',
        stack: 'Same stack trace'
      });

      const errors = errorMonitoring.getRecentErrors(2);
      expect(errors[0].fingerprint).toBe(errors[1].fingerprint);
    });

    it('should generate different fingerprints for different errors', () => {
      const error1 = errorMonitoring.captureError({
        type: 'javascript',
        message: 'Error message 1'
      });

      const error2 = errorMonitoring.captureError({
        type: 'javascript',
        message: 'Error message 2'
      });

      const errors = errorMonitoring.getRecentErrors(2);
      expect(errors[0].fingerprint).not.toBe(errors[1].fingerprint);
    });
  });

  describe('Specialized Error Methods', () => {
    it('should capture form errors with proper context', () => {
      const errorId = errorMonitoring.captureFormError(
        'contact-form',
        'email',
        'Invalid email format'
      );

      const errors = errorMonitoring.getRecentErrors(1);
      const error = errors[0];

      expect(error.type).toBe('form');
      expect(error.severity).toBe('low');
      expect(error.message).toContain('contact-form.email');
      expect(error.context.formId).toBe('contact-form');
      expect(error.context.field).toBe('email');
    });

    it('should capture file upload errors', () => {
      const errorId = errorMonitoring.captureFileUploadError(
        'company-logo.png',
        'File too large'
      );

      const errors = errorMonitoring.getRecentErrors(1);
      const error = errors[0];

      expect(error.type).toBe('file_upload');
      expect(error.severity).toBe('medium');
      expect(error.message).toContain('company-logo.png');
      expect(error.context.fileName).toBe('company-logo.png');
    });

    it('should capture network errors with proper severity', () => {
      // 500 error should be high severity
      const error1 = errorMonitoring.captureNetworkError(
        '/api/listings',
        'POST',
        500,
        'Internal Server Error'
      );

      // 404 error should be medium severity
      const error2 = errorMonitoring.captureNetworkError(
        '/api/users/999',
        'GET',
        404,
        'Not Found'
      );

      const errors = errorMonitoring.getRecentErrors(2);
      
      expect(errors[1].severity).toBe('high'); // 500 error
      expect(errors[0].severity).toBe('medium'); // 404 error
    });

    it('should capture authentication errors', () => {
      const errorId = errorMonitoring.captureAuthenticationError(
        'login',
        'Invalid credentials'
      );

      const errors = errorMonitoring.getRecentErrors(1);
      const error = errors[0];

      expect(error.type).toBe('authentication');
      expect(error.severity).toBe('high');
      expect(error.context.action).toBe('login');
      expect(error.context.authError).toBe(true);
    });
  });

  describe('Error Statistics', () => {
    beforeEach(() => {
      // Add some test errors
      errorMonitoring.captureError({ type: 'javascript', message: 'JS Error 1', severity: 'high' });
      errorMonitoring.captureError({ type: 'javascript', message: 'JS Error 2', severity: 'medium' });
      errorMonitoring.captureError({ type: 'form', message: 'Form Error 1', severity: 'low' });
      errorMonitoring.captureError({ type: 'network', message: 'Network Error 1', severity: 'high' });
    });

    it('should return correct error stats', () => {
      const stats = errorMonitoring.getErrorStats();

      expect(stats.total).toBe(4);
      expect(stats.byType.javascript).toBe(2);
      expect(stats.byType.form).toBe(1);
      expect(stats.byType.network).toBe(1);
      expect(stats.bySeverity.high).toBe(2);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.bySeverity.low).toBe(1);
    });

    it('should filter errors by type', () => {
      const jsErrors = errorMonitoring.getErrorsByType('javascript');
      const formErrors = errorMonitoring.getErrorsByType('form');

      expect(jsErrors).toHaveLength(2);
      expect(formErrors).toHaveLength(1);
    });

    it('should check health status based on critical errors', () => {
      // Should be healthy with no critical errors
      expect(errorMonitoring.isHealthy()).toBe(true);

      // Add critical errors
      errorMonitoring.captureError({ type: 'javascript', message: 'Critical 1', severity: 'critical' });
      errorMonitoring.captureError({ type: 'javascript', message: 'Critical 2', severity: 'critical' });
      
      // Still healthy with 2 critical errors
      expect(errorMonitoring.isHealthy()).toBe(true);

      // Add third critical error
      errorMonitoring.captureError({ type: 'javascript', message: 'Critical 3', severity: 'critical' });
      
      // Should be unhealthy with 3 critical errors
      expect(errorMonitoring.isHealthy()).toBe(false);
    });
  });

  describe('useErrorReporting Hook', () => {
    it('should provide error reporting functions', () => {
      const { result } = renderHook(() => useErrorReporting());

      expect(result.current.captureError).toBeInstanceOf(Function);
      expect(result.current.captureFormError).toBeInstanceOf(Function);
      expect(result.current.captureFileUploadError).toBeInstanceOf(Function);
      expect(result.current.captureNetworkError).toBeInstanceOf(Function);
    });

    it('should capture errors through hook', () => {
      const { result } = renderHook(() => useErrorReporting());
      
      const error = new Error('Test error from hook');
      const errorId = result.current.captureError(error, { component: 'TestComponent' });

      const errors = errorMonitoring.getRecentErrors(1);
      expect(errors[0].message).toBe('Test error from hook');
      expect(errors[0].context.component).toBe('TestComponent');
    });
  });
});

describe('Performance Monitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = PerformanceMonitor.getInstance();
    // Clear metrics
    (performanceMonitor as any).metrics = [];
  });

  describe('Form Completion Tracking', () => {
    it('should track form completion metrics', () => {
      performanceMonitor.measureFormCompletion('contact-form', 30000, true);
      performanceMonitor.measureFormCompletion('contact-form', 45000, false);
      performanceMonitor.measureFormCompletion('contact-form', 25000, true);

      const stats = performanceMonitor.getFormCompletionStats();

      expect(stats.totalAttempts).toBe(3);
      expect(stats.completionRate).toBe(2/3);
      expect(stats.averageTime).toBe((30000 + 25000) / 2); // Only completed forms
    });

    it('should handle no completion data', () => {
      const stats = performanceMonitor.getFormCompletionStats();

      expect(stats.totalAttempts).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.averageTime).toBe(0);
    });
  });

  describe('File Upload Tracking', () => {
    it('should track file upload metrics', () => {
      performanceMonitor.measureFileUpload('file1.png', 1024, 2000, true);
      performanceMonitor.measureFileUpload('file2.jpg', 2048, 3000, false);
      performanceMonitor.measureFileUpload('file3.svg', 512, 1500, true);

      const stats = performanceMonitor.getFileUploadStats();

      expect(stats.totalUploads).toBe(3);
      expect(stats.successRate).toBe(2/3);
      expect(stats.averageTime).toBe((2000 + 1500) / 2); // Only successful uploads
    });

    it('should handle no upload data', () => {
      const stats = performanceMonitor.getFileUploadStats();

      expect(stats.totalUploads).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageTime).toBe(0);
    });
  });

  describe('Metrics Management', () => {
    it('should limit metrics storage', () => {
      // Add more than 1000 metrics
      for (let i = 0; i < 1100; i++) {
        performanceMonitor.measureFormCompletion(`form-${i}`, 1000, true);
      }

      const metrics = (performanceMonitor as any).metrics;
      expect(metrics.length).toBe(1000);
    });

    it('should maintain singleton instance', () => {
      const instance1 = PerformanceMonitor.getInstance();
      const instance2 = PerformanceMonitor.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});