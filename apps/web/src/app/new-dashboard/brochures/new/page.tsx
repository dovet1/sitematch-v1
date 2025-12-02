'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrochureEditor } from '@/components/brochures/BrochureEditor';

export default function NewBrochurePage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/new-dashboard/brochures">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Brochure</h1>
          <p className="text-gray-500 text-sm">
            Edit the form to customise your PDF brochure
          </p>
        </div>
      </div>

      {/* Editor */}
      <BrochureEditor />
    </div>
  );
}
