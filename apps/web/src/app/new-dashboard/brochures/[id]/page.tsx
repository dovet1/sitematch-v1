'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Download, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrochureDocument } from '@/components/brochures';
import type { BrochureRow } from '@/types/brochure';

export default function BrochureViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [brochure, setBrochure] = useState<BrochureRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBrochure();
  }, [id]);

  const fetchBrochure = async () => {
    try {
      const response = await fetch(`/api/brochures/${id}`);
      if (!response.ok) {
        throw new Error('Brochure not found');
      }
      const data = await response.json();
      setBrochure(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brochure');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/brochures/${id}/export`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      const { printUrl } = await response.json();
      window.open(printUrl, '_blank');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error || !brochure) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Brochure not found'}</p>
        <Link href="/new-dashboard/brochures">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Brochures
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/new-dashboard/brochures">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{brochure.company_name}</h1>
            <p className="text-gray-500 text-sm">
              Last updated {new Date(brochure.updated_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/new-dashboard/brochures/${id}/edit`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            className="bg-violet-600 hover:bg-violet-700"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-100 rounded-lg p-8 overflow-x-auto">
        <div className="shadow-2xl mx-auto" style={{ width: 'fit-content' }}>
          <BrochureDocument brochure={brochure} />
        </div>
      </div>

      {/* Print link */}
      <div className="text-center">
        <Link
          href={`/brochures/print/${id}`}
          target="_blank"
          className="inline-flex items-center text-sm text-gray-500 hover:text-violet-600"
        >
          <ExternalLink className="h-4 w-4 mr-1" />
          Open print-optimized version
        </Link>
      </div>
    </div>
  );
}
