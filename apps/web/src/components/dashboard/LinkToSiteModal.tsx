'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Search as SearchIcon, MapPin, FileText, Ruler, BarChart3, Clock } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  address: string;
  created_at: string;
  // Counts for existing outputs
  searches_count?: number;
  sketches_count?: number;
  analyses_count?: number;
}

interface LinkToSiteModalProps {
  open: boolean;
  onClose: () => void;
  onLink: (siteId: string) => void;
  sites: Site[];
  outputType: 'search' | 'sketch' | 'analysis';
  recentSiteIds?: string[];
}

export function LinkToSiteModal({
  open,
  onClose,
  onLink,
  sites,
  outputType,
  recentSiteIds = []
}: LinkToSiteModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Filter sites based on search
  const filteredSites = useMemo(() => {
    if (!searchTerm) return sites;

    const lower = searchTerm.toLowerCase();
    return sites.filter(
      site =>
        site.name.toLowerCase().includes(lower) ||
        site.address.toLowerCase().includes(lower)
    );
  }, [sites, searchTerm]);

  // Separate recent sites from others
  const recentSites = useMemo(() => {
    return filteredSites.filter(site => recentSiteIds.includes(site.id));
  }, [filteredSites, recentSiteIds]);

  const otherSites = useMemo(() => {
    return filteredSites.filter(site => !recentSiteIds.includes(site.id));
  }, [filteredSites, recentSiteIds]);

  const handleLinkClick = () => {
    if (selectedSiteId) {
      onLink(selectedSiteId);
      setSelectedSiteId('');
      setSearchTerm('');
    }
  };

  const handleClose = () => {
    setSelectedSiteId('');
    setSearchTerm('');
    onClose();
  };

  const getOutputTypeLabel = () => {
    switch (outputType) {
      case 'search': return 'Search';
      case 'sketch': return 'Sketch';
      case 'analysis': return 'Analysis';
    }
  };

  const getOutputTypeColor = () => {
    switch (outputType) {
      case 'search': return 'violet';
      case 'sketch': return 'blue';
      case 'analysis': return 'purple';
    }
  };

  const renderSiteCard = (site: Site, isRecent: boolean = false) => {
    const isSelected = selectedSiteId === site.id;
    const color = getOutputTypeColor();

    return (
      <div
        key={site.id}
        onClick={() => setSelectedSiteId(site.id)}
        className={`
          relative p-4 rounded-xl border-2 cursor-pointer transition-all
          ${isSelected
            ? `border-${color}-500 bg-${color}-50 shadow-md`
            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
          }
        `}
      >
        {isRecent && (
          <Badge className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Recent
          </Badge>
        )}

        <div className="flex items-start gap-3">
          <div className={`
            p-2 rounded-lg flex-shrink-0
            ${isSelected ? `bg-${color}-100` : 'bg-gray-100'}
          `}>
            <Building2 className={`h-5 w-5 ${isSelected ? `text-${color}-600` : 'text-gray-600'}`} />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-gray-900 mb-1 truncate">{site.name}</h4>
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{site.address}</span>
            </div>

            {/* Existing outputs counts */}
            <div className="flex items-center gap-3 text-xs">
              {(site.searches_count !== undefined && site.searches_count > 0) && (
                <div className="flex items-center gap-1 text-violet-600">
                  <FileText className="h-3 w-3" />
                  <span className="font-medium">{site.searches_count}</span>
                </div>
              )}
              {(site.sketches_count !== undefined && site.sketches_count > 0) && (
                <div className="flex items-center gap-1 text-blue-600">
                  <Ruler className="h-3 w-3" />
                  <span className="font-medium">{site.sketches_count}</span>
                </div>
              )}
              {(site.analyses_count !== undefined && site.analyses_count > 0) && (
                <div className="flex items-center gap-1 text-purple-600">
                  <BarChart3 className="h-3 w-3" />
                  <span className="font-medium">{site.analyses_count}</span>
                </div>
              )}
              {(!site.searches_count && !site.sketches_count && !site.analyses_count) && (
                <span className="text-gray-400 italic">No outputs yet</span>
              )}
            </div>
          </div>

          {isSelected && (
            <div className={`
              w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
              bg-${color}-500
            `}>
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black flex items-center gap-2">
            <Building2 className="h-6 w-6 text-gray-700" />
            Link {getOutputTypeLabel()} to Site
          </DialogTitle>
          <DialogDescription>
            Select a site to link this {outputType} to. You can search by name or address.
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search sites by name or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 border-2 border-gray-200 focus:border-gray-400 rounded-xl"
          />
        </div>

        {/* Sites List */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          <div className="space-y-4">
            {/* Recent Sites Section */}
            {recentSites.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recently Used
                </h3>
                <div className="space-y-2">
                  {recentSites.map(site => renderSiteCard(site, true))}
                </div>
              </div>
            )}

            {/* All/Other Sites Section */}
            {otherSites.length > 0 && (
              <div>
                {recentSites.length > 0 && (
                  <h3 className="text-sm font-bold text-gray-700 mb-3 mt-6">
                    All Sites
                  </h3>
                )}
                <div className="space-y-2">
                  {otherSites.map(site => renderSiteCard(site, false))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredSites.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">
                  {searchTerm ? 'No sites found' : 'No sites yet'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchTerm ? 'Try a different search term' : 'Create a site first to link outputs'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 border-2 border-gray-200 hover:bg-gray-50 font-bold rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLinkClick}
            disabled={!selectedSiteId}
            className={`
              flex-1 font-bold rounded-xl text-white
              ${outputType === 'search' ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700' : ''}
              ${outputType === 'sketch' ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : ''}
              ${outputType === 'analysis' ? 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700' : ''}
            `}
          >
            Link to Site
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
