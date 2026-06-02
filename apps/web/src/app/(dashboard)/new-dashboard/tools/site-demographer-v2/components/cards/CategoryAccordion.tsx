'use client';

import { ChevronDown } from 'lucide-react';
import { BlurOverlay } from '@/components/demographics/BlurOverlay';

interface ChartData {
  label: string;
  value: number;
  percentage: number;
  nationalAverage?: number;
}

interface Chart {
  title: string;
  data: ChartData[];
}

interface CategoryData {
  charts: Chart[];
}

interface Category {
  value: string;
  label: string;
  icon: any;
  color: string;
}

interface CategoryAccordionProps {
  category: Category;
  categoryData: CategoryData;
  isExpanded: boolean;
  onToggle: () => void;
  shouldBlur: boolean;
  onUpgradeClick: () => void;
  nationalAverages: Record<string, number>;
}

export function CategoryAccordion({
  category,
  categoryData,
  isExpanded,
  onToggle,
  shouldBlur,
  onUpgradeClick,
  nationalAverages,
}: CategoryAccordionProps) {
  const Icon = category.icon;
  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  const renderChartContent = (chart: Chart, index: number) => {
    return (
      <div key={index}>
        <div className="flex items-center gap-1.5 mb-2">
          <h4 className="text-xs font-semibold text-sm-ink/70">{chart.title}</h4>
        </div>

        {chart.data.length === 0 ? (
          <div className="text-center py-2 text-xs text-sm-ink/40">No data</div>
        ) : chart.data.length === 1 && chart.data[0].label.includes('Total') ? (
          // Special display for totals
          <div className="text-center py-2">
            <p className="text-2xl font-bold text-sm-ink">
              {formatNumber(chart.data[0].value)}
            </p>
            <p className="text-[10px] text-sm-ink/60 mt-0.5">{chart.data[0].label}</p>
          </div>
        ) : (
          // Ultra-compact table layout
          <div className="space-y-1.5">
            {/* Column headers */}
            <div className="flex items-center gap-2 text-xs pb-1 border-b border-sm-border">
              <div className="flex-1 text-[9px] uppercase tracking-wide text-sm-ink/60 font-medium">
                Category
              </div>
              <div className="w-12 text-right text-[9px] uppercase tracking-wide text-sm-ink/60 font-medium">
                Count
              </div>
              <div className="w-10 text-right text-[9px] uppercase tracking-wide text-sm-ink/60 font-medium">
                %
              </div>
              <div className="w-14 text-right text-[9px] uppercase tracking-wide text-sm-ink/60 font-medium">
                vs UK
              </div>
            </div>

            {/* Show all items for Age profile, limit to 10 for others */}
            {(chart.title === 'Age profile' ? chart.data : chart.data.slice(0, 10)).map((item: ChartData, idx) => {
              const natAvg = item.nationalAverage ?? 0;
              const showNationalComparison = item.nationalAverage !== undefined && item.nationalAverage > 0;

              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <div className="flex-1 text-sm-ink/70 text-[11px]" title={item.label}>
                    {item.label}
                  </div>
                  <div className="w-12 text-right font-medium text-sm-ink text-[11px]">
                    {formatNumber(item.value)}
                  </div>
                  <div className="w-10 text-right text-sm-ink/60 text-[11px]">
                    {formatPercentage(item.percentage)}
                  </div>
                  {showNationalComparison && (
                    <div
                      className={`w-14 text-right text-[10px] font-medium tabular-nums ${
                        item.percentage > natAvg + 0.5
                          ? 'text-emerald-600'
                          : item.percentage < natAvg - 0.5
                            ? 'text-rose-600'
                            : 'text-sm-ink/40'
                      }`}
                      title={`${item.percentage > natAvg ? 'Above' : item.percentage < natAvg ? 'Below' : 'At'} UK average by ${Math.abs(item.percentage - natAvg).toFixed(1)}%`}
                    >
                      {item.percentage > natAvg + 0.5 ? (
                        <>↑ {(item.percentage - natAvg).toFixed(1)}%</>
                      ) : item.percentage < natAvg - 0.5 ? (
                        <>↓ {(natAvg - item.percentage).toFixed(1)}%</>
                      ) : (
                        <>0%</>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {chart.title !== 'Age profile' && chart.data.length > 10 && (
              <p className="text-[10px] text-sm-ink/40 mt-2 text-center">
                +{chart.data.length - 10} more
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-sm-border rounded-lg overflow-hidden bg-sm-surface">
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-sm-bg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-sm-ink/60" />
          <span className="font-medium text-sm text-sm-ink">{category.label}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-sm-ink/40 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Content - Collapsible */}
      {isExpanded && (
        <div className="border-t border-sm-border bg-sm-bg">
          {shouldBlur ? (
            <BlurOverlay onUpgradeClick={onUpgradeClick} title="Detailed Demographics">
              <div className="px-4 py-3 space-y-4">
                {categoryData.charts.map((chart, index) => renderChartContent(chart, index))}
              </div>
            </BlurOverlay>
          ) : (
            <div className="px-4 py-3 space-y-4">
              {categoryData.charts.map((chart, index) => renderChartContent(chart, index))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
