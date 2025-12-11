'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Search as SearchIcon, Building } from 'lucide-react';
import { CreateSearchModal } from './create-search-modal';
import { SavedSearchCard } from './saved-search-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ListingModal } from '@/components/listings/ListingModal';
import type { SavedSearchWithMatches, MatchingListing, SavedSearch } from '@/lib/saved-searches-types';
import type { SearchableOption } from '@/components/ui/searchable-dropdown';
import { getSectorOptions, getUseClassOptions } from '@/lib/reference-data';
import Link from 'next/link';

interface SavedSearchesTabProps {
  userId: string;
}

export function SavedSearchesTab({ userId }: SavedSearchesTabProps) {
  const [searches, setSearches] = useState<SavedSearchWithMatches[]>([]);
  const [matches, setMatches] = useState<MatchingListing[]>([]);
  const [selectedSearchFilter, setSelectedSearchFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  // Reference data
  const [sectorOptions, setSectorOptions] = useState<SearchableOption[]>([]);
  const [useClassOptions, setUseClassOptions] = useState<SearchableOption[]>([]);

  useEffect(() => {
    fetchSearches();
    loadReferenceData();
  }, [userId]);

  useEffect(() => {
    if (searches.length > 0) {
      fetchAllMatches();
    }
  }, [searches]);

  const loadReferenceData = async () => {
    try {
      const [sectors, useClasses] = await Promise.all([
        getSectorOptions(),
        getUseClassOptions(),
      ]);
      setSectorOptions(sectors);
      setUseClassOptions(useClasses);
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  };

  const fetchSearches = async () => {
    try {
      const response = await fetch('/api/saved-searches');
      if (!response.ok) throw new Error('Failed to fetch searches');

      const data = await response.json();

      // Fetch match counts for each search
      const searchesWithCounts = await Promise.all(
        data.searches.map(async (search: SavedSearch) => {
          try {
            const matchesResponse = await fetch(`/api/saved-searches/${search.id}/matches`);
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

      setSearches(searchesWithCounts);
    } catch (error) {
      console.error('Error fetching searches:', error);
      toast.error('Failed to load saved searches');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMatches = async () => {
    setMatchesLoading(true);
    try {
      // Fetch matches for all searches
      const allMatches = await Promise.all(
        searches.map(async (search) => {
          try {
            const response = await fetch(`/api/saved-searches/${search.id}/matches`);
            if (response.ok) {
              const data = await response.json();
              return data.matches || [];
            }
            return [];
          } catch (error) {
            console.error(`Error fetching matches for search ${search.id}:`, error);
            return [];
          }
        })
      );

      // Flatten and deduplicate matches
      const flatMatches = allMatches.flat();
      const uniqueMatches = Array.from(
        new Map(flatMatches.map((m) => [m.id, m])).values()
      );

      setMatches(uniqueMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Failed to load matching requirements');
    } finally {
      setMatchesLoading(false);
    }
  };

  const handleCreateSuccess = async () => {
    await fetchSearches();
    setShowCreateModal(false);
    setEditingSearch(null);
  };

  const handleEdit = (search: SavedSearchWithMatches) => {
    setEditingSearch(search);
    setShowCreateModal(true);
  };

  const handleDelete = async () => {
    await fetchSearches();
  };

  const filteredMatches =
    selectedSearchFilter === 'all'
      ? matches
      : matches.filter((m) => m.matched_search_id === selectedSearchFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Saved Searches</h1>
          <p className="text-gray-500 mt-1">
            Get notified when requirements match your criteria
          </p>
        </div>
        {searches.length > 0 && searches.length < 50 && (
          <Button
            onClick={() => {
              setEditingSearch(null);
              setShowCreateModal(true);
            }}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Search
          </Button>
        )}
      </div>

      {/* Empty State */}
      {searches.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-violet-100 rounded-full flex items-center justify-center">
            <SearchIcon className="h-8 w-8 text-violet-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No saved searches yet
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Create a saved search to get notified when requirements match your criteria.
            You can save up to 50 searches.
          </p>
          <Button
            onClick={() => {
              setEditingSearch(null);
              setShowCreateModal(true);
            }}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Search
          </Button>
        </div>
      )}

      {/* Searches List */}
      {searches.length > 0 && (
        <>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Your Searches ({searches.length}/50)
              </h2>
            </div>
            <div className="space-y-3">
              {searches.map((search) => (
                <SavedSearchCard
                  key={search.id}
                  search={search}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>

          {/* Matching Requirements */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Matching Requirements ({filteredMatches.length})
              </h2>
              {searches.length > 1 && (
                <Select value={selectedSearchFilter} onValueChange={setSelectedSearchFilter}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filter by search" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Searches</SelectItem>
                    {searches.map((search) => (
                      <SelectItem key={search.id} value={search.id}>
                        {search.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {matchesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Building className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No matches yet
                </h3>
                <p className="text-gray-500">
                  We'll notify you when requirements match your saved searches.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMatches.map((match) => (
                  <button
                    key={match.id}
                    onClick={() => setSelectedListingId(match.id)}
                    className="w-full text-left bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-violet-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">
                          {match.company_name}
                        </h3>
                        {match.location && (
                          <p className="text-sm text-gray-600 mb-1">
                            {match.location.address}
                            {match.distance_miles && ` • ${match.distance_miles} miles away`}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="capitalize">{match.listing_type}</span>
                          <span>•</span>
                          <span>Posted {new Date(match.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-violet-600 font-medium mb-1">
                          Matches: {match.matched_search_name}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      <CreateSearchModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingSearch(null);
        }}
        onSuccess={handleCreateSuccess}
        editingSearch={editingSearch}
        sectorOptions={sectorOptions}
        useClassOptions={useClassOptions}
      />

      {/* Listing Modal */}
      {selectedListingId && (
        <ListingModal
          listingId={selectedListingId}
          isOpen={!!selectedListingId}
          onClose={() => setSelectedListingId(null)}
        />
      )}
    </div>
  );
}
