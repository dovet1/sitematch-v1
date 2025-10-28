'use client';

import Script from 'next/script';

export function Termly() {
  const termlyId = process.env.NEXT_PUBLIC_TERMLY_ID;

  if (!termlyId) {
    return null;
  }

  return (
    <>
      {/* Termly Cookie Consent Banner */}
      <Script
        id="termly-consent"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(d, s, id) {
              var js, tjs = d.getElementsByTagName(s)[0];
              if (d.getElementById(id)) return;
              js = d.createElement(s); js.id = id;
              js.src = "https://app.termly.io/embed.min.js";
              js.dataset.autoBlock = "on";
              js.dataset.websiteUuid = "${termlyId}";
              tjs.parentNode.insertBefore(js, tjs);
            })(document, 'script', 'termly-js');
          `
        }}
      />
    </>
  );
}
