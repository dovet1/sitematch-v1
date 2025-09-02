'use client'

import React, { useState } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { Badge } from '@/components/ui/badge';

interface SectorsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData?: string[];
  onSave: (sectors: string[]) => void;
  sectorsOptions?: Array<{ value: string; label: string }>;
}

export function SectorsModal({ 
  isOpen, 
  onClose, 
  currentData = [],
  onSave,
  sectorsOptions = []
}: SectorsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [sectors, setSectors] = useState<string[]>(currentData);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(sectors);
      onClose();
    } catch (error) {
      console.error('Error saving sectors:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Property Sectors"
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-lg"
    >
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Property Sectors</h3>
          <p className="text-sm text-gray-600 mb-4">
            Select the sectors that match your property requirements
          </p>
          
          <MultiSelectDropdown
            options={sectorsOptions}
            value={sectors}
            onChange={setSectors}
            placeholder="Select sectors..."
            className="w-full"
          />
        </div>

        {sectors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Selected Sectors</h4>
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
          </div>
        )}

        <div className="text-xs text-gray-500">
          You may select more than one.
        </div>
      </div>
    </BaseCrudModal>
  );
}