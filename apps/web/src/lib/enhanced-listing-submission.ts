// =====================================================
// Enhanced Listing Submission - Story 3.3
// Complete integration of enhanced wizard with database
// =====================================================

import type { WizardFormData } from '@/types/wizard';
import { uploadFileViaApi } from '@/lib/file-upload-api';

// =====================================================
// TYPES
// =====================================================

export interface SubmissionResult {
  success: boolean;
  listingId?: string;
  error?: string;
  message?: string;
  type?: 'validation' | 'network' | 'server' | 'upload';
}

export interface SubmissionError {
  type: 'validation' | 'network' | 'server' | 'upload';
  message: string;
  field?: string;
  retryable: boolean;
}

export interface FileUploadResults {
  logoUrl?: string;
  brochureUrls?: string[];
  sitePlanUrls?: string[];
  fitOutUrls?: string[];
}

export interface SubmissionState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  progress: number; // 0-100
  error?: SubmissionError;
  listingId?: string;
}

export interface SubmissionSuccess {
  listingId: string;
  title: string;
  submittedAt: Date;
  estimatedReviewTime: string;
  nextSteps: string[];
}

// =====================================================
// MAIN SUBMISSION FUNCTION
// =====================================================

export async function submitEnhancedListing(
  formData: WizardFormData,
  organizationId: string,
  onProgress?: (progress: number) => void
): Promise<SubmissionResult> {
  try {
    onProgress?.(0);

    // 1. Upload all file types with progress tracking
    const fileUploads = await uploadAllFiles(formData, organizationId, (progress) => {
      onProgress?.(progress * 0.4); // Files are 40% of submission
    });

    // 2. Process FAQ data
    const processedFaqs = (formData.faqs || []).map((faq, index) => ({
      question: faq.question,
      answer: faq.answer,
      display_order: index
    }));

    // 3. Prepare enhanced listing data with all PRD fields
    const enhancedListingData = {
      // Enhanced contact fields (PRD required)
      contact_name: formData.contactName,
      contact_title: formData.contactTitle,
      contact_email: formData.contactEmail,
      contact_phone: formData.contactPhone,
      
      // Company information
      company_name: formData.companyName,
      
      // Property requirements
      sectors: formData.sectors || [],
      use_class_ids: formData.useClassIds || [],
      site_size_min: formData.siteSizeMin,
      site_size_max: formData.siteSizeMax,
      
      // File URLs
      logo_url: fileUploads.logoUrl,
      brochure_urls: fileUploads.brochureUrls || [],
      site_plan_urls: fileUploads.sitePlanUrls || [],
      fit_out_urls: fileUploads.fitOutUrls || [],
      
      // Location data with nationwide toggle
      locations: formData.locationSearchNationwide ? [] : (formData.locations || []),
      is_nationwide: formData.locationSearchNationwide || false,
      
      // FAQ data
      faqs: processedFaqs,
      
      // Organization ID
      organization_id: organizationId,
      
      status: 'pending'
    };

    onProgress?.(60); // Data preparation complete

    // 4. Validate the enhanced listing data before submission
    const validation = validateListingData(formData);
    if (!validation.valid) {
      const errorMessages = Object.values(validation.errors).join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    // 5. Submit directly to enhanced listing creation function
    // Since this is called from server actions, we don't need to make an API call
    console.log('Creating enhanced listing with data:', enhancedListingData);
    
    const { createEnhancedListing } = await import('@/lib/enhanced-listings');
    const { getCurrentUser } = await import('@/lib/auth');
    
    // Get current user for the listing creation
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    // Create the enhanced listing directly
    console.log('Calling createEnhancedListing with:', {
      userId: currentUser.id,
      organizationId,
      dataKeys: Object.keys(enhancedListingData)
    });
    
    const result = await createEnhancedListing(
      enhancedListingData, 
      currentUser.id, 
      organizationId
    );
    
    console.log('createEnhancedListing result:', result);

    onProgress?.(90); // Listing creation complete

    // 6. Send confirmation email
    try {
      const { sendSubmissionConfirmation } = await import('@/lib/enhanced-listings');
      await sendSubmissionConfirmation(enhancedListingData.contact_email, result.id);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the submission for email errors
    }

    onProgress?.(100); // Complete

    return {
      success: true,
      listingId: result.id,
      message: 'Listing submitted successfully for admin review'
    };

  } catch (error) {
    console.error('Enhanced listing submission failed:', error);
    console.error('Error type:', typeof error);
    console.error('Error instanceof Error:', error instanceof Error);
    console.error('Error message:', error instanceof Error ? error.message : 'No message');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    const errorMessage = error instanceof Error && error.message 
      ? error.message 
      : 'An unexpected error occurred during listing creation';
      
    return {
      success: false,
      error: errorMessage,
      type: categorizeError(error)
    };
  }
}

// =====================================================
// FILE UPLOAD UTILITIES
// =====================================================

async function uploadAllFiles(
  formData: WizardFormData,
  organizationId: string,
  onProgress: (progress: number) => void
): Promise<FileUploadResults> {
  const results: FileUploadResults = {};
  let completedUploads = 0;
  const totalFiles = countTotalFiles(formData);

  if (totalFiles === 0) {
    onProgress(1);
    return results;
  }

  // Upload logo
  if (formData.logoFile instanceof File) {
    try {
      const uploadedFile = await uploadFileViaApi(formData.logoFile, 'logo', organizationId);
      results.logoUrl = uploadedFile.url;
      completedUploads++;
      onProgress(completedUploads / totalFiles);
    } catch (error) {
      console.error('Logo upload failed:', error);
      // Continue with other uploads
    }
  } else if (formData.logoUrl) {
    results.logoUrl = formData.logoUrl;
  }

  // Upload brochures
  if (formData.brochureFiles && formData.brochureFiles.length > 0) {
    results.brochureUrls = [];
    for (const file of formData.brochureFiles) {
      if (file.url) {
        results.brochureUrls.push(file.url);
        completedUploads++;
        onProgress(completedUploads / totalFiles);
      }
    }
  }

  // Upload site plans
  if (formData.sitePlanFiles && formData.sitePlanFiles.length > 0) {
    results.sitePlanUrls = [];
    for (const file of formData.sitePlanFiles) {
      if (file.url) {
        results.sitePlanUrls.push(file.url);
        completedUploads++;
        onProgress(completedUploads / totalFiles);
      }
    }
  }

  // Upload fit-out examples
  if (formData.fitOutFiles && formData.fitOutFiles.length > 0) {
    results.fitOutUrls = [];
    for (const file of formData.fitOutFiles) {
      if (file.url) {
        results.fitOutUrls.push(file.url);
        completedUploads++;
        onProgress(completedUploads / totalFiles);
      }
    }
  }

  return results;
}

function countTotalFiles(formData: WizardFormData): number {
  let count = 0;
  
  if (formData.logoFile instanceof File) count++;
  if (formData.brochureFiles) count += formData.brochureFiles.length;
  if (formData.sitePlanFiles) count += formData.sitePlanFiles.length;
  if (formData.fitOutFiles) count += formData.fitOutFiles.length;
  
  return count;
}

// =====================================================
// ERROR HANDLING UTILITIES
// =====================================================

function categorizeError(error: unknown): SubmissionError['type'] {
  if (error instanceof Error) {
    if (error.message.includes('validation')) return 'validation';
    if (error.message.includes('network') || error.message.includes('fetch')) return 'network';
    if (error.message.includes('upload')) return 'upload';
  }
  return 'server';
}

export function handleSubmissionError(error: SubmissionError): void {
  switch (error.type) {
    case 'validation':
      // Field-specific error handling will be done by the wizard
      console.error('Validation error:', error.message);
      break;
    case 'network':
      console.error('Network error:', error.message);
      break;
    case 'upload':
      console.error('Upload error:', error.message);
      break;
    case 'server':
      console.error('Server error:', error.message);
      break;
  }
}

// =====================================================
// VALIDATION UTILITIES
// =====================================================

export function validateListingData(data: WizardFormData): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  // Required contact fields
  if (!data.contactName?.trim()) {
    errors.contactName = 'Contact name is required';
  }
  if (!data.contactTitle?.trim()) {
    errors.contactTitle = 'Contact title is required';
  }
  if (!data.contactEmail?.trim()) {
    errors.contactEmail = 'Contact email is required';
  }
  if (!data.companyName?.trim()) {
    errors.companyName = 'Company name is required';
  }

  // Location validation
  if (!data.locationSearchNationwide && (!data.locations || data.locations.length === 0)) {
    errors.locations = 'Please select locations or choose nationwide coverage';
  }

  // FAQ validation
  if (data.faqs && data.faqs.length > 0) {
    data.faqs.forEach((faq, index) => {
      if (!faq.question?.trim()) {
        errors[`faq_${index}_question`] = `FAQ ${index + 1} question is required`;
      }
      if (!faq.answer?.trim()) {
        errors[`faq_${index}_answer`] = `FAQ ${index + 1} answer is required`;
      }
    });
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}