// =====================================================
// Owner Listing Preview - Uses the ImmersiveListingModal
// Allows listing owners to preview their listings with all files
// regardless of approval status
// =====================================================

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { OwnerListingPreview } from '@/components/listings/OwnerListingPreview';

export const dynamic = 'force-dynamic';

interface OwnerPreviewRouteProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function OwnerPreviewRoute({ params }: OwnerPreviewRouteProps) {
  const { id } = await params

  // Check authentication
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/?login=1&redirect=/occupier/listing/${id}/preview`);
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  return <OwnerListingPreview listingId={id} userId={user.id} />;
}

export const metadata = {
  title: 'Preview Listing - SiteMatcher',
  description: 'Preview your listing as it would appear to potential matches',
};