'use client';

import { useEffect } from 'react';

export function Termly() {
  const termlyId = process.env.NEXT_PUBLIC_TERMLY_ID;

  useEffect(() => {
    console.log('[Termly] Component mounted');
    console.log('[Termly] ID:', termlyId ? 'Found' : 'NOT FOUND');

    if (!termlyId) {
      console.error('[Termly] NEXT_PUBLIC_TERMLY_ID is not set!');
      return;
    }

    // Check if script already loaded
    if (document.getElementById('termly-js')) {
      console.log('[Termly] Script already loaded');
      return;
    }

    console.log('[Termly] Loading script...');

    // Load Termly script
    const script = document.createElement('script');
    script.id = 'termly-js';
    script.src = 'https://app.termly.io/embed.min.js';
    script.setAttribute('data-auto-block', 'on');
    script.setAttribute('data-website-uuid', termlyId);
    script.async = true;

    script.onload = () => {
      console.log('[Termly] Script loaded successfully');
    };

    script.onerror = (error) => {
      console.error('[Termly] Script failed to load:', error);
    };

    document.head.appendChild(script);
    console.log('[Termly] Script added to DOM');
  }, [termlyId]);

  return null;
}
