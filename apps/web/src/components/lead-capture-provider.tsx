'use client';

import { useEffect, useState } from 'react';
import { LeadCaptureModal } from './lead-capture-modal';
import { shouldShowLeadModal } from '@/lib/lead-capture';

export function LeadCaptureProvider() {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Check if modal should be shown on first page load
    const shouldShow = shouldShowLeadModal();
    if (shouldShow) {
      // Small delay to ensure page is fully loaded
      const timer = setTimeout(() => {
        setShowModal(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [mounted]);

  const handleClose = () => {
    setShowModal(false);
  };

  // Don't render anything during SSR to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <LeadCaptureModal
      isOpen={showModal}
      onClose={handleClose}
    />
  );
}