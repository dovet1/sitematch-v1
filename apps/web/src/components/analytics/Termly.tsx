'use client';

import { useEffect } from 'react';

export function Termly() {
  const termlyId = process.env.NEXT_PUBLIC_TERMLY_ID;

  useEffect(() => {
    if (!termlyId) {
      console.error('[Termly] NEXT_PUBLIC_TERMLY_ID is not set!');
      return;
    }

    console.log('[Termly] Loading script with ID:', termlyId);

    // Check if already loaded
    if (document.getElementById('termly-consent')) {
      console.log('[Termly] Script already exists');
      return;
    }

    // Create and inject script
    const script = document.createElement('script');
    script.id = 'termly-consent';
    script.src = `https://app.termly.io/resource-blocker/${termlyId}`;
    script.async = true;

    script.onload = () => {
      console.log('[Termly] Script loaded successfully');
    };

    script.onerror = (error) => {
      console.error('[Termly] Script failed to load:', error);
    };

    // Insert at the very beginning of head
    const firstScript = document.head.querySelector('script');
    if (firstScript) {
      document.head.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    console.log('[Termly] Script injected into DOM');
  }, [termlyId]);

  return null;
}
