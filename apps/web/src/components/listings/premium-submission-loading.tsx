// =====================================================
// Premium Submission Loading Component - UX Expert Design
// Delightful loading experience during listing submission
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Upload, Database, Mail, Loader2, Sparkles, FileText, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// TYPES
// =====================================================

export interface SubmissionStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  duration: number; // milliseconds
}

interface PremiumSubmissionLoadingProps {
  isVisible: boolean;
  onComplete: () => void;
  className?: string;
}

// =====================================================
// SUBMISSION STEPS
// =====================================================

const submissionSteps: SubmissionStep[] = [
  {
    id: 'validation',
    label: 'Validating Information',
    description: 'Checking your listing details for completeness',
    icon: FileText,
    duration: 800
  },
  {
    id: 'processing',
    label: 'Processing Data',
    description: 'Organizing and formatting your requirements',
    icon: Database,
    duration: 1200
  },
  {
    id: 'uploading',
    label: 'Uploading Files',
    description: 'Securing your documents and images',
    icon: Upload,
    duration: 1000
  },
  {
    id: 'submission',
    label: 'Creating Listing',
    description: 'Generating your property requirement listing',
    icon: Sparkles,
    duration: 900
  },
  {
    id: 'notification',
    label: 'Finalizing Submission',
    description: 'Preparing notifications and confirmations',
    icon: Mail,
    duration: 600
  }
];

// =====================================================
// PREMIUM SUBMISSION LOADING COMPONENT
// =====================================================

export function PremiumSubmissionLoading({
  isVisible,
  onComplete,
  className
}: PremiumSubmissionLoadingProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    if (!isVisible) {
      // Reset state when not visible
      setCurrentStepIndex(0);
      setProgress(0);
      setCompletedSteps([]);
      return;
    }

    const totalSteps = submissionSteps.length;
    let stepTimeouts: NodeJS.Timeout[] = [];
    let progressInterval: NodeJS.Timeout;

    const startStep = (stepIndex: number) => {
      if (stepIndex >= totalSteps) {
        // All steps completed
        setProgress(100);
        setTimeout(onComplete, 500);
        return;
      }

      const step = submissionSteps[stepIndex];
      const stepProgress = (stepIndex / totalSteps) * 100;
      const nextStepProgress = ((stepIndex + 1) / totalSteps) * 100;
      
      // Update current step
      setCurrentStepIndex(stepIndex);
      
      // Animate progress for this step
      let currentProgress = stepProgress;
      progressInterval = setInterval(() => {
        currentProgress += (nextStepProgress - stepProgress) / 20;
        if (currentProgress >= nextStepProgress) {
          currentProgress = nextStepProgress;
          clearInterval(progressInterval);
        }
        setProgress(currentProgress);
      }, step.duration / 20);

      // Complete the step and move to next
      const timeout = setTimeout(() => {
        setCompletedSteps(prev => [...prev, step.id]);
        startStep(stepIndex + 1);
      }, step.duration);

      stepTimeouts.push(timeout);
    };

    // Start the first step after a brief delay
    const initialTimeout = setTimeout(() => startStep(0), 300);
    stepTimeouts.push(initialTimeout);

    return () => {
      stepTimeouts.forEach(timeout => clearTimeout(timeout));
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  const currentStep = submissionSteps[currentStepIndex];

  return (
    <div className={cn(
      'fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4',
      'animate-in fade-in duration-300',
      className
    )}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-violet-400/20 to-purple-400/20 rounded-full animate-blob"></div>
        <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 rounded-full animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-36 h-36 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 rounded-full animate-blob animation-delay-4000"></div>
      </div>

      <Card className="relative w-full max-w-md bg-white/95 backdrop-blur-xl border-0 shadow-2xl">
        <CardContent className="p-8">
          
          {/* Animated header icon */}
          <div className="text-center mb-8">
            <div className="relative inline-flex items-center justify-center w-20 h-20 mb-4">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-purple-500 rounded-full animate-pulse opacity-20"></div>
              <div className="relative w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                {currentStep && (
                  <currentStep.icon className="w-8 h-8 text-white" />
                )}
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-400 animate-bounce" />
            </div>
            
            <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-violet-900 to-purple-900 bg-clip-text text-transparent mb-2">
              Submitting Your Listing
            </h2>
            <p className="text-gray-600 text-sm">
              Please wait while we process your submission...
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-3 mb-8">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Progress</span>
              <span className="text-violet-600 font-semibold">{Math.round(progress)}%</span>
            </div>
            <Progress 
              value={progress} 
              className="h-3 bg-gray-100"
            />
          </div>

          {/* Current step */}
          {currentStep && (
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
                <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-violet-900 text-sm">
                    {currentStep.label}
                  </h3>
                  <p className="text-violet-700 text-xs mt-0.5">
                    {currentStep.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Steps overview */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Steps</h4>
            {submissionSteps.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;

              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300',
                    {
                      'bg-emerald-100 text-emerald-600': isCompleted,
                      'bg-violet-100 text-violet-600 animate-pulse': isCurrent,
                      'bg-gray-100 text-gray-400': isPending
                    }
                  )}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-3 h-3" />
                    )}
                  </div>
                  <span className={cn(
                    'text-sm transition-colors duration-300',
                    {
                      'text-emerald-700 font-medium': isCompleted,
                      'text-violet-700 font-medium': isCurrent,
                      'text-gray-500': isPending
                    }
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Footer message */}
          <div className="mt-8 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700 text-center flex items-center justify-center gap-1">
              <Eye className="w-3 h-3" />
              This typically takes just a few seconds
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// HOOK FOR MANAGING SUBMISSION STATE
// =====================================================

export function useSubmissionLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const startSubmission = () => {
    setIsLoading(true);
    setIsComplete(false);
  };

  const completeSubmission = () => {
    setIsLoading(false);
    setIsComplete(true);
  };

  const resetSubmission = () => {
    setIsLoading(false);
    setIsComplete(false);
  };

  return {
    isLoading,
    isComplete,
    startSubmission,
    completeSubmission,
    resetSubmission
  };
}