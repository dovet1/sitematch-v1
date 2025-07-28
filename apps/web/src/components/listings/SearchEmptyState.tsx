'use client';

import { SearchX, MapPin, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchFilters } from '@/types/search';

interface SearchEmptyStateProps {
  filters: SearchFilters;
  onBrowseAll: () => void;
  onClearFilters: () => void;
}

export function SearchEmptyState({ filters, onBrowseAll, onClearFilters }: SearchEmptyStateProps) {
  const hasLocation = filters.location && !filters.isNationwide;
  const hasFilters = filters.companyName || 
                    filters.sector.length > 0 || 
                    filters.useClass.length > 0 || 
                    filters.listingType.length > 0 ||
                    filters.sizeMin || filters.sizeMax ||
                    filters.acreageMin || filters.acreageMax ||
                    filters.dwellingMin || filters.dwellingMax;

  // Check if the location looks like gibberish (basic heuristic)
  const isLikelyInvalidLocation = hasLocation && 
    filters.location.length < 10 && 
    !/[aeiou]/i.test(filters.location) && 
    filters.location.length > 2;

  return (
    <div className="text-center py-16 px-4 max-w-md mx-auto">
      {/* Icon */}
      <div className="w-16 h-16 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
        <SearchX className="w-8 h-8 text-muted-foreground" />
      </div>

      {/* Main Message */}
      <h3 className="text-xl font-semibold text-foreground mb-3">
        {hasLocation ? (
          <>No requirements found{isLikelyInvalidLocation ? '' : ` in "${filters.location}"`}</>
        ) : (
          'No requirements found'
        )}
      </h3>

      {/* Context-specific sub-message */}
      <div className="text-muted-foreground mb-6 space-y-2">
        {isLikelyInvalidLocation ? (
          <p>
            We couldn't find any results for <strong>"{filters.location}"</strong>. 
            Please check your spelling or try a different location.
          </p>
        ) : hasLocation && hasFilters ? (
          <p>
            No requirements match your search criteria in <strong>{filters.location}</strong>.
            Try broadening your search or removing some filters.
          </p>
        ) : hasLocation ? (
          <p>
            No requirements are currently available in <strong>{filters.location}</strong>.
            Try searching in a nearby area or browse all listings.
          </p>
        ) : hasFilters ? (
          <p>
            No requirements match your current filters.
            Try adjusting your criteria or browse all listings.
          </p>
        ) : (
          <p>
            No requirements are currently available.
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Primary Action */}
        {hasLocation && !filters.isNationwide ? (
          <Button 
            onClick={onBrowseAll}
            className="w-full"
          >
            <Building className="w-4 h-4 mr-2" />
            Browse all listings nationwide
          </Button>
        ) : hasFilters ? (
          <Button 
            onClick={onClearFilters}
            className="w-full"
          >
            <SearchX className="w-4 h-4 mr-2" />
            Clear filters and search again
          </Button>
        ) : (
          <Button 
            onClick={onBrowseAll}
            className="w-full"
          >
            <Building className="w-4 h-4 mr-2" />
            Browse all listings
          </Button>
        )}

        {/* Secondary Actions */}
        {hasFilters && (
          <Button 
            variant="outline"
            onClick={onClearFilters}
            className="w-full"
          >
            Clear all filters
          </Button>
        )}
      </div>

      {/* Helpful Tips */}
      {(hasLocation && !isLikelyInvalidLocation) && (
        <div className="mt-8 p-4 bg-muted/50 rounded-lg text-left">
          <h4 className="font-medium text-sm text-foreground mb-2">Try searching for:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• A nearby city or town</li>
            <li>• A broader area (e.g., "London" instead of "SW1A 1AA")</li>
            <li>• A different region or county</li>
          </ul>
        </div>
      )}

      {isLikelyInvalidLocation && (
        <div className="mt-8 p-4 bg-muted/50 rounded-lg text-left">
          <h4 className="font-medium text-sm text-foreground mb-2">Search tips:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Check your spelling</li>
            <li>• Try a city or town name</li>
            <li>• Use a postcode or area name</li>
            <li>• Browse all listings to see what's available</li>
          </ul>
        </div>
      )}
    </div>
  );
}