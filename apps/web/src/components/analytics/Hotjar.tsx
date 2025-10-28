'use client';

import Script from 'next/script';

export function Hotjar() {
  const scriptSrc = process.env.NEXT_PUBLIC_HOTJAR_SCRIPT_SRC;

  if (!scriptSrc) {
    return null;
  }

  return (
    <Script
      src={scriptSrc}
      strategy="afterInteractive"
      data-category="analytics"
      type="text/plain"
    />
  );
}
