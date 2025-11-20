'use client';

import { Users, Home, Briefcase, GraduationCap, Car, Heart, AlertCircle, TrendingUp, ChevronDown, Info } from 'lucide-react';
import type { LocationResult } from '@/lib/mapbox';
import { formatLocationDisplay } from '@/lib/mapbox';
import type { MeasurementMode } from './LocationInputPanel';
import { useState, useMemo } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { AffluenceMethodologyModal } from './AffluenceMethodologyModal';

interface DemographicsResultsProps {
  loading: boolean;
  error: string | null;
  location: LocationResult | null;
  measurementMode: MeasurementMode;
  measurementValue: number;
  totalLsoaCount?: number;
  rawData?: Record<string, any> | null;
  selectedLsoaCodes?: Set<string>;
  nationalAverages?: Record<string, number>;
}

type CategoryType = 'population' | 'demographics' | 'employment' | 'education' | 'mobility' | 'health' | 'affluence';

const CATEGORIES: { value: CategoryType; label: string; icon: any; color: string }[] = [
  { value: 'population', label: 'Population & Households', icon: Users, color: 'violet' },
  { value: 'demographics', label: 'Demographics', icon: Users, color: 'blue' },
  { value: 'employment', label: 'Employment', icon: Briefcase, color: 'green' },
  { value: 'education', label: 'Education', icon: GraduationCap, color: 'indigo' },
  { value: 'mobility', label: 'Mobility', icon: Car, color: 'cyan' },
  { value: 'health', label: 'Health', icon: Heart, color: 'rose' },
  { value: 'affluence', label: 'Affluence', icon: TrendingUp, color: 'emerald' },
];

interface ChartData {
  label: string;
  value: number;
  percentage: number;
  nationalAverage?: number;
}

export function DemographicsResults({
  loading,
  error,
  location,
  measurementMode,
  measurementValue,
  totalLsoaCount,
  rawData,
  selectedLsoaCodes,
  nationalAverages = {},
}: DemographicsResultsProps) {
  // Default to first 3 categories expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryType>>(
    new Set(['population', 'demographics', 'affluence'] as CategoryType[])
  );

  // State for methodology modal
  const [methodologyModalOpen, setMethodologyModalOpen] = useState(false);

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
      // Convert label to lowercase and replace spaces with underscores
      let componentId = label.toLowerCase().replace(/\s+/g, '_');

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

      return Object.entries(data)
        .map(([label, value]) => ({
          label,
          value: Number(value) || 0,
          percentage: grandTotal > 0 ? (Number(value) / grandTotal) * 100 : 0,
          nationalAverage: findNationalAverage(label, field),
        }))
        .sort((a, b) => b.value - a.value);
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
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  // Empty State
  if (!loading && !rawData && !error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center">
            <Users className="h-10 w-10 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Data Yet
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            Select a location and click "Analyse" to view demographics.
          </p>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Error Loading Data
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // Results State
  if (!rawData || !allCategoryData) return null;

  const selectedCount = selectedLsoaCodes?.size || 0;

  return (
    <div className="space-y-3">
      {/* Sticky Summary Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 pb-3 z-10 -mx-6 px-6 pt-0">
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Demographics Report</h2>
            {location && (
              <p className="text-xs text-gray-500 mt-1">
                {formatLocationDisplay(location)} • {getMeasurementDisplay()} •{' '}
                {totalLsoaCount && totalLsoaCount > selectedCount ? (
                  <>
                    <span className="font-medium text-violet-600">
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

          {/* Key Metrics Summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-violet-50 rounded-lg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-gray-600 font-medium">Population</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">
                {formatNumber(allCategoryData.population.totalPop)}
              </div>
            </div>
            <div className="bg-emerald-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <div className="text-[10px] uppercase tracking-wide text-gray-600 font-medium">Affluence</div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="inline-flex items-center justify-center rounded-full hover:bg-emerald-100 transition-colors p-0.5"
                      aria-label="Learn about affluence score calculation"
                    >
                      <Info className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="start">
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-900">
                          How is this calculated?
                        </p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                          The Affluence Score combines Census 2021 socioeconomic measures (70%) with household income data (30%) to create a single score from 0–100.
                        </p>
                      </div>
                      <button
                        onClick={() => setMethodologyModalOpen(true)}
                        className="text-xs font-medium text-violet-600 hover:text-violet-700 underline-offset-2 hover:underline"
                      >
                        Learn more about the methodology →
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">
                {allCategoryData.affluence.score.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion Categories */}
      <div className="space-y-2">
        {/* Affluence Methodology Modal */}
        <AffluenceMethodologyModal
          open={methodologyModalOpen}
          onOpenChange={setMethodologyModalOpen}
        />

        {CATEGORIES.map((category) => {
          const isExpanded = expandedCategories.has(category.value);
          const categoryDataObj = allCategoryData[category.value];
          const Icon = category.icon;

          return (
            <div key={category.value} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              {/* Header - Always visible */}
              <button
                onClick={() => toggleCategory(category.value)}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-gray-600" />
                  <span className="font-medium text-sm text-gray-900">{category.label}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Content - Collapsible */}
              {isExpanded && categoryDataObj && (
                <div className="border-t border-gray-100 bg-gray-50">
                  <div className="px-4 py-3 space-y-4">
                    {categoryDataObj.charts.map((chart, index) => (
                      <div key={index}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <h4 className="text-xs font-semibold text-gray-700">{chart.title}</h4>
                          {chart.title === 'Affluence Score' && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  className="inline-flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors p-0.5"
                                  aria-label="Learn about affluence score calculation"
                                >
                                  <Info className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-80" align="start">
                                <div className="space-y-3">
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-900">
                                      How is this calculated?
                                    </p>
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      The Affluence Score combines Census 2021 socioeconomic measures (70%) with household income data (30%) to create a single score from 0–100.
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => setMethodologyModalOpen(true)}
                                    className="text-xs font-medium text-violet-600 hover:text-violet-700 underline-offset-2 hover:underline"
                                  >
                                    Learn more about the methodology →
                                  </button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>

                        {chart.data.length === 0 ? (
                          <div className="text-center py-2 text-xs text-gray-400">No data</div>
                        ) : chart.data.length === 1 && chart.data[0].label.includes('Total') ? (
                          // Special display for totals
                          <div className="text-center py-2">
                            <p className="text-2xl font-bold text-gray-900">
                              {formatNumber(chart.data[0].value)}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{chart.data[0].label}</p>
                          </div>
                        ) : chart.title === 'Affluence Score' ? (
                          // Special display for affluence score
                          (() => {
                            const score = chart.data[0].value;
                            const ukAverage = nationalAverages['affluence_score'] || 57.0; // Default UK average
                            const difference = score - ukAverage;
                            const isAboveAverage = difference > 0.5;
                            const isBelowAverage = difference < -0.5;

                            // Determine rating and color
                            const getRating = (score: number) => {
                              if (score >= 70) return { label: 'Very High Affluence', color: 'text-blue-600', bg: 'bg-blue-50', barColor: 'bg-blue-500' };
                              if (score >= 55) return { label: 'High Affluence', color: 'text-emerald-600', bg: 'bg-emerald-50', barColor: 'bg-emerald-500' };
                              if (score >= 45) return { label: 'Medium Affluence', color: 'text-amber-600', bg: 'bg-amber-50', barColor: 'bg-amber-500' };
                              return { label: 'Low Affluence', color: 'text-rose-600', bg: 'bg-rose-50', barColor: 'bg-rose-500' };
                            };

                            const rating = getRating(score);

                            return (
                              <div className={`${rating.bg} rounded-lg p-4 space-y-3`}>
                                {/* Score Display */}
                                <div className="text-center">
                                  <div className="flex items-baseline gap-1 justify-center">
                                    <span className="text-4xl font-bold text-gray-900">{score.toFixed(1)}</span>
                                    <span className="text-base text-gray-500">/100</span>
                                  </div>
                                  <p className={`text-sm font-medium ${rating.color} mt-2`}>{rating.label}</p>
                                </div>

                                {/* Scale Visualization */}
                                <div className="space-y-1">
                                  <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                                    {/* Progress bar */}
                                    <div
                                      className={`h-full ${rating.barColor} rounded-full transition-all`}
                                      style={{ width: `${Math.min(score, 100)}%` }}
                                    />
                                  </div>

                                  {/* Scale labels */}
                                  <div className="flex justify-between text-[9px] text-gray-500 px-0.5">
                                    <span>0</span>
                                    <span>25</span>
                                    <span>50</span>
                                    <span>75</span>
                                    <span>100</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          // Ultra-compact list
                          <div className="space-y-1.5">
                            {/* Column headers */}
                            <div className="flex items-center gap-2 text-xs pb-1 border-b border-gray-200">
                              <div className="flex-1 text-[9px] uppercase tracking-wide text-gray-500 font-medium">
                                Category
                              </div>
                              <div className="w-12 text-right text-[9px] uppercase tracking-wide text-gray-500 font-medium">
                                Count
                              </div>
                              <div className="w-10 text-right text-[9px] uppercase tracking-wide text-gray-500 font-medium">
                                %
                              </div>
                              <div className="w-14 text-right text-[9px] uppercase tracking-wide text-gray-500 font-medium">
                                vs UK
                              </div>
                            </div>

                            {chart.data.slice(0, 10).map((item: ChartData, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <div className="flex-1 text-gray-700 text-[11px]" title={item.label}>
                                  {item.label}
                                </div>
                                <div className="w-12 text-right font-medium text-gray-900 text-[11px]">
                                  {formatNumber(item.value)}
                                </div>
                                <div className="w-10 text-right text-gray-500 text-[11px]">
                                  {formatPercentage(item.percentage)}
                                </div>
                                {/* Comparison badge */}
                                {'nationalAverage' in item && item.nationalAverage !== undefined && item.nationalAverage > 0 && (
                                  <div
                                    className={`w-14 text-right text-[10px] font-medium tabular-nums ${
                                      item.percentage > item.nationalAverage + 0.5
                                        ? 'text-emerald-600'
                                        : item.percentage < item.nationalAverage - 0.5
                                          ? 'text-rose-600'
                                          : 'text-gray-500'
                                    }`}
                                    title={`${item.percentage > item.nationalAverage ? 'Above' : item.percentage < item.nationalAverage ? 'Below' : 'At'} UK average by ${Math.abs(item.percentage - item.nationalAverage).toFixed(1)}%`}
                                  >
                                    {item.percentage > item.nationalAverage + 0.5 ? (
                                      <>↑ {(item.percentage - item.nationalAverage).toFixed(1)}%</>
                                    ) : item.percentage < item.nationalAverage - 0.5 ? (
                                      <>↓ {(item.nationalAverage - item.percentage).toFixed(1)}%</>
                                    ) : (
                                      <>0%</>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                            {chart.data.length > 10 && (
                              <p className="text-[10px] text-gray-400 mt-2 text-center">
                                +{chart.data.length - 10} more
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
