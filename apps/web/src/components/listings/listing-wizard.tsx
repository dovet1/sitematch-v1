// =====================================================
// Listing Wizard Container - Story 3.1
// Main wizard component with step management and form state
// =====================================================

'use client';

import { useEffect, useReducer, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useErrorHandling } from '@/hooks/use-error-handling';

import { WizardProgress, createProgressSteps } from './wizard-progress';
import { Step1CompanyInfo } from './steps/step1-company-info';
import { Step2RequirementDetails } from './steps/step2-requirement-details';

import type {
  WizardState,
  WizardAction,
  WizardFormData,
  SubmissionResult,
  AutoSaveState
} from '@/types/wizard';

import {
  validateStep,
  isStepValid,
  saveToLocalStorage,
  loadFromLocalStorage,
  clearLocalStorage,
  getNextStep,
  getPreviousStep,
  canNavigateToStep,
  createAutoSaveState,
  shouldAutoSave
} from '@/lib/wizard-utils';

// =====================================================
// WIZARD STATE MANAGEMENT
// =====================================================

const initialState: WizardState = {
  currentStep: 1,
  formData: {},
  isValid: { 1: false, 2: false },
  isSubmitting: false,
  errors: {}
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    
    case 'UPDATE_DATA':
      const updatedData = { ...state.formData, ...action.data };
      return { 
        ...state, 
        formData: updatedData,
        errors: {} // Clear errors on data update
      };
    
    case 'SET_VALID':
      return {
        ...state,
        isValid: { ...state.isValid, [action.step]: action.isValid }
      };
    
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.isSubmitting };
    
    case 'SET_ERRORS':
      return { ...state, errors: action.errors };
    
    case 'RESET':
      return initialState;
    
    default:
      return state;
  }
}

// =====================================================
// MAIN WIZARD COMPONENT
// =====================================================

interface ListingWizardProps {
  initialData?: Partial<WizardFormData>;
  onSubmit?: (data: WizardFormData) => Promise<SubmissionResult>;
  onSave?: (data: Partial<WizardFormData>) => Promise<void>;
  userEmail?: string;
}

export function ListingWizard({ 
  initialData, 
  onSubmit, 
  onSave,
  userEmail 
}: ListingWizardProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const [autoSave, setAutoSave] = useReducer(
    (prev: AutoSaveState, updates: Partial<AutoSaveState>) => ({ ...prev, ...updates }),
    createAutoSaveState()
  );

  // =====================================================
  // INITIALIZATION
  // =====================================================

  useEffect(() => {
    // Load saved data from localStorage or use initial data
    const savedData = loadFromLocalStorage();
    const dataToLoad = savedData || initialData || {};
    
    // Pre-fill contact email if provided
    if (userEmail && !dataToLoad.contactEmail) {
      dataToLoad.contactEmail = userEmail;
    }

    if (Object.keys(dataToLoad).length > 0) {
      dispatch({ type: 'UPDATE_DATA', data: dataToLoad });
    }
  }, [initialData, userEmail]);

  // =====================================================
  // VALIDATION EFFECTS
  // =====================================================

  useEffect(() => {
    // Validate current step whenever form data changes
    const isCurrentStepValid = isStepValid(state.currentStep, state.formData);
    dispatch({ type: 'SET_VALID', step: state.currentStep, isValid: isCurrentStepValid });

    // Validate other steps as well
    if (state.currentStep === 2) {
      const isStep1Valid = isStepValid(1, state.formData);
      dispatch({ type: 'SET_VALID', step: 1, isValid: isStep1Valid });
    }
  }, [state.formData, state.currentStep]);

  // =====================================================
  // AUTO-SAVE FUNCTIONALITY
  // =====================================================

  useEffect(() => {
    const autoSaveTimer = setTimeout(() => {
      if (shouldAutoSave(autoSave, state.formData) && Object.keys(state.formData).length > 0) {
        setAutoSave({ isSaving: true });
        
        try {
          saveToLocalStorage(state.formData);
          setAutoSave({ 
            lastSaved: new Date(), 
            isDirty: false, 
            isSaving: false 
          });
        } catch (error) {
          setAutoSave({ 
            isSaving: false, 
            saveError: 'Failed to auto-save' 
          });
        }
      }
    }, 1000);

    return () => clearTimeout(autoSaveTimer);
  }, [state.formData, autoSave]);

  // =====================================================
  // NAVIGATION HANDLERS
  // =====================================================

  const goToStep = useCallback((step: 1 | 2) => {
    if (canNavigateToStep(step, state.currentStep, state.isValid)) {
      dispatch({ type: 'SET_STEP', step });
    }
  }, [state.currentStep, state.isValid]);

  const goNext = useCallback(() => {
    const nextStep = getNextStep(state.currentStep);
    if (nextStep) {
      // Validate current step before proceeding
      const errors = validateStep(state.currentStep, state.formData);
      if (Object.keys(errors).length > 0) {
        dispatch({ type: 'SET_ERRORS', errors });
        toast.error('Please fix the errors before continuing');
        return;
      }
      
      goToStep(nextStep);
    }
  }, [state.currentStep, state.formData, goToStep]);

  const goPrevious = useCallback(() => {
    const previousStep = getPreviousStep(state.currentStep);
    if (previousStep) {
      goToStep(previousStep);
    }
  }, [state.currentStep, goToStep]);

  // =====================================================
  // DATA HANDLERS
  // =====================================================

  const updateData = useCallback((data: Partial<WizardFormData>) => {
    dispatch({ type: 'UPDATE_DATA', data });
    setAutoSave({ isDirty: true });
  }, []);

  const handleSave = useCallback(async () => {
    if (onSave) {
      try {
        setAutoSave({ isSaving: true });
        await onSave(state.formData);
        saveToLocalStorage(state.formData);
        setAutoSave({ 
          lastSaved: new Date(), 
          isDirty: false, 
          isSaving: false 
        });
        toast.success('Progress saved');
      } catch (error) {
        setAutoSave({ isSaving: false, saveError: 'Failed to save' });
        toast.error('Failed to save progress');
      }
    }
  }, [onSave, state.formData]);

  // =====================================================
  // SUBMISSION HANDLER
  // =====================================================

  const submitWizard = useCallback(async (): Promise<SubmissionResult> => {
    // Final validation
    const step1Errors = validateStep(1, state.formData);
    const step2Errors = validateStep(2, state.formData);
    const allErrors = { ...step1Errors, ...step2Errors };

    if (Object.keys(allErrors).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors: allErrors });
      toast.error('Please fix all errors before submitting');
      return { success: false, error: 'Validation failed' };
    }

    if (!onSubmit) {
      return { success: false, error: 'No submission handler provided' };
    }

    dispatch({ type: 'SET_SUBMITTING', isSubmitting: true });

    try {
      const result = await onSubmit(state.formData as WizardFormData);
      
      if (result.success) {
        clearLocalStorage();
        toast.success('Listing created successfully!');
        
        // Redirect to listing or dashboard
        if (result.listingId) {
          router.push(`/occupier/listings/${result.listingId}`);
        } else {
          router.push('/occupier/listings');
        }
      } else {
        toast.error(result.error || 'Failed to create listing');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      dispatch({ type: 'SET_SUBMITTING', isSubmitting: false });
    }
  }, [state.formData, onSubmit, router]);

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  const progressSteps = useMemo(
    () => createProgressSteps(state.currentStep, state.isValid),
    [state.currentStep, state.isValid]
  );

  const canGoNext = state.isValid[state.currentStep] && !state.isSubmitting;
  const canGoBack = state.currentStep > 1 && !state.isSubmitting;
  const canSubmit = state.currentStep === 2 && state.isValid[1] && state.isValid[2] && !state.isSubmitting;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Property Requirement Listing</CardTitle>
          <WizardProgress steps={progressSteps} currentStep={state.currentStep} />
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step Content */}
          {state.currentStep === 1 && (
            <Step1CompanyInfo
              data={state.formData}
              onUpdate={updateData}
              onNext={goNext}
              onPrevious={goPrevious}
              onValidationChange={(isValid) => 
                dispatch({ type: 'SET_VALID', step: 1, isValid })
              }
              errors={state.errors}
            />
          )}

          {state.currentStep === 2 && (
            <Step2RequirementDetails
              data={state.formData}
              onUpdate={updateData}
              onNext={goNext}
              onPrevious={goPrevious}
              onValidationChange={(isValid) => 
                dispatch({ type: 'SET_VALID', step: 2, isValid })
              }
              errors={state.errors}
            />
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex items-center space-x-4">
              {canGoBack && (
                <Button
                  variant="outline"
                  onClick={goPrevious}
                  disabled={state.isSubmitting}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Auto-save status */}
              {autoSave.lastSaved && (
                <span className="text-sm text-gray-500">
                  Saved {autoSave.lastSaved.toLocaleTimeString()}
                </span>
              )}

              {/* Save button */}
              {onSave && (
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={autoSave.isSaving || state.isSubmitting}
                >
                  {autoSave.isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save
                </Button>
              )}

              {/* Next/Submit button */}
              {state.currentStep < 2 ? (
                <Button
                  onClick={goNext}
                  disabled={!canGoNext}
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={submitWizard}
                  disabled={!canSubmit}
                >
                  {state.isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Listing'
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}