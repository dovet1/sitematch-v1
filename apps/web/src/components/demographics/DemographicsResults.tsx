'use client';

import { Users, Home, Calendar, Globe, AlertCircle } from 'lucide-react';
import type { DemographicsResult } from '@/lib/types/demographics';
import type { LocationResult } from '@/lib/mapbox';
import { formatLocationDisplay } from '@/lib/mapbox';
import type { MeasurementMode } from './LocationInputPanel';

interface DemographicsResultsProps {
  results: DemographicsResult | null;
  loading: boolean;
  error: string | null;
  location: LocationResult | null;
  measurementMode: MeasurementMode;
  measurementValue: number;
  totalLsoaCount?: number;
}

export function DemographicsResults({
  results,
  loading,
  error,
  location,
  measurementMode,
  measurementValue,
  totalLsoaCount,
}: DemographicsResultsProps) {
  // Format display text based on mode
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
  // Empty State
  if (!loading && !results && !error) {
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
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl" />
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
  if (!results) return null;

  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="sticky top-0 bg-white pb-6 z-10">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Demographics Report</h2>
        {location && (
          <p className="text-sm text-gray-500">
            {formatLocationDisplay(location)} • {getMeasurementDisplay()} •{' '}
            {totalLsoaCount && totalLsoaCount > results.query_info.geography_codes.length ? (
              <>
                <span className="font-medium text-violet-600">
                  {results.query_info.geography_codes.length} of {totalLsoaCount} areas
                </span>
                {' '}selected
              </>
            ) : (
              <span>{results.query_info.geography_codes.length} areas analyzed</span>
            )}
          </p>
        )}
      </div>

      {/* Cards Stack */}
      <div className="space-y-6">
        {/* Population Card */}
        <div className="bg-gradient-to-br from-white to-violet-50/30 p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">Population</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-4xl font-bold text-gray-900">
                {formatNumber(results.population.total)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Total Population</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {formatPercentage(results.population.male_percentage)}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">Male</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {formatPercentage(results.population.female_percentage)}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">Female</p>
              </div>
            </div>
          </div>
        </div>

        {/* Households Card */}
        <div className="bg-gradient-to-br from-white to-blue-50/30 p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-sm">
              <Home className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">Households</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-4xl font-bold text-gray-900">
                {formatNumber(results.households.total)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Total Households</p>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-lg font-semibold text-gray-900">
                {results.households.average_size.toFixed(2)} people
              </p>
              <p className="text-sm text-gray-500 mt-0.5">Average Household Size</p>
            </div>
          </div>
        </div>

        {/* Age Profile Card */}
        <div className="bg-gradient-to-br from-white to-green-50/30 p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-sm">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">Age Profile</h3>
          </div>
          <div className="space-y-3">
            {results.age_profile.map((group) => (
              <div key={group.age_group} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-600 w-20">{group.age_group}</span>
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${group.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">
                    {formatPercentage(group.percentage)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Country of Birth Card */}
        <div className="bg-gradient-to-br from-white to-orange-50/30 p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-sm">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">Country of Birth</h3>
          </div>
          <div className="space-y-2.5">
            {results.country_of_birth.slice(0, 8).map((country) => (
              <div key={country.country} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-600 truncate flex-1">{country.country}</span>
                <span className="text-sm font-medium text-gray-900 ml-3">
                  {formatPercentage(country.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Household Size Card */}
        <div className="bg-gradient-to-br from-white to-purple-50/30 p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-fuchsia-600 rounded-xl shadow-sm">
              <Users className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">Household Size</h3>
          </div>
          <div className="space-y-2.5">
            {results.household_size.map((size) => (
              <div key={size.size} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-600 flex-1">{size.size}</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatPercentage(size.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Household Composition Card */}
        <div className="bg-gradient-to-br from-white to-pink-50/30 p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-sm">
              <Home className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">Household Composition</h3>
          </div>
          <div className="space-y-2.5">
            {results.household_composition.map((comp) => (
              <div key={comp.type} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-600 truncate flex-1">{comp.type}</span>
                <span className="text-sm font-medium text-gray-900 ml-3">
                  {formatPercentage(comp.percentage)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Household Deprivation Card */}
        <div className="bg-gradient-to-br from-white to-red-50/30 p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-sm">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-semibold text-gray-900 text-base">Household Deprivation</h3>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(results.household_deprivation.employment.percentage)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Employment</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(results.household_deprivation.education.percentage)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Education</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(results.household_deprivation.health.percentage)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Health</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(results.household_deprivation.housing.percentage)}
              </p>
              <p className="text-sm text-gray-500 mt-1">Housing</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
