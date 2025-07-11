'use client';

import { useState, useEffect } from 'react';
import { X, Building, MapPin, DollarSign, Search, ChevronDown, ChevronRight } from 'lucide-react';
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

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  hasActiveFilters: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, isOpen, onToggle, hasActiveFilters, children }: CollapsibleSectionProps) {
  return (
    <div className="border-b border-border pb-4 last:border-b-0">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full py-2 text-left hover:bg-accent/50 rounded-lg px-2 transition-colors",
          hasActiveFilters && "bg-primary/10"
        )}
      >
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">{title}</span>
          {hasActiveFilters && (
            <div className="w-2 h-2 bg-primary rounded-full" />
          )}
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="mt-3 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

export function FilterDrawer({ isOpen, onClose, filters, onFiltersChange }: FilterDrawerProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [useClasses, setUseClasses] = useState<UseClassOption[]>([]);
  const [companyNames, setCompanyNames] = useState<string[]>([]);
  const [filteredCompanyNames, setFilteredCompanyNames] = useState<string[]>([]);
  const [companySearchValue, setCompanySearchValue] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    company: false,
    sectors: false,
    useClasses: false,
    siteSize: false
  });

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Fetch reference data and company names from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch reference data
        const referenceResponse = await fetch('/api/public/reference-data');
        if (referenceResponse.ok) {
          const referenceData = await referenceResponse.json();
          // Only show sectors and use classes that have published listings
          setSectors(referenceData.sectors?.filter((s: SectorOption) => (s.count || 0) > 0) || []);
          setUseClasses(referenceData.useClasses?.filter((uc: UseClassOption) => (uc.count || 0) > 0) || []);
        }

        // Fetch company names from published listings
        const listingsResponse = await fetch('/api/public/listings?limit=100');
        if (listingsResponse.ok) {
          const listingsData = await listingsResponse.json();
          const uniqueCompanyNames = Array.from(new Set(
            listingsData.results
              .map((listing: any) => listing.company_name)
              .filter((name: string) => name && name.trim())
          )) as string[];
          uniqueCompanyNames.sort();
          setCompanyNames(uniqueCompanyNames);
          setFilteredCompanyNames(uniqueCompanyNames);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (field: keyof SearchFilters, value: any) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleCompanySearch = (value: string) => {
    setCompanySearchValue(value);
    const filtered = companyNames.filter(name => 
      name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredCompanyNames(filtered);
  };

  const handleCompanySelect = (companyName: string) => {
    setLocalFilters(prev => ({ ...prev, companyName }));
    setCompanySearchValue(companyName);
    setFilteredCompanyNames(companyNames);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
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
    setCompanySearchValue('');
    setFilteredCompanyNames(companyNames);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = localFilters.companyName || 
    localFilters.sector.length > 0 || 
    localFilters.useClass.length > 0 || 
    localFilters.sizeMin !== null || 
    localFilters.sizeMax !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-modal-backdrop transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-full max-w-md bg-white shadow-xl z-modal overflow-y-auto transition-transform duration-300 ease-in-out",
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
        <div className="p-4 space-y-4">
          {/* Company Name Search */}
          <CollapsibleSection
            title="Company Name"
            isOpen={expandedSections.company}
            onToggle={() => toggleSection('company')}
            hasActiveFilters={!!localFilters.companyName}
          >
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="company-search"
                  type="text"
                  placeholder="Search by company name..."
                  value={companySearchValue || localFilters.companyName}
                  onChange={(e) => {
                    handleCompanySearch(e.target.value);
                    handleInputChange('companyName', e.target.value);
                  }}
                  className="pl-10 violet-bloom-input"
                />
              </div>
              {expandedSections.company && (
                <div className="max-h-32 overflow-y-auto border border-border rounded-lg">
                  {isLoadingData ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Loading company names...
                    </div>
                  ) : companyNames.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No companies found
                    </div>
                  ) : filteredCompanyNames.length === 0 && companySearchValue ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No companies found matching "{companySearchValue}"
                    </div>
                  ) : (
                    filteredCompanyNames.slice(0, 10).map((name, index) => (
                      <button
                        key={index}
                        onClick={() => handleCompanySelect(name)}
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b border-border last:border-b-0"
                      >
                        {name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Sectors */}
          <CollapsibleSection
            title="Sectors"
            isOpen={expandedSections.sectors}
            onToggle={() => toggleSection('sectors')}
            hasActiveFilters={localFilters.sector.length > 0}
          >
            {localFilters.sector.length > 1 && (
              <p className="text-xs text-muted-foreground mb-2">Showing listings from any selected sector</p>
            )}
            <div className="space-y-2">
              {isLoadingData ? (
                <div className="text-sm text-muted-foreground">Loading sectors...</div>
              ) : sectors.length === 0 ? (
                <div className="text-sm text-muted-foreground">No sectors available</div>
              ) : (
                sectors.map((sector) => (
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
              )))}
            </div>
          </CollapsibleSection>

          {/* Use Classes */}
          <CollapsibleSection
            title="Planning Use Class"
            isOpen={expandedSections.useClasses}
            onToggle={() => toggleSection('useClasses')}
            hasActiveFilters={localFilters.useClass.length > 0}
          >
            {localFilters.useClass.length > 1 && (
              <p className="text-xs text-muted-foreground mb-2">Showing listings from any selected use class</p>
            )}
            <div className="space-y-2">
              {isLoadingData ? (
                <div className="text-sm text-muted-foreground">Loading use classes...</div>
              ) : useClasses.length === 0 ? (
                <div className="text-sm text-muted-foreground">No use classes available</div>
              ) : (
                useClasses.map((useClass) => (
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
              )))}
            </div>
          </CollapsibleSection>

          {/* Site Size Range */}
          <CollapsibleSection
            title="Site Size (sq ft)"
            isOpen={expandedSections.siteSize}
            onToggle={() => toggleSection('siteSize')}
            hasActiveFilters={localFilters.sizeMin !== null || localFilters.sizeMax !== null}
          >
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
          </CollapsibleSection>

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
                  (localFilters.sizeMin || localFilters.sizeMax) && 'Size'
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