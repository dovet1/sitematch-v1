'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BrochureWizard } from '@/components/brochures';

function NewBrochureContent() {
  const searchParams = useSearchParams();
  const listingId = searchParams?.get('listingId') || undefined;

  return <BrochureWizard listingId={listingId} />;
}

export default function NewBrochurePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create Brochure</h1>
        <p className="text-gray-500 mt-1">
          Generate a professional PDF brochure for your requirement
        </p>
      </div>

      {/* Wizard */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        }
      >
        <NewBrochureContent />
      </Suspense>
    </div>
  );
}
