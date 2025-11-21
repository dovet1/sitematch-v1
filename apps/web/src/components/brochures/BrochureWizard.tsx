'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Download, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BROCHURE_STEPS, type BrochureFormData, type BrochureRow } from '@/types/brochure';
import {
  DataSourceStep,
  CompanyDetailsStep,
  RequirementsStep,
  LocationsMediaStep,
  PreviewStep,
} from './steps';

interface BrochureWizardProps {
  brochureId?: string; // If editing existing brochure
  listingId?: string; // If pre-selecting a listing
}

const DEFAULT_FORM_DATA: BrochureFormData = {
  sourceType: 'scratch',
  companyName: '',
  companyDomain: '',
  companyLogoSource: 'logo_dev',
  companyLogoUrl: '',
  agentName: '',
  agentCompany: '',
  agentEmail: '',
  agentPhone: '',
  agentDomain: '',
  agentLogoSource: 'logo_dev',
  agentLogoUrl: '',
  requirementsSummary: '',
  targetLocations: [],
  storeImages: [],
  brandColor: '#7c3aed',
};

export function BrochureWizard({ brochureId, listingId }: BrochureWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<BrochureFormData>(DEFAULT_FORM_DATA);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingListing, setLoadingListing] = useState(false);

  // Load existing brochure if editing
  useEffect(() => {
    if (brochureId) {
      loadBrochure(brochureId);
    } else if (listingId) {
      setFormData((prev) => ({ ...prev, sourceType: 'listing', listingId }));
    }
  }, [brochureId, listingId]);

  // Load listing data when listingId changes
  useEffect(() => {
    if (formData.sourceType === 'listing' && formData.listingId) {
      loadListingData(formData.listingId);
    }
  }, [formData.listingId, formData.sourceType]);

  const loadBrochure = async (id: string) => {
    try {
      const response = await fetch(`/api/brochures/${id}`);
      if (response.ok) {
        const data: BrochureRow = await response.json();
        setFormData({
          sourceType: data.listing_id ? 'listing' : 'scratch',
          listingId: data.listing_id || undefined,
          companyName: data.company_name,
          companyDomain: data.company_domain || '',
          companyLogoSource: data.company_logo_source,
          companyLogoUrl: data.company_logo_url || '',
          agentName: data.agent_name,
          agentCompany: data.agent_company,
          agentEmail: data.agent_email,
          agentPhone: data.agent_phone || '',
          agentDomain: data.agent_domain || '',
          agentLogoSource: data.agent_logo_source,
          agentLogoUrl: data.agent_logo_url || '',
          requirementsSummary: data.requirements_summary,
          sqftMin: data.sqft_min || undefined,
          sqftMax: data.sqft_max || undefined,
          useClass: data.use_class || undefined,
          sector: data.sector || undefined,
          additionalNotes: data.additional_notes || undefined,
          targetLocations: data.target_locations || [],
          storeImages: data.store_images || [],
          brandColor: data.brand_color || '#7c3aed',
        });
      }
    } catch (err) {
      console.error('Failed to load brochure:', err);
      setError('Failed to load brochure');
    }
  };

  const loadListingData = async (listingId: string) => {
    setLoadingListing(true);
    try {
      const response = await fetch(`/api/listings/${listingId}`);
      if (response.ok) {
        const listing = await response.json();
        // Pre-fill form with listing data
        setFormData((prev) => ({
          ...prev,
          companyName: listing.company_name || prev.companyName,
          companyDomain: listing.company_domain || prev.companyDomain,
          requirementsSummary: listing.requirement_summary || prev.requirementsSummary,
          sqftMin: listing.sqft_min || prev.sqftMin,
          sqftMax: listing.sqft_max || prev.sqftMax,
          useClass: listing.use_class || prev.useClass,
          sector: listing.sector || prev.sector,
          targetLocations: listing.target_locations || prev.targetLocations,
        }));
      }
    } catch (err) {
      console.error('Failed to load listing:', err);
    } finally {
      setLoadingListing(false);
    }
  };

  const handleFormDataChange = (data: Partial<BrochureFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Data Source
        if (formData.sourceType === 'listing' && !formData.listingId) {
          setError('Please select a listing');
          return false;
        }
        return true;
      case 1: // Company & Agent
        if (!formData.companyName.trim()) {
          setError('Company name is required');
          return false;
        }
        if (!formData.agentName.trim() || !formData.agentCompany.trim() || !formData.agentEmail.trim()) {
          setError('Agent name, company, and email are required');
          return false;
        }
        return true;
      case 2: // Requirements
        if (!formData.requirementsSummary.trim()) {
          setError('Requirements summary is required');
          return false;
        }
        return true;
      case 3: // Locations & Media
        return true; // Optional step
      case 4: // Preview
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    setError(null);
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, BROCHURE_STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        listing_id: formData.listingId || null,
        company_name: formData.companyName,
        company_domain: formData.companyDomain || null,
        company_logo_source: formData.companyLogoSource,
        company_logo_url: formData.companyLogoUrl || null,
        agent_name: formData.agentName,
        agent_company: formData.agentCompany,
        agent_email: formData.agentEmail,
        agent_phone: formData.agentPhone || null,
        agent_domain: formData.agentDomain || null,
        agent_logo_source: formData.agentLogoSource,
        agent_logo_url: formData.agentLogoUrl || null,
        requirements_summary: formData.requirementsSummary,
        sqft_min: formData.sqftMin || null,
        sqft_max: formData.sqftMax || null,
        use_class: formData.useClass || null,
        sector: formData.sector || null,
        additional_notes: formData.additionalNotes || null,
        target_locations: formData.targetLocations,
        store_images: formData.storeImages,
        brand_color: formData.brandColor,
      };

      const url = brochureId ? `/api/brochures/${brochureId}` : '/api/brochures';
      const method = brochureId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save brochure');
      }

      const savedBrochure = await response.json();
      router.push(`/new-dashboard/brochures/${savedBrochure.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save brochure');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      // First save, then export
      if (!brochureId) {
        setError('Please save the brochure first');
        return;
      }

      const response = await fetch(`/api/brochures/${brochureId}/export`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const { printUrl } = await response.json();
      // Open print page in new tab
      window.open(printUrl, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const renderStep = () => {
    if (loadingListing) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          <span className="ml-2 text-gray-600">Loading listing data...</span>
        </div>
      );
    }

    switch (currentStep) {
      case 0:
        return <DataSourceStep formData={formData} onFormDataChange={handleFormDataChange} />;
      case 1:
        return <CompanyDetailsStep formData={formData} onFormDataChange={handleFormDataChange} />;
      case 2:
        return <RequirementsStep formData={formData} onFormDataChange={handleFormDataChange} />;
      case 3:
        return <LocationsMediaStep formData={formData} onFormDataChange={handleFormDataChange} />;
      case 4:
        return <PreviewStep formData={formData} onFormDataChange={handleFormDataChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {BROCHURE_STEPS.map((step, index) => (
            <div key={step.step} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (index < currentStep) {
                    setCurrentStep(index);
                  }
                }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  index < currentStep
                    ? 'bg-violet-600 text-white cursor-pointer hover:bg-violet-700'
                    : index === currentStep
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-default'
                )}
              >
                {index + 1}
              </button>
              {index < BROCHURE_STEPS.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-12 md:w-24 mx-2',
                    index < currentStep ? 'bg-violet-600' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-center">
          <p className="text-sm font-medium text-gray-900">{BROCHURE_STEPS[currentStep].title}</p>
          <p className="text-xs text-gray-500">{BROCHURE_STEPS[currentStep].description}</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {renderStep()}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex gap-2">
          {currentStep === BROCHURE_STEPS.length - 1 ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
              {brochureId && (
                <Button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Download className="h-4 w-4 mr-1" />
                  )}
                  Export PDF
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
