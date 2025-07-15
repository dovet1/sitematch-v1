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
                      'bg-primary border-primary': isActive,
                      'bg-success border-success': isCompleted,
                      'bg-muted border-border': !isActive && !isCompleted,
                    }
                  )}
                />
                {index < steps.length - 1 && (
                  <div 
                    className={cn(
                      'w-8 h-0.5 mx-1 transition-colors duration-200',
                      {
                        'bg-primary': isActive || isCompleted,
                        'bg-border': !isActive && !isCompleted,
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
          <div className="body-small font-medium text-primary">
            Step {currentStep} of {steps.length}
          </div>
          <div className="caption text-muted-foreground mt-1">
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
                      'flex items-center justify-center w-8 h-8 rounded-full border-2 font-medium text-sm transition-all duration-200 relative flex-shrink-0 violet-bloom-touch',
                      {
                        'bg-success border-success text-white': isCompleted,
                        'bg-primary border-primary text-primary-foreground': isActive && !isCompleted,
                        'bg-background border-border text-muted-foreground hover:border-primary-300': 
                          !isActive && !isCompleted && isAccessible,
                        'bg-muted border-border text-muted-foreground': 
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
                      <div className="body-small font-medium text-primary whitespace-nowrap">
                        {step.title}
                      </div>
                      <div className="caption text-muted-foreground mt-0.5 whitespace-nowrap">
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
                          'bg-primary': isCompleted || (isActive && steps[index + 1].isCompleted),
                          'bg-success': isCompleted && steps[index + 1].isCompleted,
                          'bg-border': !isCompleted && !isActive,
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
          <div className="w-full bg-primary-100 h-1" style={{ borderRadius: "var(--radius-md)" }}>
            <div 
              className="bg-gradient-to-r from-primary to-primary-600 h-1 transition-all duration-500 ease-out"
              style={{ 
                borderRadius: "var(--radius-md)",
                width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`
              }}
            />
          </div>
          <div className="flex justify-between caption text-muted-foreground mt-2">
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

/**
 * Creates progress steps filtered by listing type
 * Residential listings: Steps 1-5 (Step 6 hidden)
 * Commercial listings: Steps 1-6 (all steps visible)
 */
export function createProgressStepsForListingType(
  currentStep: 1 | 2 | 3 | 4 | 5 | 6, 
  stepValidation: Record<number, boolean>,
  listingType: 'residential' | 'commercial'
): ProgressStep[] {
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
    listingType === 'residential' ? 'Residential property requirements' : 'Commercial property requirements',
    'Target locations',
    'Additional contacts',
    'Frequently asked questions',
    'Supporting documents'
  ];

  // For residential, only show steps 1-5; for commercial, show all 6 steps
  const maxSteps = listingType === 'residential' ? 5 : 6;
  
  return Array.from({ length: maxSteps }, (_, i) => {
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