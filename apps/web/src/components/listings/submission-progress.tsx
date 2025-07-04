// =====================================================
// Submission Progress Component - Story 3.3
// Progress indicator for complex listing submissions
// =====================================================

'use client';

import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Upload, Database, Mail, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// TYPES
// =====================================================

export interface SubmissionStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  active: boolean;
  error?: string;
}

interface SubmissionProgressProps {
  progress: number; // 0-100
  currentStep?: string;
  steps?: SubmissionStep[];
  isSubmitting?: boolean;
  error?: string;
  className?: string;
}

// =====================================================
// DEFAULT STEPS
// =====================================================

const defaultSteps: SubmissionStep[] = [
  {
    id: 'files',
    label: 'Uploading Files',
    description: 'Uploading logos, brochures, and supporting documents',
    icon: Upload,
    completed: false,
    active: false
  },
  {
    id: 'processing',
    label: 'Processing Data',
    description: 'Validating and processing your listing information',
    icon: Database,
    completed: false,
    active: false
  },
  {
    id: 'submission',
    label: 'Submitting Listing',
    description: 'Creating your listing and saving to database',
    icon: Database,
    completed: false,
    active: false
  },
  {
    id: 'confirmation',
    label: 'Sending Confirmation',
    description: 'Sending confirmation email and notifications',
    icon: Mail,
    completed: false,
    active: false
  }
];

// =====================================================
// SUBMISSION PROGRESS COMPONENT
// =====================================================

export function SubmissionProgress({
  progress,
  currentStep,
  steps = defaultSteps,
  isSubmitting = false,
  error,
  className
}: SubmissionProgressProps) {

  // Update steps based on progress
  const updatedSteps = steps.map((step, index) => {
    const stepProgress = (index + 1) / steps.length * 100;
    return {
      ...step,
      completed: progress > stepProgress,
      active: currentStep === step.id || (progress >= stepProgress - 25 && progress < stepProgress),
      error: error && currentStep === step.id ? error : undefined
    };
  });

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">
                {isSubmitting ? 'Submitting Listing...' : 'Submission Progress'}
              </span>
              <span className="text-gray-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {updatedSteps.map((step, index) => {
              const IconComponent = step.icon;
              
              return (
                <div key={step.id} className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200',
                    {
                      // Completed step
                      'bg-green-100 border-green-500 text-green-600': step.completed,
                      // Active step
                      'bg-blue-100 border-blue-500 text-blue-600': step.active && !step.completed,
                      // Error step
                      'bg-red-100 border-red-500 text-red-600': step.error,
                      // Pending step
                      'bg-gray-100 border-gray-300 text-gray-400': !step.active && !step.completed && !step.error
                    }
                  )}>
                    {step.completed ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : step.active && isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <IconComponent className="w-4 h-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'font-medium text-sm transition-colors duration-200',
                      {
                        'text-green-700': step.completed,
                        'text-blue-700': step.active && !step.completed,
                        'text-red-700': step.error,
                        'text-gray-900': !step.active && !step.completed && !step.error
                      }
                    )}>
                      {step.label}
                    </div>
                    <div className={cn(
                      'text-xs mt-1 transition-colors duration-200',
                      {
                        'text-green-600': step.completed,
                        'text-blue-600': step.active && !step.completed,
                        'text-red-600': step.error,
                        'text-gray-500': !step.active && !step.completed && !step.error
                      }
                    )}>
                      {step.error || step.description}
                    </div>
                  </div>

                  {/* Connector Line */}
                  {index < updatedSteps.length - 1 && (
                    <div className={cn(
                      'absolute left-7 top-8 w-0.5 h-6 transition-colors duration-200',
                      {
                        'bg-green-300': step.completed,
                        'bg-blue-300': step.active,
                        'bg-gray-200': !step.active && !step.completed
                      }
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Error Message */}
          {error && !currentStep && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 font-medium">Submission Failed</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {progress >= 100 && !error && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 font-medium">Submission Complete!</p>
              <p className="text-sm text-green-600 mt-1">
                Your listing has been submitted successfully and is under review.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

export function getProgressSteps(progress: number): SubmissionStep[] {
  return defaultSteps.map((step, index) => {
    const stepProgress = (index + 1) / defaultSteps.length * 100;
    return {
      ...step,
      completed: progress > stepProgress,
      active: progress >= stepProgress - 25 && progress < stepProgress
    };
  });
}

export function getCurrentStep(progress: number): string | undefined {
  const steps = getProgressSteps(progress);
  const activeStep = steps.find(step => step.active);
  return activeStep?.id;
}