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
    <ListingDetailPage 
      listingId={params.id}
      userId={user.id}
      showHeaderBar={false}
    />
  );
}

export const metadata = {
  title: 'Listing Details - SiteMatcher',
  description: 'View and edit your property listing details',
};