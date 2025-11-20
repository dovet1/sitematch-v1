'use client';

import { X, ChevronDown, Users, Home, Briefcase, GraduationCap, Car, Heart, TrendingUp } from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileFullReportProps {
  open: boolean;
  onClose: () => void;
  rawData: Record<string, any> | null;
  location: string;
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

// Helper functions for category styling (Tailwind doesn't support dynamic class names)
function getCategoryIconClasses(color: string): string {
  const classes = {
    violet: 'w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center',
    blue: 'w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center',
    green: 'w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center',
    indigo: 'w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center',
    cyan: 'w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center',
    rose: 'w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center',
    emerald: 'w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center',
  };
  return classes[color as keyof typeof classes] || classes.violet;
}

function getCategoryIconColorClasses(color: string): string {
  const classes = {
    violet: 'w-5 h-5 text-violet-600',
    blue: 'w-5 h-5 text-blue-600',
    green: 'w-5 h-5 text-green-600',
    indigo: 'w-5 h-5 text-indigo-600',
    cyan: 'w-5 h-5 text-cyan-600',
    rose: 'w-5 h-5 text-rose-600',
    emerald: 'w-5 h-5 text-emerald-600',
  };
  return classes[color as keyof typeof classes] || classes.violet;
}

export function MobileFullReport({ open, onClose, rawData, location }: MobileFullReportProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryType>>(
    new Set<CategoryType>(['population', 'affluence'])
  );

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

  const allCategoryData = useMemo(() => {
    if (!rawData) return null;

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
        .sort((a, b) => b.value - a.value)
        .filter(item => item.value > 0); // Only show non-zero items
    };

    const getTotalPopulation = (): number => aggregatedData.population_total || 0;
    const getTotalHouseholds = (): number => aggregatedData.households_total || 0;
    const getAffluenceScore = (): number => aggregatedData.affluence?.avg_raw_score || 0;

    return {
      population: {
        charts: [
          { title: 'Population (total)', data: [{ label: 'Total Population', value: getTotalPopulation(), percentage: 100 }] },
          { title: 'Number of households', data: [{ label: 'Total Households', value: getTotalHouseholds(), percentage: 100 }] },
          { title: 'Household composition', data: aggregateData('household_composition') },
          { title: 'Type of accommodation', data: aggregateData('accommodation_type') },
          { title: 'Tenure', data: aggregateData('tenure') },
        ],
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
  }, [rawData]);

  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="absolute inset-0 bg-white overflow-y-auto overscroll-contain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Demographics Report</h2>
                <p className="text-sm text-gray-500">{location}</p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                aria-label="Close report"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="pb-8">
            {!allCategoryData ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500">No data available</p>
              </div>
            ) : (
              <div className="space-y-1">
                {CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const isExpanded = expandedCategories.has(category.value);
                  const categoryData = allCategoryData[category.value];

                  return (
                    <div key={category.value} className="border-b border-gray-100">
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category.value)}
                        className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={getCategoryIconClasses(category.color)}>
                            <Icon className={getCategoryIconColorClasses(category.color)} />
                          </div>
                          <span className="font-medium text-gray-900">{category.label}</span>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Category Content */}
                      <AnimatePresence>
                        {isExpanded && categoryData && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-4">
                              {categoryData.charts.map((chart: any, idx: number) => (
                                <div key={idx} className="bg-gray-50 rounded-xl p-4">
                                  <h4 className="text-sm font-medium text-gray-700 mb-3">{chart.title}</h4>
                                  <div className="space-y-2">
                                    {chart.data.slice(0, 8).map((item: ChartData, itemIdx: number) => (
                                      <div key={itemIdx} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600 truncate flex-1 pr-2">
                                          {item.label}
                                        </span>
                                        <span className="font-medium text-gray-900 whitespace-nowrap">
                                          {item.percentage < 100
                                            ? formatPercentage(item.percentage)
                                            : formatNumber(item.value)}
                                        </span>
                                      </div>
                                    ))}
                                    {chart.data.length > 8 && (
                                      <p className="text-xs text-gray-500 pt-1">
                                        +{chart.data.length - 8} more items
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
