'use client'

import React, { useState, useEffect } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { RangeSlider } from '@/components/ui/range-slider';
import { Badge } from '@/components/ui/badge';

interface RequirementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingType: 'commercial' | 'residential';
  currentData?: {
    sectors?: string[];
    useClasses?: string[];
    siteSizeMin?: number;
    siteSizeMax?: number;
    dwellingCountMin?: number;
    dwellingCountMax?: number;
    siteAcreageMin?: number;
    siteAcreageMax?: number;
  };
  onSave: (data: any) => void;
  sectorsOptions?: Array<{ value: string; label: string }>;
  useClassesOptions?: Array<{ value: string; label: string }>;
}

export function RequirementsModal({ 
  isOpen, 
  onClose, 
  listingType,
  currentData,
  onSave,
  sectorsOptions = [],
  useClassesOptions = []
}: RequirementsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  // Commercial fields
  const [sectors, setSectors] = useState<string[]>(currentData?.sectors || []);
  const [useClasses, setUseClasses] = useState<string[]>(currentData?.useClasses || []);
  const [siteSize, setSiteSize] = useState<[number, number]>([
    currentData?.siteSizeMin || 0,
    currentData?.siteSizeMax || 50000
  ]);

  // Residential fields
  const [dwellingCount, setDwellingCount] = useState<[number, number]>([
    currentData?.dwellingCountMin || 1,
    currentData?.dwellingCountMax || 500
  ]);
  const [siteAcreage, setSiteAcreage] = useState<[number, number]>([
    currentData?.siteAcreageMin || 0.1,
    currentData?.siteAcreageMax || 50
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const data = listingType === 'commercial' ? {
        sectors,
        useClasses,
        siteSizeMin: siteSize[0],
        siteSizeMax: siteSize[1]
      } : {
        dwellingCountMin: dwellingCount[0],
        dwellingCountMax: dwellingCount[1],
        siteAcreageMin: siteAcreage[0],
        siteAcreageMax: siteAcreage[1]
      };
      
      await onSave(data);
      onClose();
    } catch (error) {
      console.error('Error saving requirements:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatSiteSize = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  const formatAcreage = (value: number) => {
    return value.toFixed(1);
  };

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${listingType === 'commercial' ? 'Commercial' : 'Residential'} Requirements`}
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-3xl"
    >
      <div className="p-6 space-y-8">
        {listingType === 'commercial' ? (
          <>
            {/* Sectors Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Property Sectors</h3>
                <p className="text-sm text-gray-600">Select the sectors that match your property requirements</p>
              </div>
              
              <MultiSelectDropdown
                options={sectorsOptions}
                value={sectors}
                onChange={setSectors}
                placeholder="Select sectors..."
                className="w-full"
              />

              {sectors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sectors.map((sector) => {
                    const option = sectorsOptions.find(opt => opt.value === sector);
                    return (
                      <Badge key={sector} variant="secondary">
                        {option?.label || sector}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Use Classes Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Use Classes</h3>
                <p className="text-sm text-gray-600">Select the use classes suitable for your requirements</p>
              </div>
              
              <MultiSelectDropdown
                options={useClassesOptions}
                value={useClasses}
                onChange={setUseClasses}
                placeholder="Select use classes..."
                className="w-full"
              />

              {useClasses.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {useClasses.map((useClass) => {
                    const option = useClassesOptions.find(opt => opt.value === useClass);
                    return (
                      <Badge key={useClass} variant="outline">
                        {option?.label || useClass}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Site Size Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Site Size Range</h3>
                <p className="text-sm text-gray-600">Specify your preferred property size range</p>
              </div>
              
              <div className="px-4">
                <RangeSlider
                  min={0}
                  max={50000}
                  step={100}
                  value={siteSize}
                  onChange={setSiteSize}
                  formatValue={formatSiteSize}
                />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{formatSiteSize(siteSize[0])} sq ft</span>
                <span>{formatSiteSize(siteSize[1])} sq ft</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Dwelling Count Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Number of Dwellings</h3>
                <p className="text-sm text-gray-600">Specify the range of dwelling units you're looking for</p>
              </div>
              
              <div className="px-4">
                <RangeSlider
                  min={1}
                  max={500}
                  step={1}
                  value={dwellingCount}
                  onChange={setDwellingCount}
                  formatValue={(value) => value.toString()}
                />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{dwellingCount[0]} dwelling{dwellingCount[0] > 1 ? 's' : ''}</span>
                <span>{dwellingCount[1]} dwelling{dwellingCount[1] > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Site Acreage Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Site Acreage</h3>
                <p className="text-sm text-gray-600">Specify your preferred site size in acres</p>
              </div>
              
              <div className="px-4">
                <RangeSlider
                  min={0.1}
                  max={50}
                  step={0.1}
                  value={siteAcreage}
                  onChange={setSiteAcreage}
                  formatValue={formatAcreage}
                />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{formatAcreage(siteAcreage[0])} acres</span>
                <span>{formatAcreage(siteAcreage[1])} acres</span>
              </div>
            </div>
          </>
        )}

        {/* Preview Section */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Preview</h4>
          <div className="text-xs text-gray-500 mb-3">This is how your requirements will appear to agents:</div>
          
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            {listingType === 'commercial' ? (
              <>
                {sectors.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Sectors:</span>
                    <span className="text-gray-600 ml-2">
                      {sectors.map(sector => sectorsOptions.find(opt => opt.value === sector)?.label || sector).join(', ')}
                    </span>
                  </div>
                )}
                {useClasses.length > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Use Classes:</span>
                    <span className="text-gray-600 ml-2">
                      {useClasses.map(useClass => useClassesOptions.find(opt => opt.value === useClass)?.label || useClass).join(', ')}
                    </span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="font-medium">Site Size:</span>
                  <span className="text-gray-600 ml-2">
                    {formatSiteSize(siteSize[0])} - {formatSiteSize(siteSize[1])} sq ft
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm">
                  <span className="font-medium">Dwellings:</span>
                  <span className="text-gray-600 ml-2">
                    {dwellingCount[0]} - {dwellingCount[1]} units
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Site Size:</span>
                  <span className="text-gray-600 ml-2">
                    {formatAcreage(siteAcreage[0])} - {formatAcreage(siteAcreage[1])} acres
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </BaseCrudModal>
  );
}