'use client';

import { useState, useEffect } from 'react';
import { X, Building, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

interface AgencyFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  classification: string;
  onClassificationChange: (classification: string) => void;
}

export function AgencyFilterDrawer({
  isOpen,
  onClose,
  classification,
  onClassificationChange
}: AgencyFilterDrawerProps) {
  const [localClassification, setLocalClassification] = useState(classification);

  useEffect(() => {
    setLocalClassification(classification);
  }, [classification]);

  const handleApplyFilters = () => {
    onClassificationChange(localClassification);
    onClose();
  };

  const handleClearFilters = () => {
    setLocalClassification('all');
    onClassificationChange('all');
  };

  const classificationOptions = [
    { value: 'all', label: 'All Specialisations', description: 'Show all agency types' },
    { value: 'Commercial', label: 'Commercial Property', description: 'Agencies specialising in commercial properties' },
    { value: 'Residential', label: 'Residential Property', description: 'Agencies specialising in residential properties' }
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-modal backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-modal border-l border-border overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Filter className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Filter Agencies</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Agency Specialization */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <Label className="text-base font-medium">Agency Specialization</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Filter by the type of properties agencies specialize in
                    </p>
                  </div>
                </div>

                <RadioGroup 
                  value={localClassification} 
                  onValueChange={setLocalClassification}
                  className="space-y-3"
                >
                  {classificationOptions.map((option) => (
                    <div key={option.value} className="flex items-start space-x-3">
                      <RadioGroupItem 
                        value={option.value} 
                        id={option.value}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <Label 
                          htmlFor={option.value}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {option.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Active Filters Summary */}
              {localClassification !== 'all' && (
                <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                  <h4 className="text-sm font-medium text-primary mb-2">Active Filters</h4>
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                      <Building className="h-3 w-3" />
                      {classificationOptions.find(opt => opt.value === localClassification)?.label}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border p-6 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="flex-1"
                disabled={localClassification === 'all'}
              >
                Clear Filters
              </Button>
              <Button
                onClick={handleApplyFilters}
                className="flex-1"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}