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
  photoUrls?: string[];
  videoUrls?: string[];
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
    console.log('🔍 DEBUG: Preparing enhancedListingData with propertyPageLink:', formData.propertyPageLink);
    const enhancedListingData = {
      // Enhanced contact fields (PRD required) - from primary contact
      contact_name: formData.primaryContact?.contactName,
      contact_title: formData.primaryContact?.contactTitle,
      contact_email: formData.primaryContact?.contactEmail,
      contact_phone: formData.primaryContact?.contactPhone,
      contact_area: formData.primaryContact?.contactArea,
      
      // Company information
      company_name: formData.companyName,
      listing_type: formData.listingType || 'commercial',
      
      // Property requirements
      sectors: formData.sectors || [],
      use_class_ids: formData.useClassIds || [],
      site_size_min: formData.siteSizeMin,
      site_size_max: formData.siteSizeMax,
      
      // Residential fields
      dwelling_count_min: formData.dwellingCountMin,
      dwelling_count_max: formData.dwellingCountMax,
      site_acreage_min: formData.siteAcreageMin,
      site_acreage_max: formData.siteAcreageMax,
      
      // File URLs and logo method fields - Story 9.0
      // Logo handling: Clearbit uses company_domain, uploaded logos stored in file_uploads table
      clearbit_logo: formData.clearbitLogo || false,
      company_domain: formData.companyDomain,
      brochure_urls: fileUploads.brochureUrls || [],
      photo_urls: fileUploads.photoUrls || [],
      video_urls: fileUploads.videoUrls || [],
      
      // Property page link field
      property_page_link: formData.propertyPageLink,
      
      // Location data with nationwide toggle
      locations: formData.locationSearchNationwide ? [] : (formData.locations || []),
      is_nationwide: formData.locationSearchNationwide || false,
      
      // FAQ data
      faqs: processedFaqs,
      
      // Additional contacts data
      additional_contacts: formData.additionalContacts?.map(contact => ({
        contact_name: contact.contactName || '',
        contact_title: contact.contactTitle || '',
        contact_email: contact.contactEmail || '',
        contact_phone: contact.contactPhone,
        contact_area: contact.contactArea,
        headshot_url: contact.headshotUrl
      })) || [],
      
      // Organization ID
      organization_id: organizationId,
      
      status: 'pending' as const
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
      currentUser.id
    );
    
    console.log('createEnhancedListing result:', result);

    onProgress?.(90); // Listing creation complete

    // 6. Send confirmation email
    try {
      const { sendSubmissionEmail } = await import('@/lib/email-templates');
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      
      await sendSubmissionEmail({
        contactName: enhancedListingData.contact_name || 'Valued Customer',
        companyName: enhancedListingData.company_name || 'Your Company',
        listingTitle: `Property Requirement - ${enhancedListingData.company_name}`,
        dashboardUrl: `${baseUrl}/new-dashboard`,
        previewUrl: `${baseUrl}/occupier/listing/${result.id}`,
        contactEmail: enhancedListingData.contact_email
      });
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

  // Upload logo - check if already uploaded or needs uploading
  console.log('🔍 DEBUG: Logo submission check - logoUrl:', formData.logoUrl, 'clearbitLogo:', formData.clearbitLogo, 'logoFile:', formData.logoFile?.name || 'none');
  
  if (formData.logoUrl && !formData.clearbitLogo) {
    // Logo already uploaded (from Step1), use existing URL
    console.log('🔍 DEBUG: Using existing uploaded logo URL:', formData.logoUrl);
    results.logoUrl = formData.logoUrl;
    completedUploads++;
    onProgress(completedUploads / totalFiles);
  } else if (formData.logoFile instanceof File && !formData.logoUrl) {
    // Logo file needs to be uploaded
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
    // Use existing URL (could be Clearbit or uploaded)
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

  // Upload photos
  if (formData.photoFiles && formData.photoFiles.length > 0) {
    results.photoUrls = [];
    for (const file of formData.photoFiles) {
      if (file.url) {
        results.photoUrls.push(file.url);
        completedUploads++;
        onProgress(completedUploads / totalFiles);
      }
    }
  }

  // Upload videos
  if (formData.videoFiles && formData.videoFiles.length > 0) {
    results.videoUrls = [];
    for (const file of formData.videoFiles) {
      if (file.url) {
        results.videoUrls.push(file.url);
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
  if (formData.photoFiles) count += formData.photoFiles.length;
  if (formData.videoFiles) count += formData.videoFiles.length;

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

  // Required contact fields (from primary contact)
  if (!data.primaryContact?.contactName?.trim()) {
    errors.contactName = 'Contact name is required';
  }
  if (!data.primaryContact?.contactTitle?.trim()) {
    errors.contactTitle = 'Contact title is required';
  }
  if (!data.primaryContact?.contactEmail?.trim()) {
    errors.contactEmail = 'Contact email is required';
  }
  if (!data.companyName?.trim()) {
    errors.companyName = 'Company name is required';
  }

  // Property page link validation (optional field)
  console.log('🔍 DEBUG: Validating propertyPageLink:', data.propertyPageLink);
  if (data.propertyPageLink && data.propertyPageLink.trim()) {
    const urlPattern = /^https?:\/\/[^\s/$.?#].[^\s]*$/;
    if (!urlPattern.test(data.propertyPageLink.trim())) {
      errors.propertyPageLink = 'Property page link must be a valid URL starting with http:// or https://';
    }
  }

  // Location validation
  if (!data.locationSearchNationwide && (!data.locations || data.locations.length === 0)) {
    errors.locations = 'Please select locations or choose nationwide coverage';
  }

  // Residential fields validation
  if (data.dwellingCountMin !== undefined && data.dwellingCountMax !== undefined) {
    if (data.dwellingCountMin < 0) {
      errors.dwellingCountMin = 'Minimum dwelling count must be 0 or greater';
    }
    if (data.dwellingCountMax < 0) {
      errors.dwellingCountMax = 'Maximum dwelling count must be 0 or greater';
    }
    if (data.dwellingCountMin > data.dwellingCountMax) {
      errors.dwellingCountRange = 'Minimum dwelling count must be less than or equal to maximum';
    }
  }

  if (data.siteAcreageMin !== undefined && data.siteAcreageMax !== undefined) {
    if (data.siteAcreageMin < 0) {
      errors.siteAcreageMin = 'Minimum site acreage must be 0 or greater';
    }
    if (data.siteAcreageMax < 0) {
      errors.siteAcreageMax = 'Maximum site acreage must be 0 or greater';
    }
    if (data.siteAcreageMin > data.siteAcreageMax) {
      errors.siteAcreageRange = 'Minimum site acreage must be less than or equal to maximum';
    }
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