'use client'

import React, { useState } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { RangeSlider } from '@/components/ui/range-slider';

interface SiteSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingType: 'commercial' | 'residential';
  currentData?: {
    // Commercial
    siteSizeMin?: number;
    siteSizeMax?: number;
    // Residential
    dwellingCountMin?: number;
    dwellingCountMax?: number;
    siteAcreageMin?: number;
    siteAcreageMax?: number;
  };
  onSave: (data: any) => void;
}

export function SiteSizeModal({ 
  isOpen, 
  onClose, 
  listingType,
  currentData,
  onSave
}: SiteSizeModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  
  // Commercial fields
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
      console.error('Error saving site size:', error);
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
      title={listingType === 'commercial' ? 'Edit Site Size' : 'Edit Property Size'}
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-lg"
    >
      <div className="p-6 space-y-8">
        {listingType === 'commercial' ? (
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

          </div>
        ) : (
          <div className="space-y-8">
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
                  unit="dwellings"
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
                  unit="acres"
                />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>{formatAcreage(siteAcreage[0])} acres</span>
                <span>{formatAcreage(siteAcreage[1])} acres</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseCrudModal>
  );
}