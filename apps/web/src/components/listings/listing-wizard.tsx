// =====================================================
// Listing Wizard Container - Story 3.1
// Main wizard component with step management and form state
// =====================================================

'use client';

import { useEffect, useReducer, useCallback, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useErrorHandling } from '@/hooks/use-error-handling';

import { WizardProgress, createProgressSteps, createProgressStepsForListingType } from './wizard-progress';
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
  shouldAutoSave,
  getVisibleStepsForListingType,
  isStepVisibleForListingType,
  getNextVisibleStep,
  getPreviousVisibleStep,
  getLastVisibleStep,
  canNavigateToStepForListingType
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
      // console.log('UPDATE_DATA action:', { mergedData: updatedData });
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
  userId?: string;
  organizationId?: string; // Optional for backwards compatibility
  editMode?: boolean;
  startFresh?: boolean;
}

export function ListingWizard({ 
  initialData, 
  onSubmit, 
  onSave,
  userEmail,
  userId,
  editMode = false,
  startFresh = false,
  organizationId
}: ListingWizardProps) {
  const router = useRouter();
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const [autoSave, setAutoSave] = useReducer(
    (prev: AutoSaveState, updates: Partial<AutoSaveState>) => ({ ...prev, ...updates }),
    createAutoSaveState()
  );
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const hasCreatedDraftRef = useRef(false);
  const draftCreationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // =====================================================
  // INITIALIZATION
  // =====================================================

  useEffect(() => {
    // Load existing listing data if in edit mode
    if (editMode && initialData?.existingListingId) {
      loadExistingListingData(initialData.existingListingId).catch((error) => {
        console.error('Failed to load existing listing data:', error);
        // Show user-friendly error message
        toast.error('Failed to load listing data. Starting with a fresh form.');
        // Continue with fresh creation mode
      });
      return;
    }

    // Clean up any legacy non-user-specific localStorage data
    if (userId) {
      const legacyData = loadFromLocalStorage(); // Load without userId
      if (legacyData && Object.keys(legacyData).length > 0) {
        // Migrate legacy data to user-specific storage
        saveToLocalStorage(legacyData, userId);
        clearLocalStorage(); // Clear non-user-specific storage
      }
    }

    // Handle draft creation for new listings
    let dataToLoad = initialData || {};
    
    if (!editMode && userId) {
      if (startFresh) {
        // User explicitly wants to start fresh - clear localStorage and create new draft
        clearLocalStorage(userId);
        // Create a new draft listing after a short delay to allow form to initialize
        draftCreationTimeoutRef.current = setTimeout(() => {
          createDraftListing().then((draftId) => {
            if (draftId) {
              console.log('New draft listing created for fresh start:', draftId);
            }
          });
        }, 1000);
      } else {
        // For new listings without explicit fresh flag, load saved data
        const savedData = loadFromLocalStorage(userId);
        if (savedData && Object.keys(savedData).length > 0) {
          // Show a toast to let user know we're restoring their progress
          toast.info('Restoring your previous listing progress...', {
            description: 'We found unsaved changes from your last session'
          });
          // Merge saved data with initial data, prioritizing saved data
          dataToLoad = { ...dataToLoad, ...savedData };
          
          // If we have saved data, try to create a draft listing to store future changes
          draftCreationTimeoutRef.current = setTimeout(() => {
            createDraftListing().then((draftId) => {
              if (draftId) {
                console.log('Draft listing created for restored progress:', draftId);
              }
            });
          }, 1500);
        } else {
          // No saved data, create a new draft for auto-save
          draftCreationTimeoutRef.current = setTimeout(() => {
            createDraftListing().then((draftId) => {
              if (draftId) {
                console.log('New draft listing created for auto-save:', draftId);
              }
            });
          }, 2000);
        }
      }
    }
    
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
  }, [initialData, userEmail, userId, editMode, startFresh]);

  // Cleanup effect - Clear localStorage on unmount if listing was submitted
  useEffect(() => {
    return () => {
      // Only clear if we have a listingId (indicating successful submission)
      if (state.listingId && userId) {
        clearLocalStorage(userId);
      }
    };
  }, [state.listingId, userId]);

  // =====================================================
  // DRAFT LISTING CREATION
  // =====================================================

  const createDraftListing = useCallback(async (): Promise<string | null> => {
    if (isCreatingDraft || hasCreatedDraftRef.current || !userId) {
      return state.listingId || null;
    }

    setIsCreatingDraft(true);
    
    try {
      const response = await fetch('/api/listings/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          userEmail,
          companyName: state.formData.companyName || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create draft listing');
      }

      const result = await response.json();
      
      if (result.success && result.listingId) {
        hasCreatedDraftRef.current = true;
        dispatch({ type: 'SET_LISTING_ID', listingId: result.listingId });
        console.log('Draft listing created:', result.listingId);
        return result.listingId;
      } else {
        throw new Error(result.error || 'Failed to create draft listing');
      }
    } catch (error) {
      console.error('Error creating draft listing:', error);
      toast.error('Failed to create draft. Using local storage instead.');
      return null;
    } finally {
      setIsCreatingDraft(false);
    }
  }, [isCreatingDraft, userId, userEmail, state.formData.companyName, state.listingId]);

  // =====================================================
  // LOAD EXISTING LISTING DATA
  // =====================================================

  const loadExistingListingData = async (listingId: string) => {
    // Validate listing ID format (should be a UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(listingId)) {
      console.warn(`Invalid listing ID format: ${listingId}, switching to new listing mode`);
      if (userId) {
        clearLocalStorage(userId);
      }
      // Remove the edit parameter from the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.history.replaceState({}, '', url.toString());
      return;
    }
    
    try {
      const response = await fetch(`/api/listings/${listingId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to load listing data:', errorData);
        
        // If it's a 404, the listing doesn't exist - clear the edit mode and continue with fresh creation
        if (response.status === 404) {
          console.warn(`Listing ${listingId} not found, switching to new listing mode`);
          // Clear any stored reference to this listing and start fresh
          if (userId) {
            clearLocalStorage(userId);
          }
          // Remove the edit parameter from the URL
          const url = new URL(window.location.href);
          url.searchParams.delete('edit');
          window.history.replaceState({}, '', url.toString());
          return; // Don't throw, just return without loading data
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to load listing data`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Invalid listing data response');
      }
      
      const listing = result.data;
      
      // Debug logging
      console.log('🔍 DEBUG: Raw listing data from API:', listing);
      console.log('🔍 DEBUG: listing_type value:', listing.listing_type);
      console.log('🔍 DEBUG: clearbit_logo value:', listing.clearbit_logo);
      console.log('🔍 DEBUG: company_domain value:', listing.company_domain);
      console.log('🔍 DEBUG: logo_url value:', listing.logo_url);
      console.log('🔍 DEBUG: company_logos array:', listing.company_logos);
      console.log('🔍 DEBUG: property_page_link value:', listing.property_page_link);
      console.log('🔍 DEBUG: dwelling_count_min value:', listing.dwelling_count_min);
      console.log('🔍 DEBUG: dwelling_count_max value:', listing.dwelling_count_max);
      console.log('🔍 DEBUG: site_acreage_min value:', listing.site_acreage_min);
      console.log('🔍 DEBUG: site_acreage_max value:', listing.site_acreage_max);
      
      // Transform database listing to wizard form data
      const formData: Partial<WizardFormData> = {
        existingListingId: listingId,
        companyName: listing.company_name,
        
        // Listing type
        listingType: listing.listing_type || 'commercial',
        
        // Logo method fields
        logoMethod: listing.clearbit_logo ? 'clearbit' : 'upload',
        companyDomain: listing.company_domain || '',
        clearbitLogo: listing.clearbit_logo || false,
        
        // Property page link field
        propertyPageLink: listing.property_page_link || '',
        
        // Sector and Use Class selections from junction tables or fallback to legacy single values
        sectors: listing.sectors?.map((s: any) => s.id) || [],
        useClassIds: listing.use_classes?.map((uc: any) => uc.id) || [],
        
        // Site size requirements (commercial)
        siteSizeMin: listing.site_size_min,
        siteSizeMax: listing.site_size_max,
        
        // Residential fields
        dwellingCountMin: listing.dwelling_count_min,
        dwellingCountMax: listing.dwelling_count_max,
        siteAcreageMin: listing.site_acreage_min,
        siteAcreageMax: listing.site_acreage_max,
        
        primaryContact: {
          contactName: listing.contact_name,
          contactTitle: listing.contact_title,
          contactEmail: listing.contact_email,
          contactPhone: listing.contact_phone,
          contactArea: listing.contact_area,
          isPrimaryContact: true,
          headshotUrl: listing.primary_contact?.headshot_url
        },
        additionalContacts: listing.additional_contacts?.map((contact: any) => ({
          id: contact.id,
          contactName: contact.contact_name,
          contactTitle: contact.contact_title,
          contactEmail: contact.contact_email,
          contactPhone: contact.contact_phone,
          isPrimaryContact: false,
          headshotUrl: contact.headshot_url
        })) || [],
        
        locations: listing.locations || [],
        locationSearchNationwide: !listing.locations || listing.locations.length === 0,
        
        faqs: listing.faqs?.map((faq: any) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          displayOrder: faq.display_order
        })) || [],
        
        // Company logo (from file_uploads table via admin service)
        logoUrl: listing.logo_url || '',
        logoPreview: listing.logo_url || '',
        
        brochureFiles: listing.brochure_url ? [{
          id: 'existing',
          name: 'Company Brochure',
          url: listing.brochure_url,
          path: '',
          type: 'brochure' as const,
          size: 0,
          mimeType: 'application/pdf',
          uploadedAt: new Date()
        }] : [],
        
        // Supporting documents from file_uploads table or fallback to listing_documents
        sitePlanFiles: listing.file_uploads?.filter((file: any) => file.file_type === 'sitePlan').map((file: any) => ({
          id: file.id,
          name: file.file_name || 'Site Plan',
          url: file.file_path,
          path: file.file_path,
          type: 'sitePlan' as const,
          size: file.file_size || 0,
          mimeType: file.mime_type || 'application/pdf',
          uploadedAt: new Date(file.created_at || Date.now())
        })) || listing.listing_documents?.filter((doc: any) => 
          ['sitePlan', 'site_plan'].includes(doc.document_type)
        ).map((doc: any) => ({
          id: doc.id,
          name: doc.file_name || 'Site Plan',
          url: doc.file_url,
          path: '',
          type: 'sitePlan' as const,
          size: doc.file_size || 0,
          mimeType: 'application/pdf',
          uploadedAt: new Date()
        })) || [],
        
        fitOutFiles: listing.file_uploads?.filter((file: any) => file.file_type === 'fitOut').map((file: any) => ({
          id: file.id,
          name: file.file_name || 'Fit-Out Example',
          url: file.file_path,
          path: file.file_path,
          type: 'fitOut' as const,
          size: file.file_size || 0,
          mimeType: file.mime_type || 'image/jpeg',
          uploadedAt: new Date(file.created_at || Date.now()),
          displayOrder: file.display_order || 0,
          caption: file.caption || '',
          isVideo: false,
          thumbnail: ''
        })) || listing.listing_documents?.filter((doc: any) => 
          ['fitOut', 'fit_out'].includes(doc.document_type)
        ).map((doc: any) => ({
          id: doc.id,
          name: doc.file_name || 'Fit-Out',
          url: doc.file_url,
          path: '',
          type: 'fitOut' as const,
          size: doc.file_size || 0,
          mimeType: 'application/pdf',
          uploadedAt: new Date()
        })) || []
      };
      
      // Debug logging for form data
      console.log('🔍 DEBUG: Transformed form data:', formData);
      console.log('🔍 DEBUG: formData.listingType:', formData.listingType);
      console.log('🔍 DEBUG: formData.logoMethod:', formData.logoMethod);
      console.log('🔍 DEBUG: formData.clearbitLogo:', formData.clearbitLogo);
      console.log('🔍 DEBUG: formData.companyDomain:', formData.companyDomain);
      console.log('🔍 DEBUG: formData.logoUrl:', formData.logoUrl);
      console.log('🔍 DEBUG: formData.logoPreview:', formData.logoPreview);
      console.log('🔍 DEBUG: formData.propertyPageLink:', formData.propertyPageLink);
      console.log('🔍 DEBUG: formData.dwellingCountMin:', formData.dwellingCountMin);
      console.log('🔍 DEBUG: formData.dwellingCountMax:', formData.dwellingCountMax);
      console.log('🔍 DEBUG: formData.siteAcreageMin:', formData.siteAcreageMin);
      console.log('🔍 DEBUG: formData.siteAcreageMax:', formData.siteAcreageMax);
      
      dispatch({ type: 'UPDATE_DATA', data: formData });
      
      // Set the listing ID in state so it knows we're editing
      dispatch({ type: 'SET_LISTING_ID', listingId });
      
    } catch (error) {
      console.error('Failed to load existing listing data:', error);
      toast.error('Failed to load listing data. Please try again.');
    }
  };

  // =====================================================
  // DRAFT LISTING CREATION
  // =====================================================

  useEffect(() => {
    // Create draft listing when wizard starts (only if we don't have one already and not in edit mode)
    if (!editMode && !state.listingId && !isCreatingDraft && !hasCreatedDraftRef.current && userEmail) {
      hasCreatedDraftRef.current = true;
      
      // Clear any existing timeout
      if (draftCreationTimeoutRef.current) {
        clearTimeout(draftCreationTimeoutRef.current);
      }
      
      // Debounce draft creation to prevent rapid-fire calls
      draftCreationTimeoutRef.current = setTimeout(async () => {
        if (isCreatingDraft || state.listingId) return; // Double-check conditions
        
        try {
          setIsCreatingDraft(true);
          console.log('Creating draft listing for user:', userEmail);
          const response = await fetch('/api/listings/draft', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userEmail
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Draft listing API error:', response.status, errorText);
            throw new Error(`Failed to create draft listing: ${response.status}`);
          }

          const result = await response.json();
          if (result.success && result.listingId) {
            console.log('Draft listing created/retrieved successfully:', result.listingId);
            dispatch({ type: 'SET_LISTING_ID', listingId: result.listingId });
          } else {
            // Reset flag on failure to allow retry
            hasCreatedDraftRef.current = false;
            throw new Error(result.error || 'Failed to create draft listing');
          }
        } catch (error) {
          console.error('Failed to create draft listing:', error);
          // Reset flag on error to allow retry after a delay
          setTimeout(() => {
            hasCreatedDraftRef.current = false;
          }, 5000);
          // Don't block the wizard if draft creation fails
        } finally {
          setIsCreatingDraft(false);
        }
      }, 100); // 100ms debounce
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (draftCreationTimeoutRef.current) {
        clearTimeout(draftCreationTimeoutRef.current);
      }
    };
  }, [state.listingId, userEmail, editMode]); // Removed isCreatingDraft from dependencies to prevent re-triggers

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
    const autoSaveTimer = setTimeout(async () => {
      if (shouldAutoSave(autoSave, state.formData) && Object.keys(state.formData).length > 0) {
        setAutoSave({ isSaving: true });
        
        try {
          // Save to database draft if we have a listing ID, otherwise fallback to localStorage
          if (state.listingId && onSave) {
            // Use the server action to save to database
            await onSave(state.formData);
          } else {
            // Fallback to localStorage if no draft listing exists yet
            saveToLocalStorage(state.formData, userId);
          }
          
          setAutoSave({ 
            lastSaved: new Date(), 
            isDirty: false, 
            isSaving: false 
          });
        } catch (error) {
          console.error('Auto-save failed:', error);
          setAutoSave({ 
            isSaving: false, 
            saveError: 'Failed to auto-save' 
          });
          
          // Fallback to localStorage if database save fails
          try {
            saveToLocalStorage(state.formData, userId);
            setAutoSave({ saveError: undefined }); // Clear error if localStorage works
          } catch (localError) {
            console.error('LocalStorage fallback also failed:', localError);
          }
        }
      }
    }, 1000);

    return () => clearTimeout(autoSaveTimer);
  }, [state.formData, autoSave, state.listingId, onSave, userId]);

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
      
      console.log('🔍 DEBUG: Submitting wizard with data:', {
        existingListingId: sanitizedData.existingListingId,
        faqsCount: sanitizedData.faqs?.length || 0,
        additionalContactsCount: sanitizedData.additionalContacts?.length || 0,
        faqs: sanitizedData.faqs,
        additionalContacts: sanitizedData.additionalContacts,
        propertyPageLink: sanitizedData.propertyPageLink
      });
      
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
      
      // Clean additional contacts headshot files
      if (sanitizedData.additionalContacts) {
        sanitizedData.additionalContacts = sanitizedData.additionalContacts.map(contact => {
          const cleanContact = { ...contact };
          if (cleanContact.headshotFile instanceof File) {
            cleanContact.headshotFile = undefined;
          }
          return cleanContact;
        });
      }
      
      // Remove other File arrays as well
      if (sanitizedData.brochureFiles) {
        sanitizedData.brochureFiles = sanitizedData.brochureFiles.map(file => {
          if (file instanceof File) return undefined;
          return file;
        }).filter(Boolean) as typeof sanitizedData.brochureFiles;
      }
      if (sanitizedData.sitePlanFiles) {
        sanitizedData.sitePlanFiles = sanitizedData.sitePlanFiles.map(file => {
          if (file instanceof File) return undefined;
          return file;
        }).filter(Boolean) as typeof sanitizedData.sitePlanFiles;
      }
      if (sanitizedData.fitOutFiles) {
        sanitizedData.fitOutFiles = sanitizedData.fitOutFiles.map(file => {
          if (file instanceof File) return undefined;
          return file;
        }).filter(Boolean) as typeof sanitizedData.fitOutFiles;
      }

      const result = await onSubmit(sanitizedData as WizardFormData);
      
      if (result.success) {
        // Clear localStorage after successful submission
        clearLocalStorage(userId);
        
        // Store the new listing ID in state for any future operations
        if (result.listingId) {
          dispatch({ type: 'SET_LISTING_ID', listingId: result.listingId });
        }
        
        toast.success('Listing submitted successfully!');
        
        // Redirect to enhanced success page
        if (result.listingId) {
          router.push(`/occupier/listing-submitted/${result.listingId}`);
        } else {
          router.push('/occupier/dashboard');
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
  }, [state.formData, onSubmit, router, clearLocalStorage, userId]);

  // =====================================================
  // NAVIGATION HANDLERS
  // =====================================================

  const goToStep = useCallback((step: 1 | 2 | 3 | 4 | 5 | 6) => {
    const listingType = state.formData.listingType || 'commercial';
    if (canNavigateToStepForListingType(step, state.currentStep, listingType, state.isValid)) {
      dispatch({ type: 'SET_STEP', step });
    }
  }, [state.currentStep, state.isValid, state.formData.listingType]);

  const goNext = useCallback(async () => {
    const listingType = state.formData.listingType || 'commercial';
    const nextStep = getNextVisibleStep(state.currentStep, listingType);
    const lastStep = getLastVisibleStep(listingType);
    
    // Validate current step before proceeding
    const errors = validateStep(state.currentStep, state.formData);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'SET_ERRORS', errors });
      toast.error('Please fix the errors before continuing');
      return;
    }
    
    // If we're on the last visible step and there's no next step, submit the form
    if (state.currentStep === lastStep && !nextStep) {
      await submitWizard();
    } else if (nextStep) {
      goToStep(nextStep);
    }
  }, [state.currentStep, state.formData, goToStep, submitWizard]);

  const goPrevious = useCallback(() => {
    const listingType = state.formData.listingType || 'commercial';
    const previousStep = getPreviousVisibleStep(state.currentStep, listingType);
    if (previousStep) {
      goToStep(previousStep);
    }
  }, [state.currentStep, state.formData.listingType, goToStep]);

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
        console.log('Saving progress with data:', processedData);
        
        // Upload logo file if present and not already uploaded
        if (processedData.logoFile instanceof File && !processedData.logoUrl) {
          try {
            const { uploadFileViaApi } = await import('@/lib/file-upload-api');
            const uploadedFile = await uploadFileViaApi(
              processedData.logoFile,
              'logo',
              '',
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
              '',
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
                  '',
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
        
        // Save all data to draft listing if we have a listingId
        if (state.listingId) {
          try {
            // Update main listing record with site sizes and other basic data
            const { updateDraftListing } = await import('@/lib/draft-listings');
            const mainUpdateData: any = {};
            
            if (processedData.siteSizeMin !== undefined) {
              mainUpdateData.site_size_min = processedData.siteSizeMin;
            }
            if (processedData.siteSizeMax !== undefined) {
              mainUpdateData.site_size_max = processedData.siteSizeMax;
            }
            if (processedData.companyName) {
              mainUpdateData.company_name = processedData.companyName;
              mainUpdateData.title = `Property Requirement - ${processedData.companyName}`;
            }
            // Save brochure URL to main listing if available
            if (processedData.brochureFiles && processedData.brochureFiles.length > 0) {
              mainUpdateData.brochure_url = processedData.brochureFiles[0].url;
            }
            
            if (Object.keys(mainUpdateData).length > 0) {
              await updateDraftListing(state.listingId, mainUpdateData);
            }

            // Save primary contact to listing_contacts table
            if (processedData.primaryContact && (
              processedData.primaryContact.contactName || 
              processedData.primaryContact.contactEmail ||
              processedData.primaryContact.contactTitle
            )) {
              const { browserClient } = await import('@/lib/supabase');
              
              // Clear existing primary contact first (to handle updates)
              await browserClient.from('listing_contacts')
                .delete()
                .eq('listing_id', state.listingId)
                .eq('is_primary_contact', true);
              
              // Add current primary contact
              await browserClient.from('listing_contacts').insert({
                listing_id: state.listingId,
                contact_name: processedData.primaryContact.contactName || '',
                contact_title: processedData.primaryContact.contactTitle || '',
                contact_email: processedData.primaryContact.contactEmail || '',
                contact_phone: processedData.primaryContact.contactPhone || null,
                contact_area: processedData.primaryContact.contactArea || null,
                headshot_url: processedData.primaryContact.headshotUrl || null,
                is_primary_contact: true
              });
            }

            // Save locations if not nationwide and locations exist
            if (!processedData.locationSearchNationwide && processedData.locations && processedData.locations.length > 0) {
              const { addLocationsToDraftListing } = await import('@/lib/draft-listings');
              
              // Clear existing locations first (to handle updates)
              const { browserClient } = await import('@/lib/supabase');
              await browserClient.from('listing_locations').delete().eq('listing_id', state.listingId);
              
              // Add current locations
              await addLocationsToDraftListing(state.listingId, processedData.locations);
            }
            
            // Save FAQs if they exist
            if (processedData.faqs && processedData.faqs.length > 0) {
              const { addFAQsToDraftListing } = await import('@/lib/draft-listings');
              
              // Clear existing FAQs first (to handle updates)
              const { browserClient } = await import('@/lib/supabase');
              await browserClient.from('faqs').delete().eq('listing_id', state.listingId);
              
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
            const { browserClient } = await import('@/lib/supabase');
            
            // Clear existing contacts first (to handle updates)
            await browserClient.from('listing_contacts').delete().eq('listing_id', state.listingId);
            
            // Add additional contacts only (primary contact is in main listings table)
            const additionalContacts: Array<{
              contact_name: string;
              contact_title: string;
              contact_email: string;
              contact_phone?: string;
              contact_area?: string;
              is_primary_contact: boolean;
              headshot_url?: string;
            }> = [];
            
            if (processedData.additionalContacts) {
              processedData.additionalContacts.forEach(contact => {
                additionalContacts.push({
                  contact_name: contact.contactName || 'Contact Name',
                  contact_title: contact.contactTitle || 'Contact Title',
                  contact_email: contact.contactEmail || 'contact@example.com',
                  contact_phone: contact.contactPhone,
                  contact_area: contact.contactArea,
                  is_primary_contact: false,
                  headshot_url: contact.headshotUrl
                });
              });
            }

            if (additionalContacts.length > 0) {
              await addContactsToDraftListing(state.listingId, additionalContacts);
            }
          } catch (error) {
            console.error('Failed to save locations/FAQs to draft listing:', error);
            // Don't block the save for this
          }
        }
        
        // Deep serialize data for Server Action - remove all non-serializable objects
        const deepSerialize = (obj: any): any => {
          if (obj === null || obj === undefined) {
            return obj;
          }
          
          // Handle primitive types
          if (typeof obj !== 'object') {
            return obj;
          }
          
          // Handle File objects
          if (obj instanceof File) {
            return undefined;
          }
          
          // Handle Date objects
          if (obj instanceof Date) {
            return obj.toISOString();
          }
          
          // Handle Arrays
          if (Array.isArray(obj)) {
            return obj.map(item => deepSerialize(item)).filter(item => item !== undefined);
          }
          
          // Handle plain objects (including objects with null prototype)
          if (typeof obj === 'object') {
            const serialized: any = {};
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                const value = deepSerialize(obj[key]);
                if (value !== undefined) {
                  serialized[key] = value;
                }
              }
            }
            return serialized;
          }
          
          return obj;
        };
        
        const serializedData = deepSerialize(processedData);
        
        // Debug logging temporarily disabled
        
        await onSave(serializedData);
        saveToLocalStorage(processedData, userId);
        setAutoSave({ 
          lastSaved: new Date(), 
          isDirty: false, 
          isSaving: false 
        });
        
        // Update form data with processed data (including uploaded logo URL)
        dispatch({ type: 'UPDATE_DATA', data: processedData });
        
        toast.success('Progress saved');
      } catch (error) {
        console.error('Save progress error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save progress';
        setAutoSave({ isSaving: false, saveError: errorMessage });
        toast.error(`Failed to save progress: ${errorMessage}`);
      }
    }
  }, [onSave, state.formData, state.listingId]);

  // =====================================================
  // COMPUTED VALUES
  // =====================================================

  const progressSteps = useMemo(() => {
    const listingType = state.formData.listingType || 'commercial';
    return createProgressStepsForListingType(state.currentStep, state.isValid, listingType);
  }, [state.currentStep, state.isValid, state.formData.listingType]);

  const listingType = state.formData.listingType || 'commercial';
  const lastVisibleStep = getLastVisibleStep(listingType);
  const canGoNext = state.isValid[state.currentStep] && !state.isSubmitting;
  const canGoBack = state.currentStep > 1 && !state.isSubmitting;
  
  // For residential: can submit when on step 5 (last visible step) and steps 1-5 are valid
  // For commercial: can submit when on step 6 and steps 1-6 are valid
  const canSubmit = state.currentStep === lastVisibleStep && 
    state.isValid[1] && state.isValid[2] && state.isValid[3] && state.isValid[4] && state.isValid[5] && 
    (listingType === 'commercial' ? state.isValid[6] : true) && 
    !state.isSubmitting;

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="max-w-4xl mx-auto p-3 md:p-6">
      <Card className="violet-bloom-card-hover">
        <CardHeader className="pb-4 md:pb-6">
          <CardTitle>
            {editMode ? 'Update Listing' : 'Create New Listing'}
          </CardTitle>
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
              listingId={state.listingId}
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

          {state.currentStep === 6 && isStepVisibleForListingType(6, state.formData.listingType || 'commercial') && (
            <Step6SupportingDocuments
              data={state.formData}
              onUpdate={updateData}
              onNext={goNext}
              onPrevious={goPrevious}
              onValidationChange={(isValid) => 
                dispatch({ type: 'SET_VALID', step: 6, isValid })
              }
              errors={state.errors}
              listingId={state.listingId}
            />
          )}

          {/* Navigation Controls */}
          <div className="pt-4 md:pt-6 border-t">
            {/* Mobile: Stacked Layout */}
            <div className="md:hidden space-y-3">
              {/* Auto-save status */}
              {autoSave.lastSaved && (
                <div className="text-center">
                  <span className="caption text-muted-foreground">
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
              {state.currentStep < lastVisibleStep ? (
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
                  onClick={goNext}
                  disabled={!canSubmit}
                  className="w-full"
                >
                  {state.isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editMode ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    editMode ? 'Update Listing' : 'Submit Listing'
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
                {state.currentStep < lastVisibleStep ? (
                  <Button
                    onClick={goNext}
                    disabled={!canGoNext}
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={goNext}
                    disabled={!canSubmit}
                  >
                    {state.isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editMode ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editMode ? 'Update Listing' : 'Submit Listing'
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