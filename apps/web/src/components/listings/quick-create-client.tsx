// =====================================================
// Quick Create Client Component - Epic 1, Story 1.1
// Client component that handles the immediate creation flow
// =====================================================

'use client';

import { useCallback } from 'react';
import { Step1ImmediateCreation } from './steps/step1-immediate-creation';
import { createListingImmediate } from '@/lib/actions/create-listing-immediate';
import type { CompanyInfoData } from '@/types/wizard';

interface QuickCreateClientProps {
  userEmail: string;
  userId: string;
}

export function QuickCreateClient({ userEmail, userId }: QuickCreateClientProps) {
  const handleImmediateCreation = useCallback(async (data: CompanyInfoData) => {
    console.log('Raw data received:', data);
    console.log('Data keys:', Object.keys(data));
    console.log('Data types:', Object.keys(data).map(key => `${key}: ${typeof data[key as keyof CompanyInfoData]}`));
    
    // Serialize the data to remove File objects and other non-serializable items
    const serializedData = {
      companyName: data.companyName,
      listingType: data.listingType,
      primaryContact: data.primaryContact ? {
        contactName: data.primaryContact.contactName,
        contactTitle: data.primaryContact.contactTitle,  
        contactEmail: data.primaryContact.contactEmail,
        contactPhone: data.primaryContact.contactPhone,
        contactArea: data.primaryContact.contactArea,
        isPrimaryContact: data.primaryContact.isPrimaryContact,
        headshotUrl: data.primaryContact.headshotUrl
      } : undefined,
      clearbitLogo: data.clearbitLogo,
      companyDomain: data.companyDomain,
      logoUrl: data.logoUrl, // Include for uploaded logos
      propertyPageLink: data.propertyPageLink,
      // Handle brochure files - only URLs, not File objects
      brochureFiles: data.brochureFiles?.map((file) => ({
        name: file.name,
        url: file.url,
        path: file.path,
        size: file.size,
        mimeType: file.mimeType
      })).filter((file) => file.url || file.path) || []
    };
    
    console.log('Sending serialized data to server action:', serializedData);
    
    return await createListingImmediate(serializedData);
  }, []);

  return (
    <Step1ImmediateCreation
      data={{
        primaryContact: {
          contactName: '',
          contactTitle: '',
          contactEmail: userEmail,
          isPrimaryContact: true
        }
      }}
      onUpdate={() => {}} // Not needed for immediate creation
      onNext={() => {}} // Not needed for immediate creation
      onPrevious={() => {}} // Not needed for immediate creation
      onValidationChange={() => {}} // Handled internally
      userEmail={userEmail}
      userId={userId}
      onImmediateCreate={handleImmediateCreation}
    />
  );
}