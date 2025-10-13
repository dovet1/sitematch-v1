// =====================================================
// Quick Create Listing Page - Epic 1, Story 1.1
// New immediate creation flow that creates listing after Step 1
// =====================================================

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Toaster } from 'sonner';
import { getCurrentUser } from '@/lib/auth';
import { QuickCreateClient } from '@/components/listings/quick-create-client';
import { ErrorBoundary } from '@/components/error-boundary';
import type { CompanyInfoData } from '@/types/wizard';

export const dynamic = 'force-dynamic';

// =====================================================
// PAGE COMPONENT
// =====================================================

export default async function QuickCreateListingPage() {
  // Check authentication and authorization
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/?login=1&redirect=/occupier/create-listing-quick');
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb Navigation */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <nav className="flex items-center space-x-4 body-small">
              <Link href="/occupier/dashboard" className="text-muted-foreground hover:text-foreground violet-bloom-nav-item">
                Dashboard
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium">
                Create new listing
              </span>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Create your property listing
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started with your basic information. We'll create your listing immediately, 
              and you can add more details on the next page.
            </p>
          </div>

          <ErrorBoundary
            resetKeys={[user.email]}
            context={{
              component: 'QuickCreateListing',
              userId: user.id,
              feature: 'Immediate Listing Creation'
            }}
          >
            <QuickCreateClient
              userEmail={user.email}
              userId={user.id}
            />
          </ErrorBoundary>
        </div>
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
  title: 'Create New Listing - SiteMatcher',
  description: 'Create a new property requirement listing quickly',
};