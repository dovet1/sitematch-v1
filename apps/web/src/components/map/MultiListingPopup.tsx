'use client';

import { useState } from 'react';
import { MapPin, Building2, Users, Square, X, Mail, Phone, ExternalLink } from 'lucide-react';
import { SearchResult } from '@/types/search';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MapCluster } from '@/hooks/useMapClustering';

interface MultiListingPopupProps {
  cluster: MapCluster;
  onListingClick: (listingId: string) => void;
  onClose: () => void;
}

export function MultiListingPopup({ cluster, onListingClick, onClose }: MultiListingPopupProps) {
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set());
  
  const isSingle = cluster.type === 'single';
  const listings = cluster.listings;
  const firstListing = listings[0];

  const toggleSelection = (listingId: string) => {
    const newSelection = new Set(selectedListings);
    if (newSelection.has(listingId)) {
      newSelection.delete(listingId);
    } else {
      newSelection.add(listingId);
    }
    setSelectedListings(newSelection);
  };

  const selectAll = () => {
    setSelectedListings(new Set(listings.map(l => l.id)));
  };

  const deselectAll = () => {
    setSelectedListings(new Set());
  };

  const formatSizeRange = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Size not specified';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
    if (min) return `From ${min.toLocaleString()} sq ft`;
    if (max) return `Up to ${max.toLocaleString()} sq ft`;
    return '';
  };

  const handleContactAll = () => {
    const emails = Array.from(selectedListings)
      .map(id => listings.find(l => l.id === id)?.contact_email)
      .filter(Boolean)
      .join(',');
    
    if (emails) {
      window.location.href = `mailto:${emails}?subject=Property Enquiry - Multiple Listings`;
    }
  };

  if (isSingle) {
    const listing = firstListing;
    
    return (
      <div 
        className="w-80 max-w-[95vw] bg-white rounded-2xl border border-gray-200 overflow-hidden md:max-w-[320px] min-w-80"
        style={{
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Mobile drag handle for Story 8.0 */}
        <div 
          className="md:hidden absolute top-2 left-1/2 transform -translate-x-1/2 w-10 h-1 bg-gray-300 rounded-full"
          style={{ zIndex: 10 }}
        />
        
        {/* Header with Story 8.0 styling */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-5 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate mb-1">
                  {listing.company_name}
                </h3>
                <p className="text-sm text-gray-600 truncate">
                  {listing.place_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center md:p-1 md:min-w-auto md:min-h-auto"
              aria-label="Close popup"
            >
              <X className="w-5 h-5 text-gray-500 md:w-4 md:h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Details */}
          <div className="space-y-2 mb-4">
            {listing.place_name && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{listing.place_name}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm">
              <Square className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                {formatSizeRange(listing.site_size_min, listing.site_size_max)}
              </span>
            </div>

            {listing.contact_name && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  {listing.contact_name}
                  {listing.contact_title && `, ${listing.contact_title}`}
                </span>
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1 mb-4">
            {listing.sector && (
              <Badge variant="secondary" className="text-xs">
                {listing.sector}
              </Badge>
            )}
            {listing.use_class && (
              <Badge variant="outline" className="text-xs">
                {listing.use_class}
              </Badge>
            )}
            {listing.is_nationwide && (
              <Badge className="text-xs bg-primary-500 text-primary-foreground">
                Nationwide
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button 
              onClick={() => onListingClick(listing.id)}
              className="w-full h-11 md:h-9"
              size="sm"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Details
            </Button>
            
            {listing.contact_email && (
              <Button 
                variant="outline"
                size="sm"
                className="w-full h-11 md:h-9"
                onClick={() => window.location.href = `mailto:${listing.contact_email}?subject=Property Enquiry - ${listing.company_name}`}
              >
                <Mail className="w-4 h-4 mr-2" />
                Contact
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-[400px] max-w-[95vw] bg-white rounded-2xl border border-gray-200 overflow-hidden md:max-w-[400px] min-w-80"
      style={{
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.15)'
      }}
    >
      {/* Mobile drag handle for Story 8.0 */}
      <div 
        className="md:hidden absolute top-2 left-1/2 transform -translate-x-1/2 w-10 h-1 bg-gray-300 rounded-full"
        style={{ zIndex: 10 }}
      />
      
      {/* Header with Story 8.0 styling */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-5 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {cluster.count} Properties at this location
            </h3>
            {firstListing.place_name && (
              <p className="text-sm text-gray-600">{firstListing.place_name}</p>
            )}
            <div className="mt-2">
              <span className="inline-block bg-primary-500 text-white text-xs font-semibold px-3 py-1.5 rounded-xl">
                {cluster.count} listings
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center md:p-1 md:min-w-auto md:min-h-auto"
            aria-label="Close popup"
          >
            <X className="w-5 h-5 text-gray-500 md:w-4 md:h-4" />
          </button>
        </div>
      </div>

      {/* Listings with Story 8.0 styling */}
      <div className="max-h-[300px] overflow-y-auto">
        {listings.map((listing, index) => (
          <div 
            key={listing.id}
            className={`
              p-4 border-b border-gray-100 transition-colors hover:bg-slate-50
              ${selectedListings.has(listing.id) ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''}
              ${index === listings.length - 1 ? 'border-b-0' : ''}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 truncate text-base">
                    {listing.company_name}
                  </h4>
                  {listing.sector && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-medium">
                      {listing.sector}
                    </span>
                  )}
                </div>
                
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Square className="w-4 h-4" />
                    <span>{formatSizeRange(listing.site_size_min, listing.site_size_max)}</span>
                  </div>
                  
                  {/* Price information (placeholder for real implementation) */}
                  <div className="text-base font-bold text-green-600">
                    Price on application
                  </div>
                  
                  {listing.contact_name && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>{listing.contact_name}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    size="sm"
                    onClick={() => onListingClick(listing.id)}
                    className="flex-1 h-8 text-sm font-medium rounded-lg"
                  >
                    View Details
                  </Button>
                  
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newSelection = new Set(selectedListings);
                      if (newSelection.has(listing.id)) {
                        newSelection.delete(listing.id);
                      } else {
                        newSelection.add(listing.id);
                      }
                      setSelectedListings(newSelection);
                    }}
                    className={`h-8 px-4 text-sm font-medium rounded-lg border transition-all ${
                      selectedListings.has(listing.id) 
                        ? 'bg-primary-500 text-white border-primary-500 hover:bg-primary-600' 
                        : 'text-primary-500 border-primary-500 hover:bg-primary-50'
                    }`}
                  >
                    {selectedListings.has(listing.id) ? 'Selected' : 'Select'}
                  </Button>
                </div>
              </div>
              
              {/* Checkbox removed - now handled by Select button */}
            </div>
          </div>
        ))}
      </div>

      {/* Footer with Story 8.0 styling */}
      <div className="p-5 bg-slate-50 border-t border-gray-200">
        <div className="mb-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <Checkbox
              checked={selectedListings.size === listings.length}
              onCheckedChange={(checked) => {
                if (checked) {
                  selectAll();
                } else {
                  deselectAll();
                }
              }}
              className="w-4 h-4"
            />
            {selectedListings.size === 0 ? 'Select all' : 
             selectedListings.size === listings.length ? 'Deselect all' :
             `Select all (${selectedListings.size} selected)`}
          </label>
        </div>
        
        <div className="flex gap-2">
          <Button 
            size="sm"
            onClick={handleContactAll}
            className="flex-1 h-10 text-sm font-medium rounded-lg"
            disabled={selectedListings.size === 0 || !Array.from(selectedListings).some(id => 
              listings.find(l => l.id === id)?.contact_email
            )}
          >
            <Mail className="w-4 h-4 mr-2" />
            Contact All {selectedListings.size > 0 && `(${selectedListings.size})`}
          </Button>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => {
              // Save all functionality (placeholder)
              console.log('Save all selected listings:', Array.from(selectedListings));
            }}
            className="px-4 h-10 text-sm font-medium rounded-lg"
            disabled={selectedListings.size === 0}
          >
            Save All
          </Button>
          <Button 
            size="sm"
            variant="outline"
            onClick={() => {
              // Compare functionality (placeholder)
              console.log('Compare selected listings:', Array.from(selectedListings));
            }}
            className="px-4 h-10 text-sm font-medium rounded-lg"
            disabled={selectedListings.size < 2}
          >
            Compare
          </Button>
        </div>
      </div>
    </div>
  );
}