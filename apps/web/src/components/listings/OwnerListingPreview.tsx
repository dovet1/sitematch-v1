'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImmersiveListingModal } from './ImmersiveListingModal';

interface OwnerListingPreviewProps {
  listingId: string;
  userId: string;
}

export function OwnerListingPreview({ listingId, userId }: OwnerListingPreviewProps) {
  const router = useRouter();

  // Auto-open the modal when component mounts
  useEffect(() => {
    // Small delay to ensure smooth transition
    const timer = setTimeout(() => {
      // The modal will fetch from the authenticated API endpoint
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    // Check if user came from dashboard by looking at the referrer
    const referrer = document.referrer;
    const isDashboard = referrer.includes('/occupier/dashboard');
    
    if (isDashboard) {
      // Return to dashboard if they came from there
      router.push('/occupier/dashboard');
    } else {
      // Otherwise return to listing detail page (default behavior)
      router.push(`/occupier/listing/${listingId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background with subtle pattern */}
      <div className="fixed inset-0 bg-gradient-to-br from-violet-50 to-purple-50" />
      
      {/* The ImmersiveListingModal will handle the rest */}
      <ImmersiveListingModal
        listingId={listingId}
        isOpen={true}
        onClose={handleClose}
        // Use the owner API endpoint instead of public
        apiEndpoint={`/api/occupier/listings/${listingId}/detailed`}
      />
    </div>
  );
}