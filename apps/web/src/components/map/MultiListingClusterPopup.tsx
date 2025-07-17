'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Building2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchResult } from '@/types/search';
import { cn } from '@/lib/utils';
import { getSearchResultLogoUrl } from '@/lib/search-logo-utils';

interface MultiListingClusterPopupProps {
  listings: SearchResult[];
  isOpen: boolean;
  onClose: () => void;
  onListingClick: (listingId: string) => void;
  position: { x: number; y: number };
}

export function MultiListingClusterPopup({
  listings,
  isOpen,
  onClose,
  onListingClick,
  position
}: MultiListingClusterPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  const handleListingClick = (listingId: string) => {
    handleClose();
    onListingClick(listingId);
  };

  const getInitials = (companyName: string): string => {
    return companyName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };


  if (!isOpen) return null;

  return (
    <>
      {/* Mobile: Full screen modal with backdrop */}
      <div className="md:hidden fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm">
        <div className="fixed inset-0 flex items-end">
          <div
            ref={popupRef}
            className={cn(
              "w-full bg-white rounded-t-2xl shadow-2xl transition-transform duration-200 ease-out flex flex-col",
              isClosing ? "translate-y-full" : "translate-y-0"
            )}
            style={{ maxHeight: '80vh' }}
          >
            {/* Mobile header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-semibold">
                    {listings.length} Properties at this location
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-8 w-8 p-0 hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {/* Drag handle */}
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Mobile content */}
            <div className="cluster-popup-mobile overflow-y-auto p-4 space-y-2 pb-6 flex-1 min-h-0">
              {listings.map((listing) => (
                <div
                  key={listing.id}
                  className="listing-card bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-primary-300 transition-colors cursor-pointer"
                  onClick={() => handleListingClick(listing.id)}
                >
                  <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                      {getSearchResultLogoUrl(listing) ? (
                        <img
                          src={getSearchResultLogoUrl(listing)!}
                          alt={`${listing.company_name} logo`}
                          className="w-6 h-6 object-contain"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling;
                            if (placeholder) {
                              placeholder.classList.remove('hidden');
                            }
                          }}
                        />
                      ) : null}
                      <div className={cn(
                        "w-6 h-6 bg-primary-100 text-primary-600 rounded text-xs font-semibold",
                        "flex items-center justify-center leading-none",
                        getSearchResultLogoUrl(listing) ? "hidden" : ""
                      )}>
                        {getInitials(listing.company_name)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {listing.company_name}
                      </h3>
                      <p className="text-sm text-gray-600 truncate">
                        {listing.title}
                      </p>
                    </div>

                    {/* Arrow icon */}
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Positioned popup next to marker */}
      <div className="hidden md:block">
        <div
          ref={popupRef}
          className={cn(
            "cluster-popup-desktop fixed bg-white rounded-lg shadow-xl border border-gray-200 transition-all duration-200 ease-out flex flex-col",
            isClosing ? "opacity-0 scale-95" : "opacity-100 scale-100"
          )}
          style={{
            left: `${Math.min(position.x + 10, window.innerWidth - 340)}px`,
            top: `${Math.min(Math.max(position.y - 100, 10), window.innerHeight - 420)}px`,
            width: '320px',
            maxHeight: '400px',
            zIndex: 9999
          }}
        >
          {/* Desktop header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 py-2 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold">
                  {listings.length} Properties
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-6 w-6 p-0 hover:bg-gray-100"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Desktop content */}
          <div className="overflow-y-auto p-2 space-y-1.5 flex-1 min-h-0">
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="listing-card bg-gray-50 rounded-md p-2.5 border border-gray-200 hover:border-primary-300 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => handleListingClick(listing.id)}
              >
                <div className="flex items-center gap-2.5">
                  {/* Logo */}
                  <div className="w-8 h-8 rounded-md bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                    {getSearchResultLogoUrl(listing) ? (
                      <img
                        src={getSearchResultLogoUrl(listing)!}
                        alt={`${listing.company_name} logo`}
                        className="w-5 h-5 object-contain"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.nextElementSibling;
                          if (placeholder) {
                            placeholder.classList.remove('hidden');
                          }
                        }}
                      />
                    ) : null}
                    <div className={cn(
                      "w-5 h-5 bg-primary-100 text-primary-600 rounded text-xs font-semibold",
                      "flex items-center justify-center leading-none",
                      getSearchResultLogoUrl(listing) ? "hidden" : ""
                    )}>
                      {getInitials(listing.company_name)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-gray-900 truncate">
                      {listing.company_name}
                    </h3>
                    <p className="text-xs text-gray-600 truncate">
                      {listing.title}
                    </p>
                  </div>

                  {/* Arrow icon */}
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}