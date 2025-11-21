'use client';

import { useState, useEffect } from 'react';
import { FileText, PenLine, Check, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { BrochureFormData } from '@/types/brochure';

interface Listing {
  id: string;
  company_name: string;
  created_at: string;
}

interface DataSourceStepProps {
  formData: BrochureFormData;
  onFormDataChange: (data: Partial<BrochureFormData>) => void;
}

export function DataSourceStep({ formData, onFormDataChange }: DataSourceStepProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);

  // Fetch user's listings when they select 'listing' source
  useEffect(() => {
    if (formData.sourceType === 'listing' && listings.length === 0) {
      fetchListings();
    }
  }, [formData.sourceType]);

  const fetchListings = async () => {
    setLoadingListings(true);
    try {
      const response = await fetch('/api/listings/mine');
      if (response.ok) {
        const data = await response.json();
        setListings(data.listings || []);
      }
    } catch (error) {
      console.error('Failed to fetch listings:', error);
    } finally {
      setLoadingListings(false);
    }
  };

  const sourceOptions = [
    {
      value: 'listing' as const,
      label: 'From existing listing',
      description: 'Pre-fill from one of your saved listings',
      icon: FileText,
    },
    {
      value: 'scratch' as const,
      label: 'Start from scratch',
      description: 'Enter all details manually',
      icon: PenLine,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Choose Data Source</h2>
        <p className="text-sm text-gray-500 mt-1">
          Start with an existing listing or create a brochure from scratch
        </p>
      </div>

      <div className="space-y-3">
        {sourceOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = formData.sourceType === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFormDataChange({ sourceType: option.value, listingId: undefined })}
              className={cn(
                'relative flex w-full cursor-pointer rounded-lg border px-4 py-4 focus:outline-none transition-all text-left',
                isSelected
                  ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      isSelected ? 'bg-violet-100' : 'bg-gray-100'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isSelected ? 'text-violet-600' : 'text-gray-500')} />
                  </div>
                  <div>
                    <p className={cn('text-sm font-medium', isSelected ? 'text-violet-900' : 'text-gray-900')}>
                      {option.label}
                    </p>
                    <p className="text-xs text-gray-500">{option.description}</p>
                  </div>
                </div>
                {isSelected && <Check className="h-5 w-5 text-violet-600" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Listing selector */}
      {formData.sourceType === 'listing' && (
        <div className="space-y-3 pt-2">
          <Label className="text-sm font-medium text-gray-700">Select a listing</Label>

          {loadingListings ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading your listings...</span>
            </div>
          ) : listings.length === 0 ? (
            <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-lg">
              No listings found. Create a listing first or start from scratch.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {listings.map((listing) => {
                const isSelected = formData.listingId === listing.id;
                return (
                  <button
                    key={listing.id}
                    type="button"
                    onClick={() => onFormDataChange({ listingId: listing.id })}
                    className={cn(
                      'relative flex w-full cursor-pointer rounded-lg border px-4 py-3 focus:outline-none transition-all text-left',
                      isSelected
                        ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div>
                        <p className={cn('text-sm font-medium', isSelected ? 'text-violet-900' : 'text-gray-900')}>
                          {listing.company_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created {new Date(listing.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-violet-600" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
