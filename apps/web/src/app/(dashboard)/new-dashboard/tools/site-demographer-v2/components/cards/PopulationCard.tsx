'use client';

import { Users, Home } from 'lucide-react';

interface PopulationCardProps {
  totalPopulation: number;
  totalHouseholds: number;
}

export function PopulationCard({ totalPopulation, totalHouseholds }: PopulationCardProps) {
  const formatNumber = (num: number) => num.toLocaleString();

  return (
    <div className="space-y-3">
      <div className="bg-sm-surface border border-sm-border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-sm-violet/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-sm-violet" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-sm-ink/60 font-medium">
              Population
            </div>
            <div className="text-base font-bold text-sm-ink truncate">
              {formatNumber(totalPopulation)}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-sm-surface border border-sm-border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-sm-violet/10 flex items-center justify-center">
            <Home className="w-4 h-4 text-sm-violet" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-sm-ink/60 font-medium">
              Households
            </div>
            <div className="text-base font-bold text-sm-ink truncate">
              {formatNumber(totalHouseholds)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
