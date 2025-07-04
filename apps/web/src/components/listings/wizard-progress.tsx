// =====================================================
// Wizard Progress Component - Story 3.1
// Progress indicator for the listing creation wizard
// =====================================================

'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProgressStep } from '@/types/wizard';

interface WizardProgressProps {
  steps: ProgressStep[];
  currentStep: number;
  className?: string;
}

export function WizardProgress({ steps, currentStep, className }: WizardProgressProps) {
  return (
    <div className={cn('w-full py-4 md:py-6', className)}>
      {/* Mobile: Vertical Progress */}
      <div className="md:hidden space-y-3">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep;
          const isCompleted = step.isCompleted;
          const isAccessible = step.isAccessible;
          
          return (
            <div key={step.number} className="flex items-center space-x-3">
              {/* Step Circle */}
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-xs transition-all duration-200 flex-shrink-0',
                  {
                    // Completed step
                    'bg-green-600 border-green-600 text-white': isCompleted,
                    // Active step
                    'bg-violet-600 border-violet-600 text-white': isActive && !isCompleted,
                    // Accessible but not active
                    'bg-white border-gray-300 text-gray-500': 
                      !isActive && !isCompleted && isAccessible,
                    // Not accessible
                    'bg-gray-100 border-gray-200 text-gray-400': 
                      !isActive && !isCompleted && !isAccessible,
                  }
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{step.number}</span>
                )}
              </div>

              {/* Step Label */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    {
                      'text-violet-600': isActive,
                      'text-green-600': isCompleted,
                      'text-gray-900': !isActive && !isCompleted && isAccessible,
                      'text-gray-400': !isActive && !isCompleted && !isAccessible,
                    }
                  )}
                >
                  {step.title}
                </div>
                {isActive && (
                  <p className="text-xs text-gray-600 mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Horizontal Progress */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.isCompleted;
            const isAccessible = step.isAccessible;
            
            return (
              <div key={step.number} className="flex items-center flex-1">
                {/* Step Circle */}
                <div className="relative flex items-center">
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full border-2 font-medium text-sm transition-all duration-200',
                      {
                        // Completed step
                        'bg-green-600 border-green-600 text-white': isCompleted,
                        // Active step
                        'bg-violet-600 border-violet-600 text-white': isActive && !isCompleted,
                        // Accessible but not active
                        'bg-white border-gray-300 text-gray-500 hover:border-gray-400': 
                          !isActive && !isCompleted && isAccessible,
                        // Not accessible
                        'bg-gray-100 border-gray-200 text-gray-400': 
                          !isActive && !isCompleted && !isAccessible,
                      }
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="ml-4 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-medium transition-colors duration-200',
                        {
                          'text-violet-600': isActive,
                          'text-green-600': isCompleted,
                          'text-gray-900': !isActive && !isCompleted && isAccessible,
                          'text-gray-400': !isActive && !isCompleted && !isAccessible,
                        }
                      )}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-px mx-4 transition-colors duration-200',
                      {
                        'bg-green-600': steps[index + 1].isCompleted || (isCompleted && steps[index + 1].number === currentStep),
                        'bg-gray-300': !steps[index + 1].isCompleted && !(isCompleted && steps[index + 1].number === currentStep),
                      }
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Description */}
        <div className="mt-4 text-center">
          {steps.map((step) => {
            if (step.number === currentStep) {
              return (
                <p key={step.number} className="text-sm text-gray-600">
                  {step.description}
                </p>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

// Utility function to create progress steps from wizard state
export function createProgressSteps(currentStep: 1 | 2 | 3 | 4, stepValidation: Record<number, boolean>): ProgressStep[] {
  return [
    {
      number: 1,
      title: 'Company Info',
      description: 'Tell us about your company and contact details',
      isActive: currentStep === 1,
      isCompleted: stepValidation[1] === true && currentStep > 1,
      isAccessible: true
    },
    {
      number: 2,
      title: 'Requirements',
      description: 'Specify your property requirements and preferences (all optional)',
      isActive: currentStep === 2,
      isCompleted: stepValidation[2] === true && currentStep > 2,
      isAccessible: stepValidation[1] === true
    },
    {
      number: 3,
      title: 'Target Locations',
      description: 'Add target locations for your property search',
      isActive: currentStep === 3,
      isCompleted: stepValidation[3] === true && currentStep > 3,
      isAccessible: stepValidation[1] === true && stepValidation[2] === true
    },
    {
      number: 4,
      title: 'Supporting Documents',
      description: 'Upload documents and images (optional)',
      isActive: currentStep === 4,
      isCompleted: stepValidation[4] === true && currentStep > 4,
      isAccessible: stepValidation[1] === true && stepValidation[2] === true && stepValidation[3] === true
    }
  ];
}