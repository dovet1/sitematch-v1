'use client';

import { useState, useEffect } from 'react';
import { createClientClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, FileText, Building2, Wrench, Search, AlertCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import type { SavedSearchWithMatches } from '@/lib/saved-searches-types';

interface Listing {
  id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
}

interface OverviewTabProps {
  userId: string;
}

export function OverviewTab({ userId }: OverviewTabProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedSearchCount, setSavedSearchCount] = useState(0);
  const [savedSearches, setSavedSearches] = useState<SavedSearchWithMatches[]>([]);
  const [searchesLoading, setSearchesLoading] = useState(true);

  useEffect(() => {
    fetchListings();
    fetchSavedSearches();
  }, [userId]);

  const fetchListings = async () => {
    try {
      const supabase = createClientClient();
      const { data, error} = await supabase
        .from('listings')
        .select('id, status')
        .eq('created_by', userId);

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedSearches = async () => {
    try {
      const response = await fetch('/api/saved-searches');
      if (!response.ok) throw new Error('Failed to fetch searches');

      const data = await response.json();

      // Fetch match counts for each search (using cache for performance)
      const searchesWithCounts = await Promise.all(
        data.searches.map(async (search: SavedSearchWithMatches) => {
          try {
            const matchesResponse = await fetch(`/api/saved-searches/${search.id}/matches?use_cache=true`);
            if (matchesResponse.ok) {
              const matchesData = await matchesResponse.json();
              return {
                ...search,
                match_count: matchesData.matches?.length || 0,
              };
            }
            return { ...search, match_count: 0 };
          } catch (error) {
            return { ...search, match_count: 0 };
          }
        })
      );

      setSavedSearches(searchesWithCounts);
      setSavedSearchCount(searchesWithCounts.length);
    } catch (error) {
      console.error('Error fetching saved searches:', error);
    } finally {
      setSearchesLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  // Calculate requirement stats
  const requirementStats = {
    draft: listings.filter((l) => l.status === 'draft').length,
    pending: listings.filter((l) => l.status === 'pending').length,
    approved: listings.filter((l) => l.status === 'approved').length,
    rejected: listings.filter((l) => l.status === 'rejected').length,
    archived: listings.filter((l) => l.status === 'archived').length,
  };

  const totalRequirements = listings.length;
  const hasRequirements = totalRequirements > 0;
  const needsAttention = requirementStats.pending + requirementStats.rejected;

  // Assessed sites placeholder - will be replaced with real data
  const assessedSites = 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900">Overview</h1>
        <p className="text-gray-600 mt-2 text-base sm:text-lg font-medium">Your workspace at a glance</p>
      </div>

      {/* Hero CTA - Only show when no requirements */}
      {!hasRequirements && (
        <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 text-white shadow-2xl border-3 sm:border-4 border-violet-400/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="relative max-w-2xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 sm:mb-4">Welcome to SiteMatcher! 🎉</h2>
            <p className="text-violet-100 mb-6 sm:mb-8 text-base sm:text-lg md:text-xl font-medium">
              Post requirements or use our site assessment tools to get started.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Link href="/occupier/create-listing-quick" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-white text-violet-700 hover:bg-gray-100 font-black shadow-xl hover:shadow-2xl rounded-xl px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg">
                  <Plus className="h-5 w-5 mr-2" />
                  Post a Requirement
                </Button>
              </Link>
              <Link href="/sitesketcher" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent border-3 border-white text-white hover:bg-white/20 font-black rounded-xl px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg">
                  <Wrench className="h-5 w-5 mr-2" />
                  Use SiteSketcher
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Bar */}
      {hasRequirements && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Requirements Stat */}
          <button
            onClick={() => {
              const event = new CustomEvent('dashboard-tab-change', { detail: 'requirements' });
              window.dispatchEvent(event);
            }}
            className="bg-white rounded-xl sm:rounded-2xl border-3 border-violet-200 p-4 sm:p-6 shadow-lg hover:shadow-2xl hover:border-violet-400 hover:-translate-y-1 transition-all duration-300 text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-bold text-violet-600 mb-1 sm:mb-2 uppercase tracking-wide">Requirements</p>
                <p className="text-3xl sm:text-4xl font-black text-gray-900">{totalRequirements}</p>
              </div>
              <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-violet-600 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </button>

          {/* Saved Searches Stat */}
          <button
            onClick={() => {
              const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
              window.dispatchEvent(event);
            }}
            className="bg-white rounded-xl sm:rounded-2xl border-3 border-violet-200 p-4 sm:p-6 shadow-lg hover:shadow-2xl hover:border-violet-400 hover:-translate-y-1 transition-all duration-300 text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-bold text-violet-600 mb-1 sm:mb-2 uppercase tracking-wide">Saved Searches</p>
                <p className="text-3xl sm:text-4xl font-black text-gray-900">{savedSearchCount}</p>
              </div>
              <Search className="h-8 w-8 sm:h-10 sm:w-10 text-violet-600 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </button>

          {/* Assessed Sites Stat */}
          <button
            onClick={() => {
              const event = new CustomEvent('dashboard-tab-change', { detail: 'sites' });
              window.dispatchEvent(event);
            }}
            className="bg-white rounded-xl sm:rounded-2xl border-3 border-violet-200 p-4 sm:p-6 shadow-lg hover:shadow-2xl hover:border-violet-400 hover:-translate-y-1 transition-all duration-300 text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-bold text-violet-600 mb-1 sm:mb-2 uppercase tracking-wide">Assessed Sites</p>
                <p className="text-3xl sm:text-4xl font-black text-gray-900">{assessedSites}</p>
              </div>
              <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-violet-600 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </button>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Requirements Column */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border-3 border-violet-200 p-6 sm:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-5 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-violet-100 rounded-lg sm:rounded-xl">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900">Requirements</h2>
            </div>
            {hasRequirements && needsAttention > 0 && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                {needsAttention} need attention
              </Badge>
            )}
          </div>

          {hasRequirements ? (
            <div className="space-y-4">
              {/* Status Cards */}
              <div className="space-y-2">
                {requirementStats.approved > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-green-900">Approved</span>
                    <span className="text-xl font-bold text-green-700">{requirementStats.approved}</span>
                  </div>
                )}

                {requirementStats.pending > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-yellow-900 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      Pending Review
                    </span>
                    <span className="text-xl font-bold text-yellow-700">{requirementStats.pending}</span>
                  </div>
                )}

                {requirementStats.draft > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Draft</span>
                    <span className="text-xl font-bold text-gray-700">{requirementStats.draft}</span>
                  </div>
                )}

                {requirementStats.rejected > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-red-900">Rejected</span>
                    <span className="text-xl font-bold text-red-700">{requirementStats.rejected}</span>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="space-y-2 pt-4 border-t border-gray-200">
                <Link href="/occupier/create-listing-quick">
                  <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    New Requirement
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={() => {
                    const event = new CustomEvent('dashboard-tab-change', { detail: 'requirements' });
                    window.dispatchEvent(event);
                  }}
                >
                  View All Requirements
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No requirements yet</h3>
              <p className="text-xs text-gray-500 mb-4">Post your first requirement</p>
              <Link href="/occupier/create-listing-quick">
                <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white">
                  <Plus className="h-3 w-3 mr-1" />
                  Post Requirement
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Site Assessment Tools Column */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border-3 border-violet-200 p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-2 sm:gap-3 mb-5 sm:mb-6">
            <div className="p-1.5 sm:p-2 bg-violet-100 rounded-lg sm:rounded-xl">
              <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900">Site Assessment Tools</h2>
          </div>

          <div className="space-y-5">
            {/* Tools List */}
            <div className="space-y-4">
              {/* SiteSketcher */}
              <Link href="/sitesketcher">
                <div className="border-3 border-violet-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer bg-white">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-2.5 bg-blue-100 rounded-lg sm:rounded-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Wrench className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-violet-700 transition-colors">
                          SiteSketcher
                        </h3>
                        <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 group-hover:text-violet-600 transition-colors flex-shrink-0" />
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 font-medium mt-1">
                        Draw and measure site boundaries with aerial imagery
                      </p>
                    </div>
                  </div>
                </div>
              </Link>

              {/* SiteAnalyser */}
              <Link href="/new-dashboard/tools/site-demographer">
                <div className="border-3 border-violet-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-violet-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer bg-white">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-2.5 bg-violet-100 rounded-lg sm:rounded-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-violet-700 transition-colors">
                          SiteAnalyser
                        </h3>
                        <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 group-hover:text-violet-600 transition-colors flex-shrink-0" />
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 font-medium mt-1">
                        Analyse demographics around any site
                      </p>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Coming Soon Tool */}
              <div className="border-2 border-gray-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-gray-50/50">
                <div className="flex items-start gap-3 sm:gap-4 opacity-60">
                  <div className="p-2 sm:p-2.5 bg-gray-200 rounded-lg sm:rounded-xl flex-shrink-0">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-gray-900">
                      SiteBrochure
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 font-medium mt-1">
                      Generate professional requirement brochures
                    </p>
                    <p className="text-xs sm:text-sm text-violet-600 mt-2 font-bold">Coming soon</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sites Assessed Count */}
            {assessedSites > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-violet-900">Sites Assessed</span>
                    <span className="text-2xl font-bold text-violet-700">{assessedSites}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mt-2 border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={() => {
                    const event = new CustomEvent('dashboard-tab-change', { detail: 'sites' });
                    window.dispatchEvent(event);
                  }}
                >
                  View Assessed Sites
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Saved Searches Section - Full Width */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border-3 border-violet-200 p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-violet-100 rounded-lg sm:rounded-xl">
              <Search className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600" />
            </div>
            <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900">Saved Searches</h2>
          </div>
        </div>

        {searchesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        ) : savedSearches.length === 0 ? (
          /* Empty State */
          <div className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">No saved searches yet</h3>
            <p className="text-xs text-gray-500 mb-4">Save searches to track matching requirements</p>
            <Button
              size="sm"
              onClick={() => {
                const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
                window.dispatchEvent(event);
              }}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Saved Search
            </Button>
          </div>
        ) : (
          /* Populated State - Show search summaries */
          <div className="space-y-4">
            {/* Search List - Show up to 5 */}
            <div className="space-y-2">
              {savedSearches.slice(0, 5).map((search) => (
                <button
                  key={search.id}
                  onClick={() => {
                    const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
                    window.dispatchEvent(event);
                  }}
                  className="w-full bg-violet-50 border-2 border-violet-200 rounded-xl p-4 hover:border-violet-400 hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-violet-700 transition-colors mb-1">
                        {search.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        {search.location_address && (
                          <span className="truncate">{search.location_address}</span>
                        )}
                        {search.listing_type && (
                          <>
                            {search.location_address && <span>•</span>}
                            <span className="capitalize">{search.listing_type}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-violet-600 text-white font-bold flex-shrink-0">
                      {search.match_count} {search.match_count === 1 ? 'match' : 'matches'}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>

            {/* View All Button */}
            <div className="pt-4 border-t-2 border-violet-100">
              <Button
                variant="outline"
                className="w-full border-2 border-violet-200 text-violet-700 hover:bg-violet-50 font-bold"
                onClick={() => {
                  const event = new CustomEvent('dashboard-tab-change', { detail: 'searches' });
                  window.dispatchEvent(event);
                }}
              >
                View All Saved Searches
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
