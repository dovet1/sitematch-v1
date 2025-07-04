// =====================================================
// Form Performance Monitoring Hook - Story 3.1 Enhancement
// Tracks form completion metrics and user interaction patterns
// =====================================================

import { useCallback, useEffect, useRef } from 'react';
import { performanceMonitor } from '@/lib/error-monitoring';

interface FormMonitoringConfig {
  formId: string;
  trackFieldInteractions?: boolean;
  trackValidationErrors?: boolean;
  trackAbandonmentPoints?: boolean;
  debounceMs?: number;
}

interface FormMonitoringData {
  startTime: number;
  currentStep?: number;
  totalSteps?: number;
  fieldInteractions: Array<{
    field: string;
    action: 'focus' | 'blur' | 'change' | 'error';
    timestamp: number;
    value?: string;
  }>;
  validationErrors: Array<{
    field: string;
    error: string;
    timestamp: number;
  }>;
  abandonmentPoint?: {
    step: number;
    field: string;
    timestamp: number;
  };
}

export function useFormMonitoring(config: FormMonitoringConfig) {
  const monitoringData = useRef<FormMonitoringData>({
    startTime: Date.now(),
    fieldInteractions: [],
    validationErrors: []
  });

  const timeoutRef = useRef<NodeJS.Timeout>();

  // Initialize monitoring
  useEffect(() => {
    monitoringData.current.startTime = Date.now();
    
    // Track page visibility for abandonment detection
    const handleVisibilityChange = () => {
      if (document.hidden && !timeoutRef.current) {
        // User switched away from page - potential abandonment
        timeoutRef.current = setTimeout(() => {
          trackAbandonment('page_hidden');
        }, 30000); // 30 seconds
      } else if (!document.hidden && timeoutRef.current) {
        // User returned
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [config.formId]);

  // Track field interactions
  const trackFieldInteraction = useCallback((
    field: string, 
    action: 'focus' | 'blur' | 'change' | 'error',
    value?: string
  ) => {
    if (!config.trackFieldInteractions) return;

    monitoringData.current.fieldInteractions.push({
      field,
      action,
      timestamp: Date.now(),
      value: action === 'change' ? value?.substring(0, 50) : undefined // Limit value length for privacy
    });

    // Keep only last 100 interactions
    if (monitoringData.current.fieldInteractions.length > 100) {
      monitoringData.current.fieldInteractions.shift();
    }
  }, [config.trackFieldInteractions]);

  // Track validation errors
  const trackValidationError = useCallback((field: string, error: string) => {
    if (!config.trackValidationErrors) return;

    monitoringData.current.validationErrors.push({
      field,
      error,
      timestamp: Date.now()
    });

    // Also track as field interaction
    trackFieldInteraction(field, 'error');
  }, [config.trackValidationErrors, trackFieldInteraction]);

  // Track step progression
  const trackStepChange = useCallback((newStep: number, totalSteps?: number) => {
    monitoringData.current.currentStep = newStep;
    monitoringData.current.totalSteps = totalSteps;

    // Track step progression performance
    const now = Date.now();
    const timeToStep = now - monitoringData.current.startTime;
    
    performanceMonitor.measureFormCompletion(
      `${config.formId}_step_${newStep}`,
      timeToStep,
      false // Not completed yet
    );
  }, [config.formId]);

  // Track form abandonment
  const trackAbandonment = useCallback((reason: string) => {
    const currentStep = monitoringData.current.currentStep || 1;
    const lastInteraction = monitoringData.current.fieldInteractions.slice(-1)[0];
    
    monitoringData.current.abandonmentPoint = {
      step: currentStep,
      field: lastInteraction?.field || 'unknown',
      timestamp: Date.now()
    };

    // Send abandonment metric
    const abandonmentTime = Date.now() - monitoringData.current.startTime;
    performanceMonitor.measureFormCompletion(
      `${config.formId}_abandoned`,
      abandonmentTime,
      false
    );

    console.log('Form abandonment tracked:', {
      formId: config.formId,
      reason,
      step: currentStep,
      field: lastInteraction?.field,
      duration: abandonmentTime
    });
  }, [config.formId]);

  // Track successful form completion
  const trackCompletion = useCallback((submissionData?: any) => {
    const completionTime = Date.now() - monitoringData.current.startTime;
    
    // Track overall completion
    performanceMonitor.measureFormCompletion(
      config.formId,
      completionTime,
      true
    );

    // Generate completion analytics
    const analytics = {
      formId: config.formId,
      completionTime,
      totalSteps: monitoringData.current.totalSteps,
      totalInteractions: monitoringData.current.fieldInteractions.length,
      totalErrors: monitoringData.current.validationErrors.length,
      errorRate: monitoringData.current.validationErrors.length / Math.max(1, monitoringData.current.fieldInteractions.length),
      stepProgression: monitoringData.current.currentStep,
      timePerStep: monitoringData.current.totalSteps ? completionTime / monitoringData.current.totalSteps : 0
    };

    console.log('Form completion tracked:', analytics);

    return analytics;
  }, [config.formId]);

  // Track file upload monitoring within form
  const trackFileUpload = useCallback((
    fileName: string,
    fileSize: number,
    duration: number,
    success: boolean
  ) => {
    performanceMonitor.measureFileUpload(fileName, fileSize, duration, success);
    
    // Also track as field interaction
    trackFieldInteraction('file_upload', success ? 'change' : 'error', fileName);
  }, [trackFieldInteraction]);

  // Get current monitoring snapshot
  const getMonitoringSnapshot = useCallback(() => {
    const currentTime = Date.now();
    const duration = currentTime - monitoringData.current.startTime;
    
    return {
      formId: config.formId,
      duration,
      currentStep: monitoringData.current.currentStep,
      totalSteps: monitoringData.current.totalSteps,
      interactionCount: monitoringData.current.fieldInteractions.length,
      errorCount: monitoringData.current.validationErrors.length,
      lastInteraction: monitoringData.current.fieldInteractions.slice(-1)[0],
      recentErrors: monitoringData.current.validationErrors.slice(-5)
    };
  }, [config.formId]);

  return {
    trackFieldInteraction,
    trackValidationError,
    trackStepChange,
    trackAbandonment,
    trackCompletion,
    trackFileUpload,
    getMonitoringSnapshot
  };
}

// Hook for wizard-specific monitoring
export function useWizardMonitoring(wizardId: string, totalSteps: number) {
  const formMonitoring = useFormMonitoring({
    formId: wizardId,
    trackFieldInteractions: true,
    trackValidationErrors: true,
    trackAbandonmentPoints: true
  });

  const stepStartTimes = useRef<Record<number, number>>({});

  // Track step-specific timing
  const trackStepStart = useCallback((step: number) => {
    stepStartTimes.current[step] = Date.now();
    formMonitoring.trackStepChange(step, totalSteps);
  }, [formMonitoring, totalSteps]);

  const trackStepCompletion = useCallback((step: number) => {
    const startTime = stepStartTimes.current[step];
    if (startTime) {
      const stepDuration = Date.now() - startTime;
      performanceMonitor.measureFormCompletion(
        `${wizardId}_step_${step}_completion`,
        stepDuration,
        true
      );
    }
  }, [wizardId]);

  // Track wizard-specific metrics
  const getWizardMetrics = useCallback(() => {
    const snapshot = formMonitoring.getMonitoringSnapshot();
    return {
      ...snapshot,
      progress: snapshot.currentStep ? (snapshot.currentStep / totalSteps) * 100 : 0,
      averageTimePerStep: snapshot.duration / Math.max(1, snapshot.currentStep || 1),
      estimatedCompletionTime: totalSteps * (snapshot.duration / Math.max(1, snapshot.currentStep || 1))
    };
  }, [formMonitoring, totalSteps]);

  return {
    ...formMonitoring,
    trackStepStart,
    trackStepCompletion,
    getWizardMetrics
  };
}

// Monitoring benchmark constants
export const MONITORING_BENCHMARKS = {
  FORM_COMPLETION: {
    EXCELLENT: 60000, // Under 1 minute
    GOOD: 180000, // Under 3 minutes
    ACCEPTABLE: 300000, // Under 5 minutes
    POOR: 600000 // Over 10 minutes is poor
  },
  FILE_UPLOAD: {
    EXCELLENT: 2000, // Under 2 seconds
    GOOD: 5000, // Under 5 seconds
    ACCEPTABLE: 10000, // Under 10 seconds
    POOR: 30000 // Over 30 seconds is poor
  },
  STEP_PROGRESSION: {
    EXCELLENT: 30000, // Under 30 seconds per step
    GOOD: 60000, // Under 1 minute per step
    ACCEPTABLE: 120000, // Under 2 minutes per step
    POOR: 300000 // Over 5 minutes per step is poor
  }
} as const;