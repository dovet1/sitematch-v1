'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, Plus, X, MapPin, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Agency {
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  logo_url?: string;
}

interface ListingAgent {
  id: string;
  listing_id: string;
  agency_id: string;
  added_at: string;
  agency: Agency;
}

interface MultipleAgentsManagerProps {
  listingId: string;
  currentAgents: ListingAgent[];
  isOpen: boolean;
  onClose: () => void;
  onAgentsUpdated: () => void;
  onCreateAgency?: () => void;
}

export function MultipleAgentsManager({
  listingId,
  currentAgents,
  isOpen,
  onClose,
  onAgentsUpdated,
  onCreateAgency
}: MultipleAgentsManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Agency[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  // Search agencies
  useEffect(() => {
    const searchAgencies = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/agencies/search-simple?search=${encodeURIComponent(searchTerm)}&limit=10`);
        const result = await response.json();
        
        if (result.success) {
          // Filter out agencies already added to this listing
          const currentAgencyIds = new Set(currentAgents.map(agent => agent.agency_id));
          const filteredResults = result.data.filter((agency: Agency) => !currentAgencyIds.has(agency.id));
          setSearchResults(filteredResults);
        } else {
          console.error('Failed to search agencies:', result.error);
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Error searching agencies:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchAgencies, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, currentAgents]);

  // Add agency to listing
  const addAgency = async (agency: Agency) => {
    setIsAdding(true);
    try {
      const response = await fetch(`/api/listings/${listingId}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          listing_id: listingId,
          agency_id: agency.id 
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add agent');
      }

      toast.success(`Added ${agency.name} as an agent`);
      onAgentsUpdated();
      setSearchTerm('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding agency:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add agent');
    } finally {
      setIsAdding(false);
    }
  };

  // Remove agency from listing
  const removeAgency = async (agencyId: string, agencyName: string) => {
    setIsRemoving(agencyId);
    try {
      const response = await fetch(`/api/listings/${listingId}/agents?agency_id=${agencyId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove agent');
      }

      toast.success(`Removed ${agencyName} as an agent`);
      onAgentsUpdated();
    } catch (error) {
      console.error('Error removing agency:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to remove agent');
    } finally {
      setIsRemoving(null);
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setSearchResults([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Manage Agents ({currentAgents.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Agents */}
          {currentAgents.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Current Agents</h3>
              <div className="space-y-2">
                {currentAgents.map((listingAgent) => (
                  <div
                    key={listingAgent.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {listingAgent.agency.logo_url ? (
                        <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center p-1">
                          <img
                            src={listingAgent.agency.logo_url}
                            alt={`${listingAgent.agency.name} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{listingAgent.agency.name}</div>
                        {listingAgent.agency.contact_email && (
                          <div className="text-sm text-gray-600">{listingAgent.agency.contact_email}</div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAgency(listingAgent.agency_id, listingAgent.agency.name)}
                      disabled={isRemoving === listingAgent.agency_id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {isRemoving === listingAgent.agency_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Agent */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Add Agent</h3>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search agencies by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {searchTerm.trim() && (
              <div className="mt-3 border rounded-lg bg-white max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    Searching agencies...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="divide-y">
                    {searchResults.map((agency) => (
                      <div
                        key={agency.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer"
                        onClick={() => addAgency(agency)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {agency.logo_url ? (
                              <div className="w-8 h-8 rounded bg-white border flex items-center justify-center p-1">
                                <img
                                  src={agency.logo_url}
                                  alt={`${agency.name} logo`}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-blue-600" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{agency.name}</div>
                              {agency.contact_email && (
                                <div className="text-sm text-gray-600">{agency.contact_email}</div>
                              )}
                            </div>
                          </div>
                          <Plus className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    No agencies found matching "{searchTerm}"
                  </div>
                )}
              </div>
            )}

            {/* Create Agency Option */}
            {searchTerm.trim() && searchResults.length === 0 && !isSearching && (
              <div className="mt-3 p-4 border border-dashed border-gray-300 rounded-lg text-center">
                <p className="text-gray-600 mb-2">Can't find the agency you're looking for?</p>
                <Button
                  onClick={() => {
                    handleClose();
                    onCreateAgency?.();
                  }}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Agency
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}