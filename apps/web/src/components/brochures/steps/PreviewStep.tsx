'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { BrochureFormData } from '@/types/brochure';

interface PreviewStepProps {
  formData: BrochureFormData;
  onFormDataChange: (data: Partial<BrochureFormData>) => void;
}

const PRESET_COLORS = [
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#059669' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Slate', value: '#475569' },
  { name: 'Black', value: '#18181b' },
];

export function PreviewStep({ formData, onFormDataChange }: PreviewStepProps) {
  const brandColor = formData.brandColor || '#7c3aed';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Preview & Branding</h2>
        <p className="text-sm text-gray-500 mt-1">
          Customize the brochure appearance and preview your content
        </p>
      </div>

      {/* Brand Color Selection */}
      <div className="space-y-3">
        <Label>Brand Color</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => onFormDataChange({ brandColor: color.value })}
              className={cn(
                'w-10 h-10 rounded-lg border-2 transition-all',
                brandColor === color.value
                  ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400'
                  : 'border-transparent hover:border-gray-300'
              )}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}

          {/* Custom color picker */}
          <label
            className={cn(
              'w-10 h-10 rounded-lg border-2 cursor-pointer flex items-center justify-center overflow-hidden',
              !PRESET_COLORS.some(c => c.value === brandColor)
                ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400'
                : 'border-gray-200 hover:border-gray-300'
            )}
            title="Custom color"
          >
            <input
              type="color"
              value={brandColor}
              onChange={(e) => onFormDataChange({ brandColor: e.target.value })}
              className="w-12 h-12 cursor-pointer"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="customColor" className="text-xs text-gray-500">Or enter hex:</Label>
          <Input
            id="customColor"
            value={brandColor}
            onChange={(e) => {
              const value = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                onFormDataChange({ brandColor: value });
              }
            }}
            placeholder="#7c3aed"
            className="w-28 h-8 text-sm"
          />
        </div>
      </div>

      {/* Live Preview */}
      <div className="space-y-3">
        <Label>Brochure Preview</Label>
        <div
          className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm"
          style={{ aspectRatio: '210/297' }} // A4 aspect ratio
        >
          {/* Mini preview of the brochure */}
          <div className="h-full flex flex-col">
            {/* Header */}
            <div
              className="p-4 text-white"
              style={{ backgroundColor: brandColor }}
            >
              <div className="flex items-center justify-between">
                {formData.companyLogoUrl ? (
                  <img
                    src={formData.companyLogoUrl}
                    alt="Company logo"
                    className="h-8 object-contain bg-white/20 rounded px-2 py-1"
                  />
                ) : (
                  <div className="h-8 w-24 bg-white/20 rounded" />
                )}
                <span className="text-xs font-medium">REQUIREMENT</span>
              </div>
              <h3 className="mt-4 text-lg font-bold truncate">
                {formData.companyName || 'Company Name'}
              </h3>
            </div>

            {/* Content preview */}
            <div className="flex-1 p-4 space-y-3 text-xs">
              {/* Summary */}
              <div>
                <div className="font-semibold text-gray-900 mb-1">Requirements</div>
                <p className="text-gray-600 line-clamp-2">
                  {formData.requirementsSummary || 'Requirements summary will appear here...'}
                </p>
              </div>

              {/* Size */}
              {(formData.sqftMin || formData.sqftMax) && (
                <div className="flex gap-4">
                  {formData.sqftMin && (
                    <div>
                      <div className="text-gray-500">Min Size</div>
                      <div className="font-medium">{formData.sqftMin.toLocaleString()} sq ft</div>
                    </div>
                  )}
                  {formData.sqftMax && (
                    <div>
                      <div className="text-gray-500">Max Size</div>
                      <div className="font-medium">{formData.sqftMax.toLocaleString()} sq ft</div>
                    </div>
                  )}
                </div>
              )}

              {/* Locations */}
              {formData.targetLocations && formData.targetLocations.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Target Locations</div>
                  <div className="flex flex-wrap gap-1">
                    {formData.targetLocations.slice(0, 5).map((loc, i) => (
                      <span
                        key={loc.id || i}
                        className="px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: brandColor }}
                      >
                        {loc.formatted_address || loc.place_name}
                      </span>
                    ))}
                    {formData.targetLocations.length > 5 && (
                      <span className="text-gray-500">+{formData.targetLocations.length - 5} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Images preview */}
              {formData.storeImages && formData.storeImages.length > 0 && (
                <div className="grid grid-cols-3 gap-1">
                  {formData.storeImages.slice(0, 3).map((img, i) => (
                    <div key={i} className="aspect-video rounded overflow-hidden">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-gray-900">
                    {formData.agentName || 'Agent Name'}
                  </div>
                  <div className="text-gray-500">
                    {formData.agentCompany || 'Agent Company'}
                  </div>
                </div>
                {formData.agentLogoUrl && (
                  <img
                    src={formData.agentLogoUrl}
                    alt="Agent logo"
                    className="h-6 object-contain"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center">
          This is a simplified preview. The exported PDF will have full formatting.
        </p>
      </div>
    </div>
  );
}
