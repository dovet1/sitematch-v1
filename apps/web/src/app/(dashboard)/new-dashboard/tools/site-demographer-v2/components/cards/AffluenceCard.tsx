'use client';

import { TrendingUp, Info } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface AffluenceCardProps {
  score: number;
  nationalAverages: Record<string, number>;
  onMethodologyClick: () => void;
}

export function AffluenceCard({ score, nationalAverages, onMethodologyClick }: AffluenceCardProps) {
  // Determine rating and color
  const getRating = (score: number) => {
    if (score >= 70) return { label: 'Very High', color: 'text-blue-600', bg: 'bg-blue-500', bgLight: 'bg-blue-50' };
    if (score >= 55) return { label: 'High', color: 'text-emerald-600', bg: 'bg-emerald-500', bgLight: 'bg-emerald-50' };
    if (score >= 45) return { label: 'Medium', color: 'text-amber-600', bg: 'bg-amber-500', bgLight: 'bg-amber-50' };
    return { label: 'Low', color: 'text-rose-600', bg: 'bg-rose-500', bgLight: 'bg-rose-50' };
  };

  const rating = getRating(score);

  return (
    <div className="bg-sm-surface border border-sm-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-sm-ink/60" />
          <span className="text-[10px] uppercase tracking-wide text-sm-ink/60 font-medium">
            Affluence Score
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="inline-flex items-center justify-center rounded-full hover:bg-sm-bg transition-colors p-0.5"
                aria-label="Learn about affluence score calculation"
              >
                <Info className="w-3 h-3 text-sm-ink/40 hover:text-sm-ink/60" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">
                    How is this calculated?
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    The Affluence Score combines Census 2021 socioeconomic measures (70%) with household income data (30%) to create a single score from 0–100 (50 being the median).
                  </p>
                </div>
                <button
                  onClick={onMethodologyClick}
                  className="text-xs font-medium text-sm-violet hover:text-sm-violet/80 underline-offset-2 hover:underline"
                >
                  Learn more about the methodology →
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <span className={`text-xs font-medium ${rating.color}`}>
          {rating.label}
        </span>
      </div>

      {/* Score Display with Gauge */}
      <div className="space-y-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-sm-ink">{score.toFixed(1)}</span>
          <span className="text-sm text-sm-ink/60">/100</span>
        </div>

        {/* Gauge Visualization */}
        <div className="space-y-1">
          <div className="relative h-2 bg-sm-border rounded-full overflow-hidden">
            {/* Progress bar */}
            <div
              className={`h-full ${rating.bg} rounded-full transition-all`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>

          {/* Scale labels */}
          <div className="flex justify-between text-[9px] text-sm-ink/40 px-0.5">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>
    </div>
  );
}
