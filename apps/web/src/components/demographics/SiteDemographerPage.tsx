'use client';

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocationInputPanel } from './LocationInputPanel';
import { DemographicsResults } from './DemographicsResults';
import { DemographicsMap } from './DemographicsMap';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LocationResult } from '@/lib/mapbox';
import type { DemographicsResult } from '@/lib/types/demographics';

export function SiteDemographerPage() {
  const router = useRouter();
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [radius, setRadius] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DemographicsResult | null>(null);
  const [lsoaBoundaries, setLsoaBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);

  const handleAnalyze = async () => {
    if (!selectedLocation) return;

    setLoading(true);
    setError(null);

    try {
      const [lng, lat] = selectedLocation.center;

      // Fetch all data in parallel
      const [geoResponse, boundariesResponse] = await Promise.all([
        // Step 1: Get geography codes
        fetch('/api/demographics/geography', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, radius_miles: radius }),
        }),
        // Step 2: Get LSOA boundaries for map
        fetch('/api/demographics/boundaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, radius_miles: radius }),
        }),
      ]);

      if (!geoResponse.ok) {
        throw new Error('Failed to resolve geographic areas');
      }

      const geoData = await geoResponse.json();
      const boundaries = await boundariesResponse.json();

      // Step 3: Get demographics data
      const dataResponse = await fetch('/api/demographics/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geography_codes: geoData.geography_codes,
        }),
      });

      if (!dataResponse.ok) {
        throw new Error('Failed to fetch demographics data');
      }

      const demographicsData = await dataResponse.json();
      setResults(demographicsData);
      setLsoaBoundaries(boundaries);
    } catch (err) {
      console.error('Error analyzing demographics:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedLocation(null);
    setRadius(10);
    setResults(null);
    setLsoaBoundaries(null);
    setError(null);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Consolidated Header with Controls */}
      <div className="px-8 py-5 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-6">
          {/* Left: Title */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/new-dashboard?tab=tools')}
              className="h-9 w-9 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SiteDemographer</h1>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex-1 max-w-4xl">
            <LocationInputPanel
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
              radius={radius}
              onRadiusChange={setRadius}
              onAnalyze={handleAnalyze}
              onReset={handleReset}
              loading={loading}
              hasResults={!!results}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Results */}
        <div className="flex-1 p-10 overflow-y-auto bg-white">
          <DemographicsResults
            results={results}
            loading={loading}
            error={error}
            location={selectedLocation}
            radius={radius}
          />
        </div>

        {/* Right Panel - Map */}
        <div className="flex-1 bg-gray-50 border-l border-gray-200 relative">
          {selectedLocation ? (
            <DemographicsMap
              center={{ lat: selectedLocation.center[1], lng: selectedLocation.center[0] }}
              radiusMiles={radius}
              lsoaBoundaries={lsoaBoundaries}
              loading={loading}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm px-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <p className="text-base font-medium text-gray-900 mb-2">Ready to analyze</p>
                <p className="text-sm text-gray-500">Enter a UK location above to view demographic insights and geographic coverage</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
