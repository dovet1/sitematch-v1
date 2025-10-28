'use client';

import Script from 'next/script';

export function Termly() {
  const termlyId = process.env.NEXT_PUBLIC_TERMLY_ID;

  if (!termlyId) {
    console.error('[Termly] NEXT_PUBLIC_TERMLY_ID is not set!');
    return null;
  }

  return (
    <Script
      id="termly-consent"
      src="https://app.termly.io/resource-blocker/60d58f52-d8db-4e80-9121-20465e437e1c"
      strategy="beforeInteractive"
    />
  );
}
