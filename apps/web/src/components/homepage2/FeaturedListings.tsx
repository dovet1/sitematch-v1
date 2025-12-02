'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { useAuth } from '@/contexts/auth-context';
import { ListingModal } from '@/components/listings/ListingModal';

interface Listing {
  id: string;
  company_name: string;
  title: string;
  description?: string;
  site_size_min?: number;
  site_size_max?: number;
  listing_type: string;
  sectors?: Array<{ name: string }>;
  place_name?: string;
  logo_url?: string;
  clearbit_logo?: boolean;
  company_domain?: string;
}

export function FeaturedListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeaturedListings = async () => {
      try {
        // Fetch listings - API will automatically filter to is_featured_free for non-authenticated users
        const response = await fetch('/api/public/listings?limit=8');
        const data = await response.json();
        setListings(data.results || []);
      } catch (error) {
        console.error('Error fetching featured listings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedListings();
  }, []);

  const formatSizeRange = (min?: number, max?: number) => {
    if (!min && !max) return null;
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
    if (min) return `${min.toLocaleString()}+ sq ft`;
    if (max) return `Up to ${max.toLocaleString()} sq ft`;
    return null;
  };

  const getLogoUrl = (listing: Listing) => {
    if (listing.logo_url) {
      return listing.logo_url;
    }
    if (listing.clearbit_logo && listing.company_domain) {
      return `https://logo.clearbit.com/${listing.company_domain}`;
    }
    return null;
  };

  const getCompanyInitials = (companyName: string) => {
    return companyName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Featured Property Requirements
            </h2>
            <p className="text-xl text-gray-600">
              See what companies are actively looking for
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-100 rounded-xl h-64 animate-pulse"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (listings.length === 0) {
    return null;
  }

  return (
    <section className="py-24 bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 rounded-full border border-violet-200 mb-4">
            <Building2 className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-violet-700">Live Requirements</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Featured Property Requirements
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Companies actively seeking their next location. See which opportunities match your portfolio.
          </p>
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {listings.map((listing) => {
            const logoUrl = getLogoUrl(listing);
            const sizeRange = formatSizeRange(listing.site_size_min, listing.site_size_max);
            const primarySector = listing.sectors?.[0]?.name;

            return (
              <button
                key={listing.id}
                onClick={() => setSelectedListingId(listing.id)}
                className="group bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-violet-300 hover:shadow-xl transition-all duration-300 text-left w-full"
              >
                {/* Logo/Company */}
                <div className="flex items-center gap-3 mb-4">
                  {logoUrl ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <img
                        src={logoUrl}
                        alt={listing.company_name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-sm">${getCompanyInitials(listing.company_name)}</div>`;
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {getCompanyInitials(listing.company_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 text-sm truncate">
                      {listing.company_name}
                    </h3>
                    {primarySector && (
                      <p className="text-xs text-gray-500 truncate">{primarySector}</p>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h4 className="font-semibold text-gray-900 mb-3 line-clamp-2 min-h-[3rem]">
                  {listing.title}
                </h4>

                {/* Details */}
                <div className="space-y-2 text-sm text-gray-600">
                  {listing.place_name && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                      <span className="line-clamp-1">{listing.place_name}</span>
                    </div>
                  )}
                  {sizeRange && (
                    <div className="flex items-start gap-2">
                      <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                      <span>{sizeRange}</span>
                    </div>
                  )}
                </div>

                {/* Hover indicator */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-violet-600 font-medium">
                    Click to view details →
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Listing Modal */}
        <ListingModal
          listingId={selectedListingId}
          isOpen={!!selectedListingId}
          onClose={() => setSelectedListingId(null)}
        />

        {/* CTA */}
        <div className="text-center">
          {user ? (
            <Button
              asChild
              size="lg"
              className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Link href="/search">
                View All {listings.length > 8 ? '8,700+' : ''} Requirements
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <TrialSignupModal context="search" redirectPath="/search">
              <Button
                size="lg"
                className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                View All Requirements - Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </TrialSignupModal>
          )}
          <p className="text-sm text-gray-500 mt-4">
            {user ? 'Access our full directory' : 'No credit card required • 30-day free trial'}
          </p>
        </div>
      </div>
    </section>
  );
}
