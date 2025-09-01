'use client';

import { Popup } from 'react-map-gl/mapbox';
import { Building2, MapPin, X } from 'lucide-react';
import { MapCluster } from '@/hooks/useMapClustering';
import { AgencyMapData } from '@/components/agencies/AgencyMapSimple';
import Image from 'next/image';

interface MultiAgencyClusterPopupProps {
  cluster: MapCluster<AgencyMapData>;
  coordinates: { lat: number; lng: number };
  onAgencyClick: (agencyId: string) => void;
  onClose: () => void;
}

export function MultiAgencyClusterPopup({ 
  cluster, 
  coordinates, 
  onAgencyClick, 
  onClose 
}: MultiAgencyClusterPopupProps) {
  const getClassificationBadgeColor = (classification?: string) => {
    switch (classification) {
      case 'Commercial':
        return 'bg-primary-100 text-primary-800';
      case 'Residential':
        return 'bg-emerald-100 text-emerald-800';
      case 'Both':
        return 'bg-violet-100 text-violet-800';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <Popup
      longitude={coordinates.lng}
      latitude={coordinates.lat}
      closeButton={false}
      closeOnClick={false}
      anchor="bottom"
      offset={[0, -10]}
      className="agency-cluster-popup"
    >
      <div className="bg-white rounded-lg shadow-xl border border-slate-200 p-4 max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900">
            {cluster.agencies?.length || 0} Agencies
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* Agency list */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {(cluster.agencies || []).map((agency) => (
            <div
              key={agency.id}
              onClick={() => onAgencyClick(agency.id)}
              className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer group transition-colors"
            >
              {/* Logo */}
              {agency.logo_url ? (
                <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg p-1 flex-shrink-0">
                  <Image
                    src={agency.logo_url}
                    alt={`${agency.name} logo`}
                    width={32}
                    height={32}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-slate-500" />
                </div>
              )}

              {/* Agency info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-slate-900 group-hover:text-primary-700 transition-colors text-sm leading-tight">
                  {agency.name}
                </h4>
                
                {/* Classification badge */}
                {agency.classification && (
                  <div className="mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getClassificationBadgeColor(agency.classification)}`}>
                      {agency.classification === 'Both' 
                        ? 'Commercial & Residential'
                        : agency.classification
                      }
                    </span>
                  </div>
                )}
                
                {/* Address */}
                {agency.office_address && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-500 truncate">
                      {agency.office_address}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Popup>
  );
}