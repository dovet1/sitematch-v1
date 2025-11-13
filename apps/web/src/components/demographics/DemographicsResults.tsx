'use client';

import { Users, Home, Briefcase, GraduationCap, Car, Heart, AlertCircle, TrendingUp } from 'lucide-react';
import type { LocationResult } from '@/lib/mapbox';
import { formatLocationDisplay } from '@/lib/mapbox';
import type { MeasurementMode } from './LocationInputPanel';
import { useState, useMemo } from 'react';

interface DemographicsResultsProps {
  loading: boolean;
  error: string | null;
  location: LocationResult | null;
  measurementMode: MeasurementMode;
  measurementValue: number;
  totalLsoaCount?: number;
  rawData?: Record<string, any> | null;
  selectedLsoaCodes?: Set<string>;
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
}: DemographicsResultsProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('population');

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

  // Process aggregated data for the selected category
  const categoryData = useMemo(() => {
    if (!rawData) return null;

    // Data is now pre-aggregated from the server
    const aggregatedData = rawData['aggregated'];
    if (!aggregatedData) return null;

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
        }))
        .sort((a, b) => b.value - a.value);
    };

    const getTotalPopulation = (): number => {
      return aggregatedData.population_total || 0;
    };

    const getTotalHouseholds = (): number => {
      return aggregatedData.households_total || 0;
    };

    switch (selectedCategory) {
      case 'population':
        return {
          charts: [
            { title: 'Population (total)', data: [{ label: 'Total Population', value: getTotalPopulation(), percentage: 100 }] },
            { title: 'Number of households', data: [{ label: 'Total Households', value: getTotalHouseholds(), percentage: 100 }] },
            { title: 'Household composition', data: aggregateData('household_composition') },
            { title: 'Type of accommodation', data: aggregateData('accommodation_type') },
            { title: 'Tenure', data: aggregateData('tenure') },
          ],
        };
      case 'demographics':
        return {
          charts: [
            { title: 'Age profile', data: aggregateData('age_groups') },
            { title: 'Ethnic group', data: aggregateData('ethnicity') },
            { title: 'Country of birth', data: aggregateData('country_of_birth') },
            { title: 'Religion', data: aggregateData('religion') },
          ],
        };
      case 'employment':
        return {
          charts: [
            { title: 'Economic activity', data: aggregateData('economic_activity') },
            { title: 'Occupation', data: aggregateData('occupation') },
          ],
        };
      case 'education':
        return {
          charts: [
            { title: 'Highest level of qualification', data: aggregateData('qualifications') },
          ],
        };
      case 'mobility':
        return {
          charts: [
            { title: 'Method of travel to work', data: aggregateData('travel_to_work') },
            { title: 'Distance travelled to work', data: aggregateData('distance_to_work') },
          ],
        };
      case 'health':
        return {
          charts: [
            { title: 'General health', data: aggregateData('general_health') },
            { title: 'Disability', data: aggregateData('disability') },
          ],
        };
      case 'affluence':
        if (!aggregatedData.affluence) {
          return {
            charts: [
              { title: 'Affluence Score', data: [{ label: 'No data available', value: 0, percentage: 0 }] },
            ],
          };
        }
        return {
          charts: [
            {
              title: 'Affluence Score',
              data: [
                {
                  label: `Category ${aggregatedData.affluence.calculated_category} (${aggregatedData.affluence.avg_raw_score.toFixed(1)})`,
                  value: aggregatedData.affluence.avg_raw_score,
                  percentage: 100,
                },
              ],
            },
          ],
        };
    }
  }, [rawData, selectedCategory]);

  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  // Empty State
  if (!loading && !rawData && !error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md px-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center">
            <Users className="h-12 w-12 text-violet-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            No Demographics Data Yet
          </h3>
          <p className="text-gray-500 leading-relaxed">
            Select a location and click "Analyze" to view population data,
            household information, age profiles, and more.
          </p>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-100 rounded-lg w-1/3" />
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl" />
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
          <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
            <AlertCircle className="h-12 w-12 text-red-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Error Loading Data
          </h3>
          <p className="text-gray-500 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  // Results State
  if (!rawData) return null;

  const selectedCount = selectedLsoaCodes?.size || 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="sticky top-0 bg-white pb-6 z-10 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Demographics Report</h2>
          {location && (
            <p className="text-sm text-gray-500">
              {formatLocationDisplay(location)} • {getMeasurementDisplay()} •{' '}
              {totalLsoaCount && totalLsoaCount > selectedCount ? (
                <>
                  <span className="font-medium text-violet-600">
                    {selectedCount} of {totalLsoaCount} areas
                  </span>
                  {' '}selected
                </>
              ) : (
                <span>{selectedCount} areas analyzed</span>
              )}
            </p>
          )}
        </div>

        {/* Category Selector */}
        <div>
          <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Category
          </label>
          <select
            id="category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as CategoryType)}
            className="block w-full max-w-md px-4 py-2.5 text-base border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
          >
            {CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-8">
        {categoryData?.charts.map((chart, index) => (
          <div key={index} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-gray-900 text-lg mb-6">{chart.title}</h3>

            {chart.data.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No data available</div>
            ) : chart.data.length === 1 && chart.data[0].label.includes('Total') ? (
              // Special display for totals
              <div className="text-center py-4">
                <p className="text-5xl font-bold text-gray-900 mb-2">
                  {formatNumber(chart.data[0].value)}
                </p>
                <p className="text-sm text-gray-500">{chart.data[0].label}</p>
              </div>
            ) : (
              // Bar chart for other data
              <div className="space-y-3">
                {chart.data.slice(0, 15).map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate flex-1 mr-4">{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-xs">{formatNumber(item.value)}</span>
                        <span className="font-medium text-gray-900 w-12 text-right">
                          {formatPercentage(item.percentage)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {chart.data.length > 15 && (
                  <p className="text-sm text-gray-500 mt-4 text-center">
                    Showing top 15 of {chart.data.length} items
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
