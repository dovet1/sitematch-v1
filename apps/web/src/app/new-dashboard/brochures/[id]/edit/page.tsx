'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrochureWizard } from '@/components/brochures';

export default function EditBrochurePage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/new-dashboard/brochures/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Brochure</h1>
          <p className="text-gray-500 mt-1">
            Update your brochure details
          </p>
        </div>
      </div>

      {/* Wizard */}
      <BrochureWizard brochureId={id} />
    </div>
  );
}
