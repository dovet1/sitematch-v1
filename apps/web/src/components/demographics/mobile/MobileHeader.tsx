'use client';

import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import type { LocationResult } from '@/lib/mapbox';
import type { MeasurementMode } from '../shared/types/demographics.types';

interface MobileHeaderProps {
  selectedLocation: LocationResult | null;
  onSearchClick: () => void;
  measurementMode: MeasurementMode;
  measurementValue: number;
  onAnalyze: () => void;
  loading: boolean;
}

export function MobileHeader({
  selectedLocation,
  onSearchClick,
  measurementMode,
  measurementValue,
  onAnalyze,
  loading,
}: MobileHeaderProps) {
  const router = useRouter();

  const getModeLabel = () => {
    switch (measurementMode) {
      case 'distance':
        return `${measurementValue} mile${measurementValue !== 1 ? 's' : ''}`;
      case 'drive_time':
        return `${measurementValue} min drive`;
      case 'walk_time':
        return `${measurementValue} min walk`;
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 safe-area-inset-top">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/new-dashboard?tab=tools')}
          className="h-10 w-10 rounded-lg hover:bg-violet-50"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <h1 className="text-lg font-semibold text-gray-900">
          SiteAnalyser
        </h1>

        <div className="w-10" /> {/* Spacer for alignment */}
      </div>

      {/* Search Button */}
      <div className="px-4 pb-3">
        <button
          onClick={onSearchClick}
          className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl text-left flex items-center gap-3 active:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className={selectedLocation ? "text-gray-900 font-medium" : "text-gray-400"}>
            {selectedLocation
              ? `${selectedLocation.text}${selectedLocation.place_name ? `, ${selectedLocation.place_name.split(',')[1]?.trim() || ''}` : ''}`
              : 'Search an England or Wales location...'
            }
          </span>
        </button>
      </div>

      {/* Mode & Value Display (when location selected) */}
      {selectedLocation && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-violet-50 border border-violet-100 rounded-lg text-center">
              <div className="text-xs text-violet-600 font-medium">
                {getModeLabel()}
              </div>
            </div>

            <Button
              onClick={onAnalyze}
              disabled={loading}
              className="h-10 px-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md active:scale-95 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  <span>Analyse</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
