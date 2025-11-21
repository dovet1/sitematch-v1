'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { BrochureFormData } from '@/types/brochure';

interface RequirementsStepProps {
  formData: BrochureFormData;
  onFormDataChange: (data: Partial<BrochureFormData>) => void;
}

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

export function RequirementsStep({ formData, onFormDataChange }: RequirementsStepProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [useClasses, setUseClasses] = useState<UseClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReferenceData();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Property Requirements</h2>
        <p className="text-sm text-gray-500 mt-1">
          Specify the occupier's property requirements
        </p>
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <Label htmlFor="requirementsSummary">Requirements Summary *</Label>
        <Textarea
          id="requirementsSummary"
          value={formData.requirementsSummary}
          onChange={(e) => onFormDataChange({ requirementsSummary: e.target.value })}
          placeholder="Brief description of what the occupier is looking for..."
          rows={3}
        />
        <p className="text-xs text-gray-500">
          A short summary that will appear prominently on the brochure
        </p>
      </div>

      {/* Size Requirements */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
          Size Requirements
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sqftMin">Minimum Size (sq ft)</Label>
            <Input
              id="sqftMin"
              type="number"
              value={formData.sqftMin || ''}
              onChange={(e) => onFormDataChange({ sqftMin: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="e.g., 5000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sqftMax">Maximum Size (sq ft)</Label>
            <Input
              id="sqftMax"
              type="number"
              value={formData.sqftMax || ''}
              onChange={(e) => onFormDataChange({ sqftMax: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="e.g., 20000"
            />
          </div>
        </div>
      </div>

      {/* Classification */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
          Property Classification
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="useClass">Use Class</Label>
            {loading ? (
              <div className="flex items-center gap-2 h-10 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <Select
                value={formData.useClass || ''}
                onValueChange={(value) => onFormDataChange({ useClass: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select use class" />
                </SelectTrigger>
                <SelectContent>
                  {useClasses.map((uc) => (
                    <SelectItem key={uc.id} value={uc.code}>
                      {uc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sector">Sector</Label>
            {loading ? (
              <div className="flex items-center gap-2 h-10 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <Select
                value={formData.sector || ''}
                onValueChange={(value) => onFormDataChange({ sector: value || undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sector" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div className="space-y-2">
        <Label htmlFor="additionalNotes">Additional Notes</Label>
        <Textarea
          id="additionalNotes"
          value={formData.additionalNotes || ''}
          onChange={(e) => onFormDataChange({ additionalNotes: e.target.value || undefined })}
          placeholder="Any additional requirements or preferences..."
          rows={3}
        />
      </div>
    </div>
  );
}
