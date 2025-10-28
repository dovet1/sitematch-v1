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

    // Function to check if user has made cookie consent decision
    const hasConsented = () => {
      // Check if Termly consent cookie exists
      const cookies = document.cookie.split(';');
      return cookies.some(cookie => cookie.trim().startsWith('termly_consent='));
    };

    // Function to attempt showing modal
    const tryShowModal = () => {
      // If user hasn't consented yet, wait for them to interact with cookie banner
      if (!hasConsented()) {
        // Check again in 2 seconds
        setTimeout(tryShowModal, 2000);
        return;
      }

      // User has made a consent decision, now check if modal should be shown
      const shouldShow = shouldShowLeadModal();
      if (shouldShow) {
        setShowModal(true);
      }
    };

    // Start checking after initial delay
    const timer = setTimeout(tryShowModal, 1000);
    return () => clearTimeout(timer);
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