// =====================================================
// Listing Detail Page Route - Epic 1, Story 1.2
// New route for viewing and editing listing details
// =====================================================

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { ListingDetailPage } from '@/components/listings/listing-detail-page';

interface ListingDetailRouteProps {
  params: {
    id: string;
  };
}

export default async function ListingDetailRoute({ params }: ListingDetailRouteProps) {
  // Check authentication and authorization
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/?login=1&redirect=/occupier/listing/' + params.id);
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb Navigation with Action Buttons */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <nav className="flex items-center space-x-4 body-small">
              <Link href="/occupier/dashboard" className="text-muted-foreground hover:text-foreground violet-bloom-nav-item">
                Dashboard
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium">
                Listing Details
              </span>
            </nav>
            <div className="flex items-center gap-2">
              {/* These will be dynamically controlled by the listing component */}
              <div id="listing-action-buttons"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <ListingDetailPage 
        listingId={params.id}
        userId={user.id}
        showHeaderBar={false}
      />
    </div>
  );
}

export const metadata = {
  title: 'Listing Details - SiteMatch',
  description: 'View and edit your property listing details',
};