'use client';

import type { BrochureRow } from '@/types/brochure';
import { BrochureDocumentCleanModern } from './BrochureDocumentCleanModern';
import { BrochureDocumentGailsStyle } from './BrochureDocumentGailsStyle';

interface BrochureDocumentProps {
  brochure: BrochureRow;
}

/**
 * BrochureDocument wrapper that routes to the appropriate template
 * based on the brochure.template field.
 */
export function BrochureDocument({ brochure }: BrochureDocumentProps) {
  const template = brochure.template || 'clean-modern';

  switch (template) {
    case 'gails-style':
      return <BrochureDocumentGailsStyle brochure={brochure} />;
    case 'clean-modern':
    default:
      return <BrochureDocumentCleanModern brochure={brochure} />;
  }
}
