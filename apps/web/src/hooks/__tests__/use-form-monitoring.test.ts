/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useFormMonitoring, useWizardMonitoring } from '../use-form-monitoring';
import { performanceMonitor } from '@/lib/error-monitoring';

// Mock the performance monitor
jest.mock('@/lib/error-monitoring', () => ({
  performanceMonitor: {
    measureFormCompletion: jest.fn(),
    measureFileUpload: jest.fn()
  }
}));

// Mock console.log
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe('useFormMonitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize form monitoring', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form',
        trackFieldInteractions: true
      })
    );

    expect(result.current.trackFieldInteraction).toBeInstanceOf(Function);
    expect(result.current.trackValidationError).toBeInstanceOf(Function);
    expect(result.current.trackCompletion).toBeInstanceOf(Function);
  });

  it('should track field interactions when enabled', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form',
        trackFieldInteractions: true
      })
    );

    act(() => {
      result.current.trackFieldInteraction('email', 'focus');
      result.current.trackFieldInteraction('email', 'change', 'test@example.com');
      result.current.trackFieldInteraction('email', 'blur');
    });

    const snapshot = result.current.getMonitoringSnapshot();
    expect(snapshot.interactionCount).toBe(3);
    expect(snapshot.lastInteraction?.field).toBe('email');
    expect(snapshot.lastInteraction?.action).toBe('blur');
  });

  it('should not track field interactions when disabled', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form',
        trackFieldInteractions: false
      })
    );

    act(() => {
      result.current.trackFieldInteraction('email', 'focus');
    });

    const snapshot = result.current.getMonitoringSnapshot();
    expect(snapshot.interactionCount).toBe(0);
  });

  it('should track validation errors', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form',
        trackValidationErrors: true,
        trackFieldInteractions: true
      })
    );

    act(() => {
      result.current.trackValidationError('email', 'Invalid email format');
    });

    const snapshot = result.current.getMonitoringSnapshot();
    expect(snapshot.errorCount).toBe(1);
    expect(snapshot.recentErrors[0]?.field).toBe('email');
    expect(snapshot.recentErrors[0]?.error).toBe('Invalid email format');
    
    // Should also track as field interaction
    expect(snapshot.interactionCount).toBe(1);
    expect(snapshot.lastInteraction?.action).toBe('error');
  });

  it('should track step changes', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form'
      })
    );

    act(() => {
      result.current.trackStepChange(2, 5);
    });

    const snapshot = result.current.getMonitoringSnapshot();
    expect(snapshot.currentStep).toBe(2);
    expect(snapshot.totalSteps).toBe(5);

    expect(performanceMonitor.measureFormCompletion).toHaveBeenCalledWith(
      'test-form_step_2',
      expect.any(Number),
      false
    );
  });

  it('should track form completion', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form'
      })
    );

    let analytics: any;
    act(() => {
      result.current.trackStepChange(2, 3);
      analytics = result.current.trackCompletion({ userId: 'test-user' });
    });

    expect(performanceMonitor.measureFormCompletion).toHaveBeenCalledWith(
      'test-form',
      expect.any(Number),
      true
    );

    expect(analytics).toEqual(
      expect.objectContaining({
        formId: 'test-form',
        completionTime: expect.any(Number),
        totalSteps: 3,
        stepProgression: 2
      })
    );
  });

  it('should track file upload performance', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form',
        trackFieldInteractions: true
      })
    );

    act(() => {
      result.current.trackFileUpload('test.png', 1024, 2000, true);
    });

    expect(performanceMonitor.measureFileUpload).toHaveBeenCalledWith(
      'test.png',
      1024,
      2000,
      true
    );

    const snapshot = result.current.getMonitoringSnapshot();
    expect(snapshot.interactionCount).toBe(1);
    expect(snapshot.lastInteraction?.field).toBe('file_upload');
    expect(snapshot.lastInteraction?.action).toBe('change');
  });

  it('should handle page visibility changes for abandonment tracking', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form',
        trackAbandonmentPoints: true
      })
    );

    // Mock document.hidden
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true
    });

    // Trigger visibility change
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Fast-forward time to trigger abandonment timeout
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(performanceMonitor.measureFormCompletion).toHaveBeenCalledWith(
      'test-form_abandoned',
      expect.any(Number),
      false
    );
  });

  it('should limit field interactions to 100', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form',
        trackFieldInteractions: true
      })
    );

    act(() => {
      // Add 105 interactions
      for (let i = 0; i < 105; i++) {
        result.current.trackFieldInteraction(`field-${i}`, 'change');
      }
    });

    const snapshot = result.current.getMonitoringSnapshot();
    expect(snapshot.interactionCount).toBe(100);
  });

  it('should provide monitoring snapshot', () => {
    const { result } = renderHook(() =>
      useFormMonitoring({
        formId: 'test-form',
        trackFieldInteractions: true,
        trackValidationErrors: true
      })
    );

    act(() => {
      result.current.trackFieldInteraction('email', 'focus');
      result.current.trackValidationError('email', 'Required field');
      result.current.trackStepChange(1, 3);
    });

    const snapshot = result.current.getMonitoringSnapshot();
    
    expect(snapshot).toEqual({
      formId: 'test-form',
      duration: expect.any(Number),
      currentStep: 1,
      totalSteps: 3,
      interactionCount: 2, // field interaction + validation error
      errorCount: 1,
      lastInteraction: expect.objectContaining({
        field: 'email',
        action: 'error'
      }),
      recentErrors: expect.arrayContaining([
        expect.objectContaining({
          field: 'email',
          error: 'Required field'
        })
      ])
    });
  });
});

describe('useWizardMonitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize wizard monitoring', () => {
    const { result } = renderHook(() =>
      useWizardMonitoring('test-wizard', 3)
    );

    expect(result.current.trackStepStart).toBeInstanceOf(Function);
    expect(result.current.trackStepCompletion).toBeInstanceOf(Function);
    expect(result.current.getWizardMetrics).toBeInstanceOf(Function);
  });

  it('should track step start and completion', () => {
    const { result } = renderHook(() =>
      useWizardMonitoring('test-wizard', 3)
    );

    act(() => {
      result.current.trackStepStart(1);
    });

    // Advance time
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    act(() => {
      result.current.trackStepCompletion(1);
    });

    expect(performanceMonitor.measureFormCompletion).toHaveBeenCalledWith(
      'test-wizard_step_1',
      expect.any(Number),
      false
    );

    expect(performanceMonitor.measureFormCompletion).toHaveBeenCalledWith(
      'test-wizard_step_1_completion',
      expect.any(Number),
      true
    );
  });

  it('should calculate wizard metrics', () => {
    const { result } = renderHook(() =>
      useWizardMonitoring('test-wizard', 3)
    );

    act(() => {
      result.current.trackStepStart(2);
      result.current.trackFieldInteraction('companyName', 'change', 'Test Company');
    });

    const metrics = result.current.getWizardMetrics();

    expect(metrics).toEqual(
      expect.objectContaining({
        formId: 'test-wizard',
        currentStep: 2,
        totalSteps: 3,
        progress: (2 / 3) * 100,
        averageTimePerStep: expect.any(Number),
        estimatedCompletionTime: expect.any(Number)
      })
    );
  });

  it('should handle step completion without start time', () => {
    const { result } = renderHook(() =>
      useWizardMonitoring('test-wizard', 3)
    );

    act(() => {
      // Complete step without starting it
      result.current.trackStepCompletion(2);
    });

    // Should not call measureFormCompletion for step completion
    expect(performanceMonitor.measureFormCompletion).not.toHaveBeenCalledWith(
      expect.stringContaining('_completion'),
      expect.any(Number),
      true
    );
  });

  it('should inherit all form monitoring functionality', () => {
    const { result } = renderHook(() =>
      useWizardMonitoring('test-wizard', 3)
    );

    // Test that it has all the basic form monitoring functions
    expect(result.current.trackFieldInteraction).toBeInstanceOf(Function);
    expect(result.current.trackValidationError).toBeInstanceOf(Function);
    expect(result.current.trackCompletion).toBeInstanceOf(Function);
    expect(result.current.trackFileUpload).toBeInstanceOf(Function);
    expect(result.current.getMonitoringSnapshot).toBeInstanceOf(Function);

    // Test that it works
    act(() => {
      result.current.trackFieldInteraction('test-field', 'focus');
    });

    const snapshot = result.current.getMonitoringSnapshot();
    expect(snapshot.interactionCount).toBe(1);
  });
});