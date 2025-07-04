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

      // Use auto-organization creation service
      const { createListingWithAutoOrganization } = await import('@/lib/auto-organization');
      
      // Prepare data for auto-organization creation
      const listingWithOrgData = {
        // Property requirements data
        sectors: data.sectors,
        useClassIds: data.useClassIds,
        siteSizeMin: data.siteSizeMin,
        siteSizeMax: data.siteSizeMax,
        // Location and files data
        locations: data.locations,
        locationSearchNationwide: data.locationSearchNationwide,
        brochureFiles: data.brochureFiles,
        sitePlanFiles: data.sitePlanFiles,
        fitOutFiles: data.fitOutFiles,
        // Contact data
        contactName: data.contactName,
        contactTitle: data.contactTitle,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        // Company data for organization creation
        companyName: data.companyName,
        logoFile: data.logoFile,
        logoPreview: data.logoPreview
      };

      // Create listing with auto-organization creation
      const result = await createListingWithAutoOrganization(listingWithOrgData, currentUser.id);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to create listing'
        };
      }

      return {
        success: true,
        data: result,
        listingId: result.listingId,
        organizationId: result.organizationId,
        organizationCreated: result.organizationCreated
      };
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
              contactEmail: user.email
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