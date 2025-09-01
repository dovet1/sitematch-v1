'use client';

import { useState, useEffect, useMemo } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import '@/styles/map-mobile.css';
import { MapMarker } from '@/components/map/MapMarker';
import { MapLoadingSkeleton } from '@/components/map/MapLoadingSkeleton';

export interface AgencyMapData {
  id: string;
  name: string;
  classification?: 'Commercial' | 'Residential' | 'Both';
  geographic_patch?: string;
  logo_url?: string;
  office_coordinates?: {
    lat: number;
    lng: number;
  };
  office_address?: string;
}

interface AgencyMapProps {
  search?: string;
  classification?: string;
  onAgencyClick: (agencyId: string) => void;
}

interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// Default view showing whole UK
const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: -3.5,
  latitude: 54.8,
  zoom: 4.8
};

// Mapbox token must be provided via environment variables
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function AgencyMapSimple({ search, classification, onAgencyClick }: AgencyMapProps) {
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW_STATE);
  const [agencies, setAgencies] = useState<AgencyMapData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter agencies that have coordinates
  const mappableAgencies = useMemo(() => 
    agencies.filter(agency => agency.office_coordinates?.lat && agency.office_coordinates?.lng),
    [agencies]
  );

  // Fetch agencies when filters change
  useEffect(() => {
    async function fetchAgencies() {
      try {
        setLoading(true);
        
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (classification && classification !== 'all') params.set('classification', classification);
        
        const response = await fetch(`/api/agencies/map?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch agencies');
        
        const result = await response.json();
        const agencyData = result.data || [];
        
        setAgencies(agencyData);
      } catch (error) {
        console.error('Error fetching agencies:', error);
        setAgencies([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAgencies();
  }, [search, classification]);

  // Show loading skeleton while fetching data
  if (loading) {
    return <MapLoadingSkeleton />;
  }

  // Show error state if no token
  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Map unavailable</p>
          <p className="text-sm text-slate-500">Mapbox configuration required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        attributionControl={false}
      >
        {/* Render individual agency markers */}
        {mappableAgencies.map((agency) => (
          <Marker
            key={agency.id}
            longitude={agency.office_coordinates!.lng}
            latitude={agency.office_coordinates!.lat}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onAgencyClick(agency.id);
            }}
          >
            <MapMarker
              type="agency"
              count={1}
              isSelected={false}
              agency={agency}
            />
          </Marker>
        ))}
      </Map>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            <span className="text-slate-600 font-medium">Loading agencies...</span>
          </div>
        </div>
      )}
    </div>
  );
}