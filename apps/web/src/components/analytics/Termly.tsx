'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export function Termly() {
  const termlyId = process.env.NEXT_PUBLIC_TERMLY_ID;

  useEffect(() => {
    console.log('[Termly Debug] Environment:', process.env.NODE_ENV);
    console.log('[Termly Debug] ID present:', !!termlyId);
    console.log('[Termly Debug] ID value:', termlyId || 'MISSING');

    // Check if script was added to DOM
    setTimeout(() => {
      const script = document.getElementById('termly-consent');
      console.log('[Termly Debug] Script in DOM:', !!script);
      if (script) {
        console.log('[Termly Debug] Script src:', script.getAttribute('src'));
      }
    }, 1000);
  }, [termlyId]);

  if (!termlyId) {
    console.error('[Termly] NEXT_PUBLIC_TERMLY_ID is not set!');
    console.error('[Termly] This should be set in Vercel environment variables');
    return null;
  }

  console.log('[Termly] Rendering Script component with ID:', termlyId);

  return (
    <Script
      id="termly-consent"
      src={`https://app.termly.io/resource-blocker/${termlyId}`}
      strategy="beforeInteractive"
      onLoad={() => console.log('[Termly] Script onLoad triggered')}
      onError={(e) => console.error('[Termly] Script onError:', e)}
    />
  );
}
