// =====================================================
// Owner Listing Preview - Uses the ImmersiveListingModal
// Allows listing owners to preview their listings with all files
// regardless of approval status
// =====================================================

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { OwnerListingPreview } from '@/components/listings/OwnerListingPreview';

interface OwnerPreviewRouteProps {
  params: {
    id: string;
  };
}

export default async function OwnerPreviewRoute({ params }: OwnerPreviewRouteProps) {
  // Check authentication
  const user = await getCurrentUser();
  
  if (!user) {
    redirect(`/?login=1&redirect=/occupier/listing/${params.id}/preview`);
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  return <OwnerListingPreview listingId={params.id} userId={user.id} />;
}

export const metadata = {
  title: 'Preview Listing - SiteMatch',
  description: 'Preview your listing as it would appear to potential matches',
};