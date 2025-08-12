'use client'

import React, { useState } from 'react';
import { BaseCrudModal } from './base-crud-modal';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { Badge } from '@/components/ui/badge';

interface UseClassesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData?: string[];
  onSave: (useClasses: string[]) => void;
  useClassesOptions?: Array<{ value: string; label: string }>;
}

export function UseClassesModal({ 
  isOpen, 
  onClose, 
  currentData = [],
  onSave,
  useClassesOptions = []
}: UseClassesModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [useClasses, setUseClasses] = useState<string[]>(currentData);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(useClasses);
      onClose();
    } catch (error) {
      console.error('Error saving use classes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseCrudModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Use Classes"
      onSave={handleSave}
      isSaving={isSaving}
      className="max-w-lg"
    >
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Use Classes</h3>
          <p className="text-sm text-gray-600 mb-4">
            Select the use classes suitable for your requirements
          </p>
          
          <MultiSelectDropdown
            options={useClassesOptions}
            value={useClasses}
            onChange={setUseClasses}
            placeholder="Select use classes..."
            className="w-full"
          />
        </div>

        {useClasses.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900">Selected Use Classes</h4>
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
          </div>
        )}

        <div className="text-xs text-gray-500">
          Use classes define the permitted uses for your property requirements.
        </div>
      </div>
    </BaseCrudModal>
  );
}