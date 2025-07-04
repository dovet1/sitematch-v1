// =====================================================
// Create Listing Page - Story 3.1
// Protected route for occupiers to create listings
// =====================================================

import { redirect } from 'next/navigation';
import { Toaster } from 'sonner';
import { getCurrentUser } from '@/lib/auth';
import { ListingWizard } from '@/components/listings/listing-wizard';
import { createListing } from '@/lib/listings';
import { ErrorBoundary } from '@/components/error-boundary';
import type { WizardFormData, SubmissionResult } from '@/types/wizard';
import type { CreateListingRequest } from '@/types/listings';

// =====================================================
// PAGE COMPONENT
// =====================================================

export default async function CreateListingPage() {
  // Check authentication and authorization
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/auth/login?redirect=/occupier/create-listing');
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  // Only require org_id for occupiers, admins can create listings for any organization
  if (user.role === 'occupier' && !user.org_id) {
    redirect('/occupier/setup-organization');
  }

  // =====================================================
  // SUBMISSION HANDLER
  // =====================================================

  async function handleSubmit(data: WizardFormData): Promise<SubmissionResult> {
    'use server';
    
    try {
      // Get current user for server action
      const currentUser = await getCurrentUser();
      
      if (!currentUser || (currentUser.role !== 'occupier' && currentUser.role !== 'admin')) {
        return { success: false, error: 'Unauthorized' };
      }

      // Use the enhanced listing function that handles contacts and files
      const { createEnhancedListing } = await import('@/lib/enhanced-listings');
      const { finalizeDraftListing } = await import('@/lib/draft-listings');
      const { getOrCreateOrganizationForUser } = await import('@/lib/auto-organization');
      
      // Handle organization creation if needed
      const orgResult = await getOrCreateOrganizationForUser(
        currentUser.id, 
        data.companyName || `${currentUser.email?.split('@')[0] || 'User'} Company`
      );
      
      if (orgResult.error) {
        return { success: false, error: `Failed to create organization: ${orgResult.error}` };
      }

      // Use real database now that tables are set up
      const { getSectors, getUseClasses } = await import('@/lib/listings');
      
      let sectorId, useClassId;
      try {
        const sectors = await getSectors();
        const useClasses = await getUseClasses();
        
        // Use first available sector and use class
        sectorId = sectors[0]?.id;
        useClassId = useClasses[0]?.id;
        
        console.log('Available sectors:', sectors.length);
        console.log('Available use classes:', useClasses.length);
        
      } catch (error) {
        console.error('Failed to fetch reference data:', error);
        return { success: false, error: 'Database not set up properly. Please run the SQL setup script first.' };
      }

      if (!sectorId || !useClassId) {
        return { success: false, error: 'No sectors or use classes available. Please run the SQL setup script first.' };
      }

      // Create enhanced listing data that includes all related data
      const enhancedListingData = {
        title: `Property Requirement - ${data.companyName || 'Company'}`,
        description: `Property requirement from ${data.companyName || 'company'}`,
        sector_id: sectorId,
        use_class_id: useClassId,
        site_size_min: data.siteSizeMin,
        site_size_max: data.siteSizeMax,
        // Contact fields from primary contact
        contact_name: data.primaryContact?.contactName || 'Contact Name',
        contact_title: data.primaryContact?.contactTitle || 'Contact Title', 
        contact_email: data.primaryContact?.contactEmail || currentUser.email || 'contact@example.com',
        contact_phone: data.primaryContact?.contactPhone,
        // Additional data for enhanced listing
        company_name: data.companyName,
        is_nationwide: data.locationSearchNationwide || false,
        locations: data.locationSearchNationwide ? [] : (data.locations || []),
        faqs: data.faqs?.map(faq => ({
          question: faq.question,
          answer: faq.answer,
          display_order: faq.displayOrder
        })) || [],
        additional_contacts: data.additionalContacts?.map(contact => ({
          contact_name: contact.contactName || '',
          contact_title: contact.contactTitle || '',
          contact_email: contact.contactEmail || '',
          contact_phone: contact.contactPhone,
          headshot_url: contact.headshotUrl
        })) || [],
        logo_url: data.logoUrl,
        brochure_urls: data.brochureFiles?.map(f => f.url).filter(Boolean) || [],
        site_plan_urls: data.sitePlanFiles?.map(f => f.url).filter(Boolean) || [],
        fit_out_urls: data.fitOutFiles?.map(f => f.url).filter(Boolean) || [],
        organization_id: orgResult.organizationId,
        status: 'pending' as const
      };

      // Check if we have an existing draft listing to update
      if (data.existingListingId) {
        // Import additional draft listing functions
        const { addContactsToDraftListing, addFAQsToDraftListing, addLocationsToDraftListing } = await import('@/lib/draft-listings');

        // Finalize the existing draft listing
        await finalizeDraftListing(data.existingListingId, {
          title: `Property Requirement - ${data.companyName || 'Company'}`,
          description: `Property requirement from ${data.companyName || 'company'}`,
          status: 'pending'
        });

        // Add contacts to the draft listing
        const contacts = [];
        
        // Add primary contact
        if (data.primaryContact) {
          contacts.push({
            contact_name: data.primaryContact.contactName || 'Contact Name',
            contact_title: data.primaryContact.contactTitle || 'Contact Title',
            contact_email: data.primaryContact.contactEmail || currentUser.email || 'contact@example.com',
            contact_phone: data.primaryContact.contactPhone,
            is_primary_contact: true,
            headshot_url: data.primaryContact.headshotUrl
          });
        }
        
        // Add additional contacts
        if (data.additionalContacts) {
          data.additionalContacts.forEach(contact => {
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
          await addContactsToDraftListing(data.existingListingId, contacts);
        }

        // Add FAQs to the draft listing
        if (data.faqs && data.faqs.length > 0) {
          const transformedFAQs = data.faqs.map(faq => ({
            question: faq.question,
            answer: faq.answer,
            display_order: faq.displayOrder
          }));
          await addFAQsToDraftListing(data.existingListingId, transformedFAQs);
        }

        // Add locations to the draft listing (if not nationwide)
        if (!data.locationSearchNationwide && data.locations && data.locations.length > 0) {
          await addLocationsToDraftListing(data.existingListingId, data.locations);
        }

        return {
          success: true,
          listingId: data.existingListingId,
          organizationId: orgResult.organizationId,
          organizationCreated: orgResult.organizationCreated,
          message: 'Listing submitted successfully'
        };
      } else {
        // Create a new listing (fallback for cases where draft creation failed)
        const listing = await createEnhancedListing(enhancedListingData, currentUser.id, orgResult.organizationId);

        return {
          success: true,
          listingId: listing.id,
          organizationId: orgResult.organizationId,
          organizationCreated: orgResult.organizationCreated,
          message: 'Listing created successfully'
        };
      }
    } catch (error) {
      console.error('Failed to create listing:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create listing' 
      };
    }
  }

  // =====================================================
  // SAVE HANDLER (Draft functionality)
  // =====================================================

  async function handleSave(data: Partial<WizardFormData>): Promise<void> {
    'use server';
    
    try {
      // Get current user for server action
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        throw new Error('Unauthorized');
      }

      // Create a sanitized version without File objects for server action
      const sanitizedData = { ...data };
      
      // Remove File objects as they can't be serialized in server actions
      if (sanitizedData.logoFile instanceof File) {
        delete sanitizedData.logoFile;
      }
      
      // Remove other File arrays as well
      if (sanitizedData.brochureFiles) {
        delete sanitizedData.brochureFiles;
      }
      if (sanitizedData.sitePlanFiles) {
        delete sanitizedData.sitePlanFiles;
      }
      if (sanitizedData.fitOutFiles) {
        delete sanitizedData.fitOutFiles;
      }
      
      // This could save as draft to the database in the future
      // For now, we'll just acknowledge the save was successful
      console.log('Saving draft for user:', currentUser.id, 'data keys:', Object.keys(sanitizedData));
      
      // The actual saving happens in localStorage via the wizard component
    } catch (error) {
      console.error('Save failed:', error);
      throw new Error('Failed to save progress');
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <nav className="flex items-center space-x-4 text-sm">
              <a href="/occupier" className="text-gray-500 hover:text-gray-700">
                Dashboard
              </a>
              <span className="text-gray-300">/</span>
              <a href="/occupier/listings" className="text-gray-500 hover:text-gray-700">
                Listings
              </a>
              <span className="text-gray-300">/</span>
              <span className="text-gray-900 font-medium">Create New Listing</span>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-8">
        <ErrorBoundary
          resetKeys={[user.email]} // Reset boundary when user changes
          context={{
            component: 'ListingWizard',
            userId: user.id,
            feature: 'Listing Creation'
          }}
        >
          <ListingWizard
            initialData={{
              primaryContact: {
                contactName: '',
                contactTitle: '',
                contactEmail: user.email,
                isPrimaryContact: true
              }
            }}
            onSubmit={handleSubmit}
            onSave={handleSave}
            userEmail={user.email}
            organizationId={user.org_id || '00000000-0000-0000-0000-000000000000'}
          />
        </ErrorBoundary>
      </div>

      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
        }}
      />
    </div>
  );
}

// =====================================================
// METADATA
// =====================================================

export const metadata = {
  title: 'Create New Listing - SiteMatch',
  description: 'Create a new property requirement listing',
};