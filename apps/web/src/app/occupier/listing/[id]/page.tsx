// =====================================================
// Listing Detail Page Route - Epic 1, Story 1.2
// New route for viewing and editing listing details
// =====================================================

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { ListingDetailPage } from '@/components/listings/listing-detail-page';

export const dynamic = 'force-dynamic';

interface ListingDetailRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ListingDetailRoute({ params }: ListingDetailRouteProps) {
  const { id } = await params

  // Check authentication and authorization
  const user = await getCurrentUser();

  if (!user) {
    redirect('/?login=1&redirect=/occupier/listing/' + id);
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  return (
    <ListingDetailPage
      listingId={id}
      userId={user.id}
      showHeaderBar={false}
    />
  );
}

export const metadata = {
  title: 'Listing Details - SiteMatcher',
  description: 'View and edit your property listing details',
};