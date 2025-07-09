'use client';

import { useState, useEffect } from 'react';
import { X, Building, MapPin, DollarSign, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchFilters, SectorOption, UseClassOption } from '@/types/search';
import { cn } from '@/lib/utils';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}

export function FilterDrawer({ isOpen, onClose, filters, onFiltersChange }: FilterDrawerProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);

  // Mock data - in production, this would come from API
  const sectors: SectorOption[] = [
    { id: '1', value: 'retail', label: 'Retail', count: 245 },
    { id: '2', value: 'office', label: 'Office', count: 189 },
    { id: '3', value: 'industrial', label: 'Industrial', count: 156 },
    { id: '4', value: 'hospitality', label: 'Hospitality', count: 123 },
    { id: '5', value: 'healthcare', label: 'Healthcare', count: 98 },
    { id: '6', value: 'education', label: 'Education', count: 87 },
  ];

  const useClasses: UseClassOption[] = [
    { id: '1', value: 'a1', label: 'A1 - Shops', count: 156 },
    { id: '2', value: 'a3', label: 'A3 - Restaurants', count: 89 },
    { id: '3', value: 'b1', label: 'B1 - Business/Office', count: 234 },
    { id: '4', value: 'b2', label: 'B2 - General Industrial', count: 67 },
    { id: '5', value: 'b8', label: 'B8 - Storage/Distribution', count: 45 },
    { id: '6', value: 'c1', label: 'C1 - Hotels', count: 34 },
    { id: '7', value: 'd1', label: 'D1 - Non-residential institutions', count: 23 },
    { id: '8', value: 'd2', label: 'D2 - Assembly/Leisure', count: 56 },
  ];

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleInputChange = (field: keyof SearchFilters, value: any) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSectorChange = (sectorValue: string, checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      sector: checked
        ? [...prev.sector, sectorValue]
        : prev.sector.filter(s => s !== sectorValue)
    }));
  };

  const handleUseClassChange = (useClassValue: string, checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      useClass: checked
        ? [...prev.useClass, useClassValue]
        : prev.useClass.filter(uc => uc !== useClassValue)
    }));
  };

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleClearFilters = () => {
    const clearedFilters: SearchFilters = {
      location: '',
      coordinates: null,
      companyName: '',
      sector: [],
      useClass: [],
      sizeMin: null,
      sizeMax: null,
      isNationwide: false,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = localFilters.companyName || 
    localFilters.sector.length > 0 || 
    localFilters.useClass.length > 0 || 
    localFilters.sizeMin !== null || 
    localFilters.sizeMax !== null || 
    localFilters.isNationwide;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border p-4">
          <div className="flex items-center justify-between">
            <h2 className="heading-4 font-semibold">Filter Search</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="violet-bloom-touch"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Filter Content */}
        <div className="p-4 space-y-6">
          {/* Company Name Search */}
          <div className="space-y-2">
            <Label htmlFor="company-search" className="text-sm font-medium">
              Company Name
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="company-search"
                type="text"
                placeholder="Search by company name..."
                value={localFilters.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                className="pl-10 violet-bloom-input"
              />
            </div>
          </div>

          {/* Sectors */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Sectors</Label>
            <div className="space-y-2">
              {sectors.map((sector) => (
                <div key={sector.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sector-${sector.id}`}
                    checked={localFilters.sector.includes(sector.value)}
                    onCheckedChange={(checked) => handleSectorChange(sector.value, checked as boolean)}
                    className="violet-bloom-checkbox"
                  />
                  <Label
                    htmlFor={`sector-${sector.id}`}
                    className="text-sm cursor-pointer flex-1 flex justify-between"
                  >
                    <span>{sector.label}</span>
                    <span className="text-muted-foreground">({sector.count})</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Use Classes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Planning Use Class</Label>
            <div className="space-y-2">
              {useClasses.map((useClass) => (
                <div key={useClass.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`use-class-${useClass.id}`}
                    checked={localFilters.useClass.includes(useClass.value)}
                    onCheckedChange={(checked) => handleUseClassChange(useClass.value, checked as boolean)}
                    className="violet-bloom-checkbox"
                  />
                  <Label
                    htmlFor={`use-class-${useClass.id}`}
                    className="text-sm cursor-pointer flex-1 flex justify-between"
                  >
                    <span>{useClass.label}</span>
                    <span className="text-muted-foreground">({useClass.count})</span>
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Site Size Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Site Size (sq ft)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="size-min" className="text-xs text-muted-foreground">
                  Minimum
                </Label>
                <Input
                  id="size-min"
                  type="number"
                  placeholder="Min"
                  value={localFilters.sizeMin || ''}
                  onChange={(e) => handleInputChange('sizeMin', e.target.value ? Number(e.target.value) : null)}
                  className="violet-bloom-input"
                />
              </div>
              <div>
                <Label htmlFor="size-max" className="text-xs text-muted-foreground">
                  Maximum
                </Label>
                <Input
                  id="size-max"
                  type="number"
                  placeholder="Max"
                  value={localFilters.sizeMax || ''}
                  onChange={(e) => handleInputChange('sizeMax', e.target.value ? Number(e.target.value) : null)}
                  className="violet-bloom-input"
                />
              </div>
            </div>
          </div>

          {/* Nationwide Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="nationwide"
              checked={localFilters.isNationwide}
              onCheckedChange={(checked) => handleInputChange('isNationwide', checked)}
              className="violet-bloom-checkbox"
            />
            <Label htmlFor="nationwide" className="text-sm cursor-pointer">
              Include nationwide requirements
            </Label>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-border p-4 space-y-3">
          <Button
            onClick={handleApplyFilters}
            className="w-full violet-bloom-button-primary"
            size="lg"
          >
            Apply Filters
            {hasActiveFilters && (
              <span className="ml-2 px-2 py-1 bg-primary-600 text-primary-foreground rounded-full text-xs">
                {[
                  localFilters.companyName && 'Company',
                  localFilters.sector.length > 0 && `${localFilters.sector.length} Sectors`,
                  localFilters.useClass.length > 0 && `${localFilters.useClass.length} Use Classes`,
                  (localFilters.sizeMin || localFilters.sizeMax) && 'Size',
                  localFilters.isNationwide && 'Nationwide'
                ].filter(Boolean).length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              onClick={handleClearFilters}
              variant="outline"
              className="w-full violet-bloom-button-outline"
              size="lg"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      </div>
    </>
  );
}