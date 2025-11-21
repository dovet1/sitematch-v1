'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrochureEditor } from '@/components/brochures/BrochureEditor';
import type { BrochureFormData, BrochureRow } from '@/types/brochure';

// Convert database row to form data
function rowToFormData(row: BrochureRow): Partial<BrochureFormData> {
  return {
    companyName: row.company_name,
    companyLogoUrl: row.company_logo_url || '',
    companyLogoSource: row.company_logo_source || 'none',
    companyAbout: row.company_about || '',
    brandColor: row.brand_color || '#7c3aed',
    sector: row.sector || '',
    sectorLabel: row.sector_label || '',
    useClass: row.use_class || '',
    useClassLabel: row.use_class_label || '',
    sqftMin: row.sqft_min || undefined,
    sqftMax: row.sqft_max || undefined,
    targetLocations: row.target_locations || [],
    requirementsSummary: row.requirements_summary,
    additionalNotes: row.additional_notes || '',
    storeImages: row.store_images || [],
    agentName: row.agent_name,
    agentCompany: row.agent_company,
    agentEmail: row.agent_email,
    agentPhone: row.agent_phone || '',
    agentLogoUrl: row.agent_logo_url || '',
    agentLogoSource: row.agent_logo_source || 'none',
  };
}

export default function EditBrochurePage() {
  const params = useParams();
  const id = params?.id as string;
  const [initialData, setInitialData] = useState<Partial<BrochureFormData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrochure = async () => {
      try {
        const response = await fetch(`/api/brochures/${id}`);
        if (!response.ok) throw new Error('Brochure not found');
        const data = await response.json();
        setInitialData(rowToFormData(data));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchBrochure();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error || 'Brochure not found'}</p>
        <Link href="/new-dashboard/brochures">
          <Button variant="outline">Back to Brochures</Button>
        </Link>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Edit Brochure</h1>
          <p className="text-gray-500 text-sm">
            Update your brochure details
          </p>
        </div>
      </div>

      {/* Editor */}
      <BrochureEditor initialData={initialData} brochureId={id} />
    </div>
  );
}
