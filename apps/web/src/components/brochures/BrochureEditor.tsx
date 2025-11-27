'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Download, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrochureDocument } from './BrochureDocument';
import { LogoSelector } from './LogoSelector';
import { LocationSearch } from '@/components/listings/location-search';
import { cn } from '@/lib/utils';
import type { BrochureFormData } from '@/types/brochure';
import type { LocationSelection } from '@/types/locations';

// Mock data for new brochures
const DEFAULT_BROCHURE: BrochureFormData = {
  sourceType: 'scratch',
  companyName: 'ABC Ltd',
  companyDomain: '',
  companyLogoUrl: '',
  companyLogoSource: 'none',
  companyAbout: '',
  brandColor: '#7c3aed',
  sector: 'retail',
  useClass: 'E',
  sqftMin: 2000,
  sqftMax: 5000,
  targetLocations: [],
  requirementsSummary: 'We are actively seeking new sites across the region for our expanding retail operations.',
  additionalNotes: '',
  storeImages: [],
  agentName: 'Your Name',
  agentCompany: 'Your Company',
  agentEmail: 'email@example.com',
  agentPhone: '',
  agentDomain: '',
  agentLogoUrl: '',
  agentLogoSource: 'none',
};

interface Sector {
  id: string;
  value: string;
  label: string;
}

interface UseClass {
  id: string;
  value: string;
  code: string;
  label: string;
}

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          {title}
        </h3>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-500 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div className="p-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

interface BrochureEditorProps {
  initialData?: Partial<BrochureFormData>;
  brochureId?: string;
}

export function BrochureEditor({ initialData, brochureId }: BrochureEditorProps) {
  const router = useRouter();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [useClasses, setUseClasses] = useState<UseClass[]>([]);
  const [formData, setFormData] = useState<BrochureFormData>({
    ...DEFAULT_BROCHURE,
    ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Fetch sectors and use classes from database
  useEffect(() => {
    const fetchReferenceData = async () => {
      try {
        const response = await fetch('/api/public/reference-data');
        if (response.ok) {
          const data = await response.json();
          setSectors(data.sectors || []);
          setUseClasses(data.useClasses || []);
        }
      } catch (error) {
        console.error('Failed to fetch reference data:', error);
      }
    };
    fetchReferenceData();
  }, []);

  const updateField = useCallback(<K extends keyof BrochureFormData>(
    field: K,
    value: BrochureFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Convert form data to the format expected by BrochureDocument
  const previewData = {
    id: brochureId || 'preview',
    user_id: '',
    listing_id: null,
    company_name: formData.companyName,
    company_domain: formData.companyDomain || null,
    company_logo_url: formData.companyLogoUrl || null,
    company_logo_source: formData.companyLogoSource,
    company_about: formData.companyAbout || null,
    brand_color: formData.brandColor,
    template: formData.template,
    sector: formData.sector || null,
    sector_label: formData.sectorLabel || null,
    use_class: formData.useClass || null,
    use_class_label: formData.useClassLabel || null,
    sqft_min: formData.sqftMin || null,
    sqft_max: formData.sqftMax || null,
    target_locations: formData.targetLocations,
    requirements_summary: formData.requirementsSummary,
    additional_notes: formData.additionalNotes || null,
    store_images: formData.storeImages,
    agent_name: formData.agentName,
    agent_company: formData.agentCompany,
    agent_email: formData.agentEmail,
    agent_phone: formData.agentPhone || null,
    agent_domain: formData.agentDomain || null,
    agent_logo_url: formData.agentLogoUrl || null,
    agent_logo_source: formData.agentLogoSource,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = brochureId ? `/api/brochures/${brochureId}` : '/api/brochures';
      const method = brochureId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save');

      const data = await response.json();
      if (!brochureId) {
        router.push(`/new-dashboard/brochures/${data.id}`);
      }
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!brochureId) {
      // Save first, then export
      await handleSave();
      return;
    }

    setExporting(true);
    try {
      window.open(`/brochures/print/${brochureId}`, '_blank');
    } finally {
      setExporting(false);
    }
  };

  const handleLocationsChange = (locations: LocationSelection[]) => {
    updateField('targetLocations', locations);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Left: Form Panel */}
      <div className="w-[400px] flex-shrink-0 overflow-y-auto border-r border-gray-200 pr-6">
        <div className="space-y-4 pb-6">
          {/* Styling Section */}
          <CollapsibleSection title="Styling" defaultOpen={true}>
            <div>
              <Label htmlFor="template">Template</Label>
              <select
                id="template"
                value={formData.template}
                onChange={(e) => updateField('template', e.target.value as 'clean-modern' | 'gails-style')}
                className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
              >
                <option value="clean-modern">Clean Modern</option>
                <option value="gails-style">Gail's Style</option>
              </select>
            </div>

            <div>
              <Label htmlFor="brandColor">Brand Colour</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  id="brandColor"
                  value={formData.brandColor}
                  onChange={(e) => updateField('brandColor', e.target.value)}
                  className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                />
                <Input
                  value={formData.brandColor}
                  onChange={(e) => updateField('brandColor', e.target.value)}
                  placeholder="#7c3aed"
                  className="flex-1"
                />
              </div>
            </div>

            {/* TODO: Typography selector */}
            <div>
              <Label>Typography</Label>
              <div className="h-10 px-3 rounded-md border border-dashed border-gray-300 bg-gray-50 flex items-center text-sm text-gray-400">
                Coming soon...
              </div>
            </div>
          </CollapsibleSection>

          {/* Company Details Section */}
          <CollapsibleSection title="Company Details" defaultOpen={true}>
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                placeholder="Enter company name"
              />
            </div>

            <LogoSelector
              label="Company Logo"
              logoUrl={formData.companyLogoUrl || ''}
              logoSource={formData.companyLogoSource}
              companyDomain={formData.companyDomain || ''}
              onLogoUrlChange={(url) => updateField('companyLogoUrl', url)}
              onLogoSourceChange={(source) => updateField('companyLogoSource', source)}
              onCompanyDomainChange={(domain: string) => updateField('companyDomain', domain)}
            />

            <div>
              <Label htmlFor="companyAbout">About</Label>
              <Textarea
                id="companyAbout"
                value={formData.companyAbout || ''}
                onChange={(e) => updateField('companyAbout', e.target.value)}
                placeholder="Describe who the company is and what they do..."
                rows={3}
              />
            </div>
          </CollapsibleSection>

          {/* Requirements Section */}
          <CollapsibleSection title="Requirements" defaultOpen={true}>
            <div>
              <Label htmlFor="requirementsSummary">Summary</Label>
              <Textarea
                id="requirementsSummary"
                value={formData.requirementsSummary}
                onChange={(e) => updateField('requirementsSummary', e.target.value)}
                placeholder="Describe what you're looking for..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sqftMin">Min Size (sq ft)</Label>
                <Input
                  id="sqftMin"
                  type="number"
                  value={formData.sqftMin || ''}
                  onChange={(e) => updateField('sqftMin', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="2,000"
                />
              </div>
              <div>
                <Label htmlFor="sqftMax">Max Size (sq ft)</Label>
                <Input
                  id="sqftMax"
                  type="number"
                  value={formData.sqftMax || ''}
                  onChange={(e) => updateField('sqftMax', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="5,000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sector">Sector</Label>
                <select
                  id="sector"
                  value={formData.sector || ''}
                  onChange={(e) => {
                    const selected = sectors.find(s => s.value === e.target.value);
                    updateField('sector', e.target.value);
                    updateField('sectorLabel', selected?.label || '');
                  }}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                >
                  <option value="">Select sector</option>
                  {sectors.map((sector) => (
                    <option key={sector.id} value={sector.value}>
                      {sector.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="useClass">Use Class</Label>
                <select
                  id="useClass"
                  value={formData.useClass || ''}
                  onChange={(e) => {
                    const selected = useClasses.find(uc => uc.code === e.target.value);
                    updateField('useClass', e.target.value);
                    updateField('useClassLabel', selected?.label || '');
                  }}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 text-sm"
                >
                  <option value="">Select use class</option>
                  {useClasses.map((uc) => (
                    <option key={uc.id} value={uc.code}>
                      {uc.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CollapsibleSection>

          {/* Target Locations Section */}
          <CollapsibleSection title="Target Locations" defaultOpen={true}>
            {/* TODO: Target Summary field */}
            <div>
              <Label>Target Summary</Label>
              <Textarea
                disabled
                placeholder="Coming soon - describe what locations you're looking for..."
                rows={2}
                className="bg-gray-50 border-dashed"
              />
            </div>

            <div>
              <Label>Selected Locations</Label>
              <LocationSearch
                value={formData.targetLocations}
                onChange={handleLocationsChange}
                maxLocations={10}
                placeholder="Search for locations..."
              />
            </div>
          </CollapsibleSection>

          {/* Contacts Section */}
          <CollapsibleSection title="Contacts" defaultOpen={true}>
            <div>
              <Label htmlFor="agentName">Name</Label>
              <Input
                id="agentName"
                value={formData.agentName}
                onChange={(e) => updateField('agentName', e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div>
              <Label htmlFor="agentCompany">Company</Label>
              <Input
                id="agentCompany"
                value={formData.agentCompany}
                onChange={(e) => updateField('agentCompany', e.target.value)}
                placeholder="Your company"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="agentEmail">Email</Label>
                <Input
                  id="agentEmail"
                  type="email"
                  value={formData.agentEmail}
                  onChange={(e) => updateField('agentEmail', e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label htmlFor="agentPhone">Phone</Label>
                <Input
                  id="agentPhone"
                  value={formData.agentPhone || ''}
                  onChange={(e) => updateField('agentPhone', e.target.value)}
                  placeholder="+44 123 456 7890"
                />
              </div>
            </div>

            <LogoSelector
              label="Logo"
              logoUrl={formData.agentLogoUrl || ''}
              logoSource={formData.agentLogoSource}
              companyDomain={formData.agentDomain || ''}
              onLogoUrlChange={(url) => updateField('agentLogoUrl', url)}
              onLogoSourceChange={(source) => updateField('agentLogoSource', source)}
              onCompanyDomainChange={(domain: string) => updateField('agentDomain', domain)}
            />
          </CollapsibleSection>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-violet-600 hover:bg-violet-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting || !brochureId}
              variant="outline"
              className="flex-1"
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
      </div>

      {/* Right: Live Preview */}
      <div className="flex-1 overflow-auto bg-gray-100 rounded-lg p-6">
        <div className="flex justify-center">
          <div className="shadow-2xl" style={{ transform: 'scale(0.7)', transformOrigin: 'top center' }}>
            <BrochureDocument brochure={previewData} />
          </div>
        </div>
      </div>
    </div>
  );
}
