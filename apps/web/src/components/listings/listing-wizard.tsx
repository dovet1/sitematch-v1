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
import { Step3LocationFiles } from './steps/step3-location-files';
import { Step4AdditionalContacts } from './steps/step4-additional-contacts';
import { Step5FAQs } from './steps/step5-faqs';
import { Step6SupportingDocuments } from './steps/step6-supporting-documents';

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
  isValid: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
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
    
    case 'SET_LISTING_ID':
      return { ...state, listingId: action.listingId };
    
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
  organizationId: string;
}

export function ListingWizard({ 
  initialData, 
  onSubmit, 
  onSave,
  userEmail,
  organizationId
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
    if (userEmail && !dataToLoad.primaryContact?.contactEmail) {
      if (!dataToLoad.primaryContact) {
        dataToLoad.primaryContact = {
          contactName: '',
          contactTitle: '',
          contactEmail: userEmail,
          isPrimaryContact: true
        };
      } else {
        dataToLoad.primaryContact.contactEmail = userEmail;
      }
    }

    if (Object.keys(dataToLoad).length > 0) {
      dispatch({ type: 'UPDATE_DATA', data: dataToLoad });
    }
  }, [initialData, userEmail]);

  // =====================================================
  // DRAFT LISTING CREATION
  // =====================================================

  useEffect(() => {
    // Create draft listing when wizard starts (only if we don't have one already)
    if (!state.listingId && organizationId && organizationId !== '00000000-0000-0000-0000-000000000000') {
      createDraftListing();
    }
  }, [organizationId, state.listingId]);

  const createDraftListing = async () => {
    try {
      const response = await fetch('/api/listings/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          userEmail
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create draft listing');
      }

      const result = await response.json();
      if (result.success && result.listingId) {
        dispatch({ type: 'SET_LISTING_ID', listingId: result.listingId });
      } else {
        throw new Error(result.error || 'Failed to create draft listing');
      }
    } catch (error) {
      console.error('Failed to create draft listing:', error);
      // Don't block the wizard if draft creation fails
    }
  };

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
    if (state.currentStep === 3) {
      const isStep1Valid = isStepValid(1, state.formData);
      const isStep2Valid = isStepValid(2, state.formData);
      dispatch({ type: 'SET_VALID', step: 1, isValid: isStep1Valid });
      dispatch({ type: 'SET_VALID', step: 2, isValid: isStep2Valid });
    }
    if (state.currentStep >= 4) {
      const isStep1Valid = isStepValid(1, state.formData);
      const isStep2Valid = isStepValid(2, state.formData);
      const isStep3Valid = isStepValid(3, state.formData);
      dispatch({ type: 'SET_VALID', step: 1, isValid: isStep1Valid });
      dispatch({ type: 'SET_VALID', step: 2, isValid: isStep2Valid });
      dispatch({ type: 'SET_VALID', step: 3, isValid: isStep3Valid });
      
      if (state.currentStep >= 5) {
        const isStep4Valid = isStepValid(4, state.formData);
        dispatch({ type: 'SET_VALID', step: 4, isValid: isStep4Valid });
        
        if (state.currentStep === 6) {
          const isStep5Valid = isStepValid(5, state.formData);
          dispatch({ type: 'SET_VALID', step: 5, isValid: isStep5Valid });
        }
      }
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

  const goToStep = useCallback((step: 1 | 2 | 3 | 4 | 5 | 6) => {
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
        
        // Create a copy of form data for processing
        let processedData = { ...state.formData };
        
        // Upload logo file if present and not already uploaded
        if (processedData.logoFile instanceof File && !processedData.logoUrl) {
          try {
            const { uploadFileViaApi } = await import('@/lib/file-upload-api');
            const uploadedFile = await uploadFileViaApi(
              processedData.logoFile,
              'logo',
              organizationId,
              undefined,
              state.listingId
            );
            
            // Replace File object with uploaded file data
            delete processedData.logoFile;
            processedData.logoPreview = uploadedFile.url;
            processedData.logoUrl = uploadedFile.url;
            
            toast.success('Logo uploaded successfully');
          } catch (uploadError) {
            console.error('Logo upload failed:', uploadError);
            toast.error('Logo upload failed, but other data saved');
            // Continue with save even if logo upload fails
            delete processedData.logoFile;
          }
        }
        
        // Upload primary contact headshot if present and not already uploaded
        if (processedData.primaryContact?.headshotFile instanceof File && !processedData.primaryContact?.headshotUrl) {
          try {
            const { uploadFileViaApi } = await import('@/lib/file-upload-api');
            const uploadedFile = await uploadFileViaApi(
              processedData.primaryContact.headshotFile,
              'headshot',
              organizationId,
              undefined,
              state.listingId
            );
            
            // Replace File object with uploaded file data
            delete processedData.primaryContact.headshotFile;
            processedData.primaryContact.headshotPreview = uploadedFile.url;
            processedData.primaryContact.headshotUrl = uploadedFile.url;
            
            toast.success('Headshot uploaded successfully');
          } catch (uploadError) {
            console.error('Primary contact headshot upload failed:', uploadError);
            toast.error('Headshot upload failed, but other data saved');
            // Continue with save even if headshot upload fails
            if (processedData.primaryContact) {
              delete processedData.primaryContact.headshotFile;
            }
          }
        }
        
        // Upload additional contacts headshots if present and not already uploaded
        if (processedData.additionalContacts && processedData.additionalContacts.length > 0) {
          for (let i = 0; i < processedData.additionalContacts.length; i++) {
            const contact = processedData.additionalContacts[i];
            if (contact.headshotFile instanceof File && !contact.headshotUrl) {
              try {
                const { uploadFileViaApi } = await import('@/lib/file-upload-api');
                const uploadedFile = await uploadFileViaApi(
                  contact.headshotFile,
                  'headshot',
                  organizationId,
                  undefined,
                  state.listingId
                );
                
                // Replace File object with uploaded file data
                delete processedData.additionalContacts[i].headshotFile;
                processedData.additionalContacts[i].headshotPreview = uploadedFile.url;
                processedData.additionalContacts[i].headshotUrl = uploadedFile.url;
                
                toast.success(`Additional contact headshot uploaded successfully`);
              } catch (uploadError) {
                console.error(`Additional contact ${i} headshot upload failed:`, uploadError);
                toast.error(`Additional contact headshot upload failed, but other data saved`);
                // Continue with save even if headshot upload fails
                delete processedData.additionalContacts[i].headshotFile;
              }
            }
          }
        }
        
        // Save locations and FAQs to draft listing if we have a listingId
        if (state.listingId) {
          try {
            // Save locations if not nationwide and locations exist
            if (!processedData.locationSearchNationwide && processedData.locations && processedData.locations.length > 0) {
              const { addLocationsToDraftListing } = await import('@/lib/draft-listings');
              
              // Clear existing locations first (to handle updates)
              const { createServerClient } = await import('@/lib/supabase');
              const supabase = createServerClient();
              await supabase.from('listing_locations').delete().eq('listing_id', state.listingId);
              
              // Add current locations
              await addLocationsToDraftListing(state.listingId, processedData.locations);
            }
            
            // Save FAQs if they exist
            if (processedData.faqs && processedData.faqs.length > 0) {
              const { addFAQsToDraftListing } = await import('@/lib/draft-listings');
              
              // Clear existing FAQs first (to handle updates)
              const { createServerClient } = await import('@/lib/supabase');
              const supabase = createServerClient();
              await supabase.from('faqs').delete().eq('listing_id', state.listingId);
              
              // Transform and add current FAQs
              const transformedFAQs = processedData.faqs.map(faq => ({
                question: faq.question,
                answer: faq.answer,
                display_order: faq.displayOrder
              }));
              await addFAQsToDraftListing(state.listingId, transformedFAQs);
            }
            
            // Save contacts to draft listing
            const { addContactsToDraftListing } = await import('@/lib/draft-listings');
            const { createServerClient } = await import('@/lib/supabase');
            const supabase = createServerClient();
            
            // Clear existing contacts first (to handle updates)
            await supabase.from('listing_contacts').delete().eq('listing_id', state.listingId);
            
            // Add current contacts
            const contacts = [];
            
            // Add primary contact
            if (processedData.primaryContact) {
              contacts.push({
                contact_name: processedData.primaryContact.contactName || 'Contact Name',
                contact_title: processedData.primaryContact.contactTitle || 'Contact Title',
                contact_email: processedData.primaryContact.contactEmail || userEmail || 'contact@example.com',
                contact_phone: processedData.primaryContact.contactPhone,
                is_primary_contact: true,
                headshot_url: processedData.primaryContact.headshotUrl
              });
            }
            
            // Add additional contacts
            if (processedData.additionalContacts) {
              processedData.additionalContacts.forEach(contact => {
                contacts.push({
                  contact_name: contact.contactName || 'Contact Name',
                  contact_title: contact.contactTitle || 'Contact Title',
                  contact_email: contact.contactEmail || 'contact@example.com',
                  contact_phone: contact.contactPhone,
                  is_primary_contact: false,
                  headshot_url: contact.headshotUrl
                });
              });
            }

            if (contacts.length > 0) {
              await addContactsToDraftListing(state.listingId, contacts);
            }
          } catch (error) {
            console.error('Failed to save locations/FAQs to draft listing:', error);
            // Don't block the save for this
          }
        }
        
        await onSave(processedData);
        saveToLocalStorage(processedData);
        setAutoSave({ 
          lastSaved: new Date(), 
          isDirty: false, 
          isSaving: false 
        });
        
        // Update form data with processed data (including uploaded logo URL)
        dispatch({ type: 'UPDATE_DATA', data: processedData });
        
        toast.success('Progress saved');
      } catch (error) {
        setAutoSave({ isSaving: false, saveError: 'Failed to save' });
        toast.error('Failed to save progress');
      }
    }
  }, [onSave, state.formData, organizationId]);

  // =====================================================
  // SUBMISSION HANDLER
  // =====================================================

  const submitWizard = useCallback(async (): Promise<SubmissionResult> => {
    // Final validation
    const step1Errors = validateStep(1, state.formData);
    const step2Errors = validateStep(2, state.formData);
    const step3Errors = validateStep(3, state.formData);
    const step4Errors = validateStep(4, state.formData);
    const step5Errors = validateStep(5, state.formData);
    const step6Errors = validateStep(6, state.formData);
    const allErrors = { ...step1Errors, ...step2Errors, ...step3Errors, ...step4Errors, ...step5Errors, ...step6Errors };

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
      // Sanitize form data for Server Action - remove File objects
      const sanitizedData = { ...state.formData };
      
      // Remove File objects that can't be serialized
      if (sanitizedData.logoFile instanceof File) {
        delete sanitizedData.logoFile;
      }
      
      // Clean primary contact headshot file
      if (sanitizedData.primaryContact?.headshotFile instanceof File) {
        sanitizedData.primaryContact = {
          ...sanitizedData.primaryContact,
          headshotFile: undefined
        };
      }
      
      // Clean additional contacts
      if (sanitizedData.additionalContacts) {
        sanitizedData.additionalContacts = sanitizedData.additionalContacts.map(contact => {
          const cleanContact = { ...contact };
          if (cleanContact.headshotFile instanceof File) {
            delete cleanContact.headshotFile;
          }
          return cleanContact;
        });
      }
      
      // Clean up any other potential File objects in file arrays
      if (sanitizedData.brochureFiles) {
        sanitizedData.brochureFiles = sanitizedData.brochureFiles.filter(file => !(file instanceof File));
      }
      if (sanitizedData.sitePlanFiles) {
        sanitizedData.sitePlanFiles = sanitizedData.sitePlanFiles.filter(file => !(file instanceof File));
      }
      if (sanitizedData.fitOutFiles) {
        sanitizedData.fitOutFiles = sanitizedData.fitOutFiles.filter(file => !(file instanceof File));
      }
      
      // Add existing listingId to the submission data
      const submissionData = {
        ...sanitizedData,
        existingListingId: state.listingId
      } as WizardFormData;

      const result = await onSubmit(submissionData);
      
      if (result.success) {
        clearLocalStorage();
        toast.success('Listing submitted successfully!');
        
        // Redirect to enhanced success page
        if (result.listingId) {
          router.push(`/occupier/listing-submitted/${result.listingId}`);
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
  const canSubmit = state.currentStep === 6 && state.isValid[1] && state.isValid[2] && state.isValid[3] && state.isValid[4] && state.isValid[5] && state.isValid[6] && !state.isSubmitting;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="max-w-4xl mx-auto p-3 md:p-6">
      <Card>
        <CardHeader className="pb-4 md:pb-6">
          <CardTitle className="text-lg md:text-xl">Create Property Requirement Listing</CardTitle>
          <WizardProgress steps={progressSteps} currentStep={state.currentStep} />
        </CardHeader>

        <CardContent className="space-y-4 md:space-y-6 px-3 md:px-6">
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
              organizationId={organizationId}
              listingId={state.listingId}
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

          {state.currentStep === 3 && (
            <Step3LocationFiles
              data={state.formData}
              onUpdate={updateData}
              onNext={goNext}
              onPrevious={goPrevious}
              onValidationChange={(isValid) => 
                dispatch({ type: 'SET_VALID', step: 3, isValid })
              }
              errors={state.errors}
            />
          )}

          {state.currentStep === 4 && (
            <Step4AdditionalContacts
              data={state.formData}
              onUpdate={updateData}
              onNext={goNext}
              onPrevious={goPrevious}
              onValidationChange={(isValid) => 
                dispatch({ type: 'SET_VALID', step: 4, isValid })
              }
              errors={state.errors}
            />
          )}

          {state.currentStep === 5 && (
            <Step5FAQs
              data={state.formData}
              onUpdate={updateData}
              onNext={goNext}
              onPrevious={goPrevious}
              onValidationChange={(isValid) => 
                dispatch({ type: 'SET_VALID', step: 5, isValid })
              }
              errors={state.errors}
            />
          )}

          {state.currentStep === 6 && (
            <Step6SupportingDocuments
              data={state.formData}
              onUpdate={updateData}
              onNext={goNext}
              onPrevious={goPrevious}
              onValidationChange={(isValid) => 
                dispatch({ type: 'SET_VALID', step: 6, isValid })
              }
              errors={state.errors}
              organizationId={organizationId}
            />
          )}

          {/* Navigation Controls */}
          <div className="pt-4 md:pt-6 border-t">
            {/* Mobile: Stacked Layout */}
            <div className="md:hidden space-y-3">
              {/* Auto-save status */}
              {autoSave.lastSaved && (
                <div className="text-center">
                  <span className="text-xs text-gray-500">
                    Saved {autoSave.lastSaved.toLocaleTimeString()}
                  </span>
                </div>
              )}
              
              {/* Navigation buttons */}
              <div className="flex gap-2">
                {canGoBack && (
                  <Button
                    variant="outline"
                    onClick={goPrevious}
                    disabled={state.isSubmitting}
                    className="flex-1"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                )}
                
                {onSave && (
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={autoSave.isSaving || state.isSubmitting}
                    className="flex-1"
                  >
                    {autoSave.isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save
                  </Button>
                )}
              </div>
              
              {/* Next/Submit button */}
              {state.currentStep < 6 ? (
                <Button
                  onClick={goNext}
                  disabled={!canGoNext}
                  className="w-full"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={submitWizard}
                  disabled={!canSubmit}
                  className="w-full"
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

            {/* Desktop: Horizontal Layout */}
            <div className="hidden md:flex items-center justify-between">
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
                {state.currentStep < 6 ? (
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}