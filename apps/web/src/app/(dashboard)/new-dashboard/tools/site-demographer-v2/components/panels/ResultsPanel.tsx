'use client';

import { Users, AlertCircle, MapPin, Info, Save } from 'lucide-react';
import type { LocationResult } from '@/lib/mapbox';
import { formatLocationDisplay } from '@/lib/mapbox';
import type { MeasurementMode } from '@/components/demographics/desktop/LocationInputPanel';
import { useState, useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { AffluenceMethodologyModal } from '@/components/demographics/AffluenceMethodologyModal';
import { SaveAnalysisModal } from '@/components/demographics/SaveAnalysisModal';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { CoverageStatus } from '@/lib/types/demographics';
import { getCoverageMessages } from '@/lib/coverage-utils';
import { Button } from '../primitives/Button';
import { PopulationCard } from '../cards/PopulationCard';
import { AffluenceCard } from '../cards/AffluenceCard';
import { CategoryAccordion } from '../cards/CategoryAccordion';

interface ResultsPanelProps {
  loading: boolean;
  error: string | null;
  errorType?: 'coverage' | 'validation' | 'server' | null;
  coverageStatus?: CoverageStatus | null;
  location: LocationResult | null;
  measurementMode: MeasurementMode;
  measurementValue: number;
  totalLsoaCount?: number;
  rawData?: Record<string, any> | null;
  selectedLsoaCodes?: Set<string>;
  nationalAverages?: Record<string, number>;
  isFreeTier?: boolean;
  isochroneGeometry?: any;
  linkedSiteId?: string | null;
  onSave?: () => void;
  onUpgradeClick?: (feature?: 'save' | 'traffic' | 'count' | 'demographics') => void;
}

type CategoryType = 'population' | 'demographics' | 'employment' | 'education' | 'mobility' | 'health' | 'affluence';

const CATEGORIES: { value: CategoryType; label: string; icon: any; color: string }[] = [
  { value: 'population', label: 'Population & Households', icon: Users, color: 'violet' },
  { value: 'demographics', label: 'Demographics', icon: Users, color: 'blue' },
  { value: 'employment', label: 'Employment', icon: Users, color: 'green' },
  { value: 'education', label: 'Education', icon: Users, color: 'indigo' },
  { value: 'mobility', label: 'Mobility', icon: Users, color: 'cyan' },
  { value: 'health', label: 'Health', icon: Users, color: 'rose' },
  { value: 'affluence', label: 'Affluence', icon: Users, color: 'emerald' },
];

interface ChartData {
  label: string;
  value: number;
  percentage: number;
  nationalAverage?: number;
}

// Age group ordering from youngest to oldest - extract first number for sorting
const getAgeGroupSortValue = (label: string): number => {
  const match = label.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
};

export function ResultsPanel({
  loading,
  error,
  errorType,
  coverageStatus,
  location,
  measurementMode,
  measurementValue,
  totalLsoaCount,
  rawData,
  selectedLsoaCodes,
  nationalAverages = {},
  isFreeTier = false,
  isochroneGeometry,
  linkedSiteId,
  onSave,
}: ResultsPanelProps) {
  const { user } = useAuth();
  const { hasProAccess } = useSubscriptionTier();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Preserve full path including query params
  const currentPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

  // Default to first 3 categories expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryType>>(
    new Set(['population', 'demographics', 'affluence'] as CategoryType[])
  );

  // State for methodology modal
  const [methodologyModalOpen, setMethodologyModalOpen] = useState(false);

  // State for save analysis modal
  const [showSaveModal, setShowSaveModal] = useState(false);

  const toggleCategory = (category: CategoryType) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getMeasurementDisplay = () => {
    switch (measurementMode) {
      case 'distance':
        return `${measurementValue} mile${measurementValue !== 1 ? 's' : ''}`;
      case 'drive_time':
        return `${measurementValue} min drive`;
      case 'walk_time':
        return `${measurementValue} min walk`;
    }
  };

  // Get all category data at once (not just selected category)
  const allCategoryData = useMemo(() => {
    if (!rawData) return null;

    const aggregatedData = rawData['aggregated'];
    if (!aggregatedData) return null;

    // Helper to convert display label back to component_id format
    const labelToComponentId = (label: string, prefix?: string): string => {
      let componentId = label.toLowerCase();

      // Special handling for age groups: reverse "5 to 9" → "5_9"
      if (prefix === 'age_') {
        componentId = componentId
          .replace(/(\d+)\s+to\s+(\d+)/, '$1_$2')  // "5 to 9" → "5_9"
          .replace(/(\d+)\+/, '$1_and_over');       // "85+" → "85_and_over"
      }

      // Convert remaining spaces to underscores
      componentId = componentId.replace(/\s+/g, '_');

      // Add prefix if provided
      if (prefix) {
        componentId = prefix + componentId;
      }

      return componentId;
    };

    // Helper to find national average for a label
    const findNationalAverage = (label: string, field: string): number | undefined => {
      // Try different component_id patterns
      const patterns: string[] = [];

      // Add prefix-based patterns
      if (field === 'household_composition') patterns.push(labelToComponentId(label, 'hhc_'));
      else if (field === 'accommodation_type') patterns.push(labelToComponentId(label, 'accom_'));
      else if (field === 'age_groups') patterns.push(labelToComponentId(label, 'age_'));
      else if (field === 'country_of_birth') patterns.push(labelToComponentId(label, 'cob_'));
      else if (field === 'distance_to_work') patterns.push(labelToComponentId(label, 'ts058_'));
      else if (field === 'economic_activity') patterns.push(labelToComponentId(label, 'economically_'));

      // Add raw pattern without prefix
      patterns.push(labelToComponentId(label));

      // Search for match in national averages
      for (const pattern of patterns) {
        if (nationalAverages[pattern] !== undefined) {
          return nationalAverages[pattern];
        }
      }

      return undefined;
    };

    const aggregateData = (field: string): ChartData[] => {
      const data = aggregatedData[field];
      if (!data || typeof data !== 'object') return [];

      let grandTotal = 0;
      Object.values(data).forEach(value => {
        grandTotal += Number(value) || 0;
      });

      const items = Object.entries(data)
        .map(([label, value]) => ({
          label,
          value: Number(value) || 0,
          percentage: grandTotal > 0 ? (Number(value) / grandTotal) * 100 : 0,
          nationalAverage: findNationalAverage(label, field),
        }));

      // Sort age groups by age order (youngest to oldest), others by count
      if (field === 'age_groups') {
        return items.sort((a, b) => getAgeGroupSortValue(a.label) - getAgeGroupSortValue(b.label));
      }

      return items.sort((a, b) => b.value - a.value);
    };

    const getTotalPopulation = (): number => {
      return aggregatedData.population_total || 0;
    };

    const getTotalHouseholds = (): number => {
      return aggregatedData.households_total || 0;
    };

    const getAffluenceScore = (): number => {
      return aggregatedData.affluence?.avg_raw_score || 0;
    };

    return {
      population: {
        charts: [
          { title: 'Population (total)', data: [{ label: 'Total Population', value: getTotalPopulation(), percentage: 100 }] },
          { title: 'Number of households', data: [{ label: 'Total Households', value: getTotalHouseholds(), percentage: 100 }] },
          { title: 'Household composition', data: aggregateData('household_composition') },
          { title: 'Type of accommodation', data: aggregateData('accommodation_type') },
          { title: 'Tenure', data: aggregateData('tenure') },
        ],
        totalPop: getTotalPopulation(),
        totalHouseholds: getTotalHouseholds(),
      },
      demographics: {
        charts: [
          { title: 'Age profile', data: aggregateData('age_groups') },
          { title: 'Ethnic group', data: aggregateData('ethnicity') },
          { title: 'Country of birth', data: aggregateData('country_of_birth') },
          { title: 'Religion', data: aggregateData('religion') },
        ],
      },
      employment: {
        charts: [
          { title: 'Economic activity', data: aggregateData('economic_activity') },
          { title: 'Occupation', data: aggregateData('occupation') },
        ],
      },
      education: {
        charts: [
          { title: 'Highest level of qualification', data: aggregateData('qualifications') },
        ],
      },
      mobility: {
        charts: [
          { title: 'Method of travel to work', data: aggregateData('travel_to_work') },
          { title: 'Distance travelled to work', data: aggregateData('distance_to_work') },
        ],
      },
      health: {
        charts: [
          { title: 'General health', data: aggregateData('general_health') },
          { title: 'Disability', data: aggregateData('disability') },
        ],
      },
      affluence: {
        charts: [
          {
            title: 'Affluence Score',
            data: [
              {
                label: `Score: ${getAffluenceScore().toFixed(1)}`,
                value: getAffluenceScore(),
                percentage: 100,
              },
            ],
          },
        ],
        score: getAffluenceScore(),
      },
    };
  }, [rawData, nationalAverages]);

  const formatNumber = (num: number) => num.toLocaleString();

  // Helper to determine if a category should be blurred for free tier
  const shouldBlurCategory = (category: CategoryType): boolean => {
    if (!isFreeTier) return false;
    // Blur: demographics, employment, education, mobility, health
    // Keep visible: population, affluence
    return ['demographics', 'employment', 'education', 'mobility', 'health'].includes(category);
  };

  const handleUpgradeClick = () => {
    if (!user) {
      router.push(`/auth?mode=signup&returnUrl=${encodeURIComponent(currentPath)}`);
    } else {
      router.push('/pricing');
    }
  };

  // Empty State
  if (!loading && !rawData && !error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-sm-violet/10 flex items-center justify-center">
            <Users className="h-10 w-10 text-sm-violet" />
          </div>
          <h3 className="text-lg font-semibold text-sm-ink mb-2">
            No Data Yet
          </h3>
          <p className="text-sm text-sm-ink/60 leading-relaxed">
            Select a location and click "Analyse" to view demographics.
          </p>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-sm-bg rounded w-1/3" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-sm-bg rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    // Special handling for coverage errors
    if (errorType === 'coverage' && coverageStatus) {
      const messages = getCoverageMessages(coverageStatus, location?.place_name || 'this location');

      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-md px-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-sm-violet/10 flex items-center justify-center">
              <MapPin className="h-10 w-10 text-sm-violet" />
            </div>
            <h3 className="text-lg font-semibold text-sm-ink mb-2">
              {messages.emptyStateTitle}
            </h3>
            <p className="text-sm text-sm-ink/60 leading-relaxed mb-4">
              {messages.emptyStateDescription}
            </p>
            {messages.futureExpansion && (
              <div className="mt-4 p-3 bg-sm-bg border border-sm-border rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-sm-violet mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-sm-ink/70 text-left leading-relaxed">
                    {messages.futureExpansion}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Generic error state
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-sm-ink mb-2">
            Error Loading Data
          </h3>
          <p className="text-sm text-sm-ink/60 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // Results State
  if (!rawData || !allCategoryData) return null;

  const selectedCount = selectedLsoaCodes?.size || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Partial Coverage Banner */}
      {coverageStatus?.isPartiallyCovered && (
        <div className="mx-6 mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-amber-900">Partial Coverage</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Your search area crosses regional boundaries. Results show only the England & Wales portion of your search area.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Summary Header */}
      <div className="sticky top-0 bg-sm-surface border-b border-sm-border pb-4 z-10 px-6 pt-6">
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-sm-ink">Demographics Report</h2>
            {location && (
              <p className="text-xs text-sm-ink/60 mt-1">
                {formatLocationDisplay(location)} • {getMeasurementDisplay()} •{' '}
                {totalLsoaCount && totalLsoaCount > selectedCount ? (
                  <>
                    <span className="font-medium text-sm-violet">
                      {selectedCount} of {totalLsoaCount} areas
                    </span>
                    {' '}selected
                  </>
                ) : (
                  <span>{selectedCount} areas</span>
                )}
              </p>
            )}
          </div>

          {/* Key Metrics Summary - Always visible cards */}
          <div className="space-y-2">
            <PopulationCard
              totalPopulation={allCategoryData.population.totalPop}
              totalHouseholds={allCategoryData.population.totalHouseholds}
            />
            <AffluenceCard
              score={allCategoryData.affluence.score}
              nationalAverages={nationalAverages}
              onMethodologyClick={() => setMethodologyModalOpen(true)}
            />
          </div>

          {/* Save Analysis Button */}
          <Button
            onClick={() => {
              if (!hasProAccess) {
                handleUpgradeClick();
              } else {
                setShowSaveModal(true);
              }
            }}
            variant="primary"
            size="sm"
            className="w-full"
            icon={<Save className="h-4 w-4" />}
          >
            {hasProAccess ? 'Save Analysis' : 'Save Analysis (Pro)'}
          </Button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-2">
          {/* Affluence Methodology Modal */}
          <AffluenceMethodologyModal
            open={methodologyModalOpen}
            onOpenChange={setMethodologyModalOpen}
          />

          {/* Category Accordions - Demographics onwards */}
          {CATEGORIES.filter(cat => cat.value !== 'population' && cat.value !== 'affluence').map((category) => {
            const categoryDataObj = allCategoryData[category.value];
            if (!categoryDataObj) return null;

            return (
              <CategoryAccordion
                key={category.value}
                category={category}
                categoryData={categoryDataObj}
                isExpanded={expandedCategories.has(category.value)}
                onToggle={() => toggleCategory(category.value)}
                shouldBlur={shouldBlurCategory(category.value)}
                onUpgradeClick={handleUpgradeClick}
                nationalAverages={nationalAverages}
              />
            );
          })}
        </div>
      </div>

      {/* Save Analysis Modal */}
      <SaveAnalysisModal
        open={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSuccess={() => {
          setShowSaveModal(false);
          onSave?.();
        }}
        analysisData={location && selectedLsoaCodes && rawData ? {
          location: {
            lat: location.center[1],
            lng: location.center[0],
          },
          location_name: formatLocationDisplay(location),
          measurement_mode: measurementMode,
          measurement_value: measurementValue,
          selected_lsoa_codes: Array.from(selectedLsoaCodes),
          demographics_data: rawData,
          national_averages: nationalAverages,
          isochrone_geometry: isochroneGeometry,
        } : null}
        linkedSiteId={linkedSiteId}
      />
    </div>
  );
}
