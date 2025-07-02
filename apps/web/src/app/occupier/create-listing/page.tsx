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

  if (user.role !== 'occupier') {
    redirect('/unauthorized');
  }

  if (!user.org_id) {
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
      
      if (!currentUser || currentUser.role !== 'occupier' || !currentUser.org_id) {
        return { success: false, error: 'Unauthorized' };
      }

      // Transform wizard data to API format
      const listingData = {
        title: data.title,
        description: data.description,
        sector_id: data.sector, // This will need to be mapped to actual sector ID
        use_class_id: data.useClass, // This will need to be mapped to actual use class ID
        site_size_min: data.siteSizeMin,
        site_size_max: data.siteSizeMax,
        // Company info can be stored in organization or listing metadata
      };

      // Create the listing
      const listing = await createListing(listingData, currentUser.id, currentUser.org_id);

      return { 
        success: true, 
        data: listing,
        listingId: listing.id 
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
    
    // This could save as draft to the database
    // For now, we'll just rely on localStorage auto-save
    console.log('Saving draft:', data);
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
          onError={(error, errorInfo) => {
            console.error('Wizard Error:', error, errorInfo);
            // In production, send to monitoring service
          }}
          resetKeys={[user.email]} // Reset boundary when user changes
        >
          <ListingWizard
            initialData={{
              contactEmail: user.email
            }}
            onSubmit={handleSubmit}
            onSave={handleSave}
            userEmail={user.email}
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