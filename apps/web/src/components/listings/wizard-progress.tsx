// =====================================================
// Wizard Progress Component - Compact 6-Step Design
// Mobile-friendly progress indicator with violet bloom styling
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
    <div className={cn('w-full py-4', className)}>
      {/* Mobile: Horizontal Dots */}
      <div className="md:hidden">
        <div className="flex items-center justify-center space-x-2 mb-3">
          {steps.map((step, index) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.isCompleted;
            
            return (
              <div key={step.number} className="flex items-center">
                <div
                  className={cn(
                    'w-3 h-3 rounded-full border-2 transition-all duration-200',
                    {
                      'bg-violet-600 border-violet-600': isActive,
                      'bg-green-600 border-green-600': isCompleted,
                      'bg-gray-200 border-gray-300': !isActive && !isCompleted,
                    }
                  )}
                />
                {index < steps.length - 1 && (
                  <div 
                    className={cn(
                      'w-8 h-0.5 mx-1 transition-colors duration-200',
                      {
                        'bg-violet-600': isActive || isCompleted,
                        'bg-gray-200': !isActive && !isCompleted,
                      }
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Current step info */}
        <div className="text-center">
          <div className="text-sm font-medium text-violet-700">
            Step {currentStep} of {steps.length}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {steps.find(s => s.number === currentStep)?.title}
          </div>
        </div>
      </div>

      {/* Desktop: Compact Horizontal Layout */}
      <div className="hidden md:block">
        <div className="flex items-center max-w-5xl mx-auto">
          {steps.map((step, index) => {
            const isActive = step.number === currentStep;
            const isCompleted = step.isCompleted;
            const isAccessible = step.isAccessible;
            
            return (
              <div key={step.number} className="flex items-center min-w-0">
                {/* Step indicator */}
                <div className="flex items-center min-w-0">
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-sm transition-all duration-200 relative flex-shrink-0',
                      {
                        'bg-green-600 border-green-600 text-white': isCompleted,
                        'bg-violet-600 border-violet-600 text-white': isActive && !isCompleted,
                        'bg-white border-gray-300 text-gray-500 hover:border-violet-300': 
                          !isActive && !isCompleted && isAccessible,
                        'bg-gray-100 border-gray-200 text-gray-400': 
                          !isActive && !isCompleted && !isAccessible,
                      }
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="text-xs">{step.number}</span>
                    )}
                  </div>

                  {/* Step label - only show for active step on desktop */}
                  {isActive && (
                    <div className="ml-3 min-w-0 flex-shrink-0">
                      <div className="text-sm font-medium text-violet-700 whitespace-nowrap">
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 whitespace-nowrap">
                        {step.description}
                      </div>
                    </div>
                  )}
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className={cn("mx-4", isActive ? "flex-1" : "w-12")}>
                    <div
                      className={cn(
                        'h-0.5 w-full transition-colors duration-200',
                        {
                          'bg-violet-600': isCompleted || (isActive && steps[index + 1].isCompleted),
                          'bg-green-600': isCompleted && steps[index + 1].isCompleted,
                          'bg-gray-200': !isCompleted && !isActive,
                        }
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-4 max-w-4xl mx-auto">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-gradient-to-r from-violet-600 to-violet-500 h-1 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Start</span>
            <span>{Math.round(((currentStep - 1) / (steps.length - 1)) * 100)}% Complete</span>
            <span>Finish</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Updated utility function for 6-step progress
export function createProgressSteps(currentStep: 1 | 2 | 3 | 4 | 5 | 6, stepValidation: Record<number, boolean>): ProgressStep[] {
  const stepTitles = [
    'Company Info',
    'Requirements', 
    'Locations',
    'Contacts',
    'FAQs',
    'Documents'
  ];

  const stepDescriptions = [
    'Company details and contact info',
    'Property requirements',
    'Target locations',
    'Additional contacts',
    'Frequently asked questions',
    'Supporting documents'
  ];

  return Array.from({ length: 6 }, (_, i) => {
    const stepNumber = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    return {
      number: stepNumber,
      title: stepTitles[i],
      description: stepDescriptions[i],
      isActive: currentStep === stepNumber,
      isCompleted: stepValidation[stepNumber] === true && currentStep > stepNumber,
      isAccessible: stepNumber === 1 || (stepNumber <= 3 ? stepValidation[1] === true : stepValidation[1] === true && stepValidation[2] === true && stepValidation[3] === true)
    };
  });
}