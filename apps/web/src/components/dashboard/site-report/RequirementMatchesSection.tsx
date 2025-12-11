'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building, Plus, ExternalLink, Trash2, ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SavedSearch {
  id: string;
  name: string;
  listing_type?: string;
  location_address?: string;
  sectors?: string[];
  planning_use_classes?: string[];
}

interface MatchingListing {
  id: string;
  title: string;
  address?: string;
  listing_type?: string;
}

interface RequirementMatchesSectionProps {
  siteId: string;
  searches: SavedSearch[];
  onUpdate?: () => void;
}

export function RequirementMatchesSection({ siteId, searches: initialSearches, onUpdate }: RequirementMatchesSectionProps) {
  const [searches, setSearches] = useState(initialSearches);
  const [expandedSearches, setExpandedSearches] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<Record<string, MatchingListing[]>>({});
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [loadingMatches, setLoadingMatches] = useState<Record<string, boolean>>({});

  const [showAttachModal, setShowAttachModal] = useState(false);
  const [availableSearches, setAvailableSearches] = useState<SavedSearch[]>([]);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  useEffect(() => {
    setSearches(initialSearches);
    fetchAllMatchCounts();
  }, [initialSearches]);

  const fetchAllMatchCounts = async () => {
    const counts: Record<string, number> = {};

    await Promise.all(
      initialSearches.map(async (search) => {
        try {
          const response = await fetch(`/api/saved-searches/${search.id}/matches`);
          if (response.ok) {
            const data = await response.json();
            counts[search.id] = data.matches?.length || 0;
          }
        } catch (error) {
          console.error(`Error fetching matches for search ${search.id}:`, error);
        }
      })
    );

    setMatchCounts(counts);
  };

  const fetchMatchesForSearch = async (searchId: string) => {
    setLoadingMatches(prev => ({ ...prev, [searchId]: true }));

    try {
      const response = await fetch(`/api/saved-searches/${searchId}/matches`);
      if (!response.ok) throw new Error('Failed to fetch matches');

      const data = await response.json();
      setMatches(prev => ({ ...prev, [searchId]: data.matches || [] }));
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setLoadingMatches(prev => ({ ...prev, [searchId]: false }));
    }
  };

  const toggleExpanded = (searchId: string) => {
    const newExpanded = new Set(expandedSearches);

    if (newExpanded.has(searchId)) {
      newExpanded.delete(searchId);
    } else {
      newExpanded.add(searchId);
      // Fetch matches if we don't have them yet
      if (!matches[searchId]) {
        fetchMatchesForSearch(searchId);
      }
    }

    setExpandedSearches(newExpanded);
  };

  const fetchAvailableSearches = async () => {
    try {
      const response = await fetch('/api/saved-searches');
      if (!response.ok) throw new Error('Failed to fetch searches');

      const data = await response.json();
      // Filter out searches already attached
      const attachedIds = new Set(searches.map(s => s.id));
      setAvailableSearches(data.searches.filter((s: SavedSearch) => !attachedIds.has(s.id)));
    } catch (error) {
      console.error('Error fetching searches:', error);
      toast.error('Failed to load searches');
    }
  };

  const handleAttach = async (searchId: string) => {
    setAttachingId(searchId);

    try {
      const response = await fetch(`/api/sites/${siteId}/searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_id: searchId })
      });

      if (!response.ok) throw new Error('Failed to attach search');

      toast.success('Search attached successfully');
      setShowAttachModal(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error attaching search:', error);
      toast.error('Failed to attach search');
    } finally {
      setAttachingId(null);
    }
  };

  const handleDetach = async () => {
    if (!detachingId) return;

    try {
      const response = await fetch(`/api/sites/${siteId}/searches?search_id=${detachingId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to detach search');

      toast.success('Search detached successfully');
      setDetachingId(null);
      onUpdate?.();
    } catch (error) {
      console.error('Error detaching search:', error);
      toast.error('Failed to detach search');
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Target Occupiers</h2>
          <p className="text-sm text-gray-600 mt-1">Saved searches showing companies looking for sites like this</p>
        </div>
        <Button
          onClick={() => {
            fetchAvailableSearches();
            setShowAttachModal(true);
          }}
          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Link Search
        </Button>
      </div>

      {/* Searches List */}
      {searches.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-violet-50 to-purple-50 rounded-3xl border-3 border-violet-200">
          <Search className="h-16 w-16 text-violet-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-900 mb-2">No Searches Linked Yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Link saved searches to see which companies are looking for sites matching your criteria
          </p>
          <Button
            onClick={() => {
              fetchAvailableSearches();
              setShowAttachModal(true);
            }}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Link Your First Search
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {searches.map((search) => {
            const isExpanded = expandedSearches.has(search.id);
            const matchCount = matchCounts[search.id] || 0;
            const searchMatches = matches[search.id] || [];
            const isLoadingMatches = loadingMatches[search.id];

            return (
              <div
                key={search.id}
                className="bg-white rounded-2xl border-3 border-violet-200 overflow-hidden shadow-md hover:shadow-xl transition-shadow"
              >
                {/* Search Header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-black text-gray-900">{search.name}</h3>
                        <Badge className="bg-violet-600 text-white font-bold">
                          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {search.listing_type && (
                          <Badge variant="secondary" className="text-xs font-bold">
                            {search.listing_type}
                          </Badge>
                        )}
                        {search.location_address && (
                          <Badge variant="outline" className="text-xs">
                            {search.location_address}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <Link href={`/search?saved_search=${search.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-2 border-violet-300 hover:bg-violet-50 text-violet-700 font-bold rounded-xl"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDetachingId(search.id)}
                        className="hover:bg-red-50 text-red-600 font-bold rounded-xl"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expand Button */}
                  {matchCount > 0 && (
                    <Button
                      variant="ghost"
                      onClick={() => toggleExpanded(search.id)}
                      className="w-full mt-3 text-violet-600 hover:text-violet-700 hover:bg-violet-50 font-bold rounded-xl"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 mr-2" />
                          Hide Matches
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-2" />
                          View {matchCount} {matchCount === 1 ? 'Match' : 'Matches'}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Matches List */}
                {isExpanded && (
                  <div className="border-t-2 border-violet-100 bg-violet-50/50 p-5">
                    {isLoadingMatches ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
                      </div>
                    ) : searchMatches.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">No matches found</p>
                    ) : (
                      <div className="space-y-2">
                        {searchMatches.slice(0, 5).map((listing) => (
                          <Link
                            key={listing.id}
                            href={`/listing/${listing.id}`}
                            className="block bg-white rounded-xl border-2 border-violet-200 p-4 hover:shadow-md hover:border-violet-400 transition-all"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900 mb-1">{listing.title}</h4>
                                {listing.address && (
                                  <p className="text-sm text-gray-600">{listing.address}</p>
                                )}
                              </div>
                              <Building className="h-5 w-5 text-violet-600 flex-shrink-0" />
                            </div>
                          </Link>
                        ))}
                        {searchMatches.length > 5 && (
                          <Link href={`/search?saved_search=${search.id}`}>
                            <Button
                              variant="outline"
                              className="w-full mt-2 border-2 border-violet-300 hover:bg-violet-50 text-violet-700 font-bold rounded-xl"
                            >
                              View all {matchCount} matches
                              <ExternalLink className="h-4 w-4 ml-2" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Attach Search Modal */}
      <Dialog open={showAttachModal} onOpenChange={setShowAttachModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Link Saved Search</DialogTitle>
          </DialogHeader>

          {availableSearches.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No available searches to link</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableSearches.map((search) => (
                <div
                  key={search.id}
                  className="bg-white rounded-xl border-2 border-violet-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-2">{search.name}</h4>
                      <div className="flex flex-wrap gap-2">
                        {search.listing_type && (
                          <Badge variant="secondary" className="text-xs">
                            {search.listing_type}
                          </Badge>
                        )}
                        {search.location_address && (
                          <Badge variant="outline" className="text-xs">
                            {search.location_address}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleAttach(search.id)}
                      disabled={attachingId === search.id}
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl"
                    >
                      {attachingId === search.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Link'
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detach Confirmation Dialog */}
      <AlertDialog open={!!detachingId} onOpenChange={() => setDetachingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Search?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the search from this site. The search itself will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDetach}
              className="bg-red-600 hover:bg-red-700"
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
