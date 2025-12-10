'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Ruler, BarChart3, Loader2, Plus, ExternalLink, Trash2, Lock, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';
import { UpgradeBanner } from '@/components/UpgradeBanner';

interface SiteDetailViewProps {
  siteId: string;
  siteName: string;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

interface SavedSearch {
  id: string;
  name: string;
  listing_type?: string;
  location_address?: string;
  sectors?: string[];
  planning_use_classes?: string[];
}

interface Sketch {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  created_at: string;
}

interface Analysis {
  id: string;
  name: string;
  location_name: string;
  measurement_mode: string;
  measurement_value: number;
  created_at: string;
}

interface Site {
  id: string;
  name: string;
  address: string;
  location: any;
  description?: string;
}

export function SiteDetailView({ siteId, siteName, open, onClose, onUpdate }: SiteDetailViewProps) {
  const router = useRouter();
  const { isPro, isFreeTier } = useSubscriptionTier();

  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<Site | null>(null);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  const [showAttachSearchModal, setShowAttachSearchModal] = useState(false);
  const [showAttachSketchModal, setShowAttachSketchModal] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  const [availableSearches, setAvailableSearches] = useState<SavedSearch[]>([]);
  const [availableSketches, setAvailableSketches] = useState<Sketch[]>([]);
  const [attachingSearchId, setAttachingSearchId] = useState<string | null>(null);
  const [attachingSketchId, setAttachingSketchId] = useState<string | null>(null);
  const [detachingId, setDetachingId] = useState<string | null>(null);
  const [detachingType, setDetachingType] = useState<'search' | 'sketch' | 'analysis' | null>(null);

  useEffect(() => {
    if (open) {
      fetchSiteDetails();
    }
  }, [open, siteId]);

  const fetchSiteDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sites/${siteId}`);
      if (!response.ok) throw new Error('Failed to fetch site details');

      const data = await response.json();
      setSite(data.site);
      setSearches(data.site.searches || []);
      setSketches(data.site.sketches || []);
      setAnalyses(data.site.analyses || []);
    } catch (error) {
      console.error('Error fetching site details:', error);
      toast.error('Failed to load site details');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSearches = async () => {
    try {
      const response = await fetch('/api/saved-searches');
      if (!response.ok) throw new Error('Failed to fetch searches');

      const data = await response.json();
      // Filter out searches already attached to this site
      const attachedIds = new Set(searches.map(s => s.id));
      const available = (data.searches || []).filter((s: SavedSearch) => !attachedIds.has(s.id));
      setAvailableSearches(available);
    } catch (error) {
      console.error('Error fetching available searches:', error);
      toast.error('Failed to load available searches');
    }
  };

  const fetchAvailableSketches = async () => {
    try {
      const response = await fetch('/api/sitesketcher/sketches');
      if (!response.ok) throw new Error('Failed to fetch sketches');

      const data = await response.json();
      // Filter out sketches already attached to this site
      const attachedIds = new Set(sketches.map(s => s.id));
      const available = (data.sketches || []).filter((s: Sketch) => !attachedIds.has(s.id));
      setAvailableSketches(available);
    } catch (error) {
      console.error('Error fetching available sketches:', error);
      toast.error('Failed to load available sketches');
    }
  };

  const handleAttachSearch = async (searchId: string) => {
    setAttachingSearchId(searchId);
    try {
      const response = await fetch(`/api/sites/${siteId}/searches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_id: searchId }),
      });

      if (!response.ok) throw new Error('Failed to attach search');

      toast.success('Search attached successfully');
      await fetchSiteDetails();
      setShowAttachSearchModal(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error attaching search:', error);
      toast.error('Failed to attach search');
    } finally {
      setAttachingSearchId(null);
    }
  };

  const handleAttachSketch = async (sketchId: string) => {
    setAttachingSketchId(sketchId);
    try {
      const response = await fetch(`/api/sites/${siteId}/sketches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sketch_id: sketchId }),
      });

      if (!response.ok) throw new Error('Failed to attach sketch');

      toast.success('Sketch attached successfully');
      await fetchSiteDetails();
      setShowAttachSketchModal(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error attaching sketch:', error);
      toast.error('Failed to attach sketch');
    } finally {
      setAttachingSketchId(null);
    }
  };

  const handleDetach = async () => {
    if (!detachingId || !detachingType) return;

    try {
      let endpoint = '';
      if (detachingType === 'search') {
        endpoint = `/api/sites/${siteId}/searches?search_id=${detachingId}`;
      } else if (detachingType === 'sketch') {
        endpoint = `/api/sites/${siteId}/sketches?sketch_id=${detachingId}`;
      } else if (detachingType === 'analysis') {
        endpoint = `/api/sites/${siteId}/analyses?analysis_id=${detachingId}`;
      }

      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to detach resource');

      toast.success(`${detachingType} detached successfully`);
      await fetchSiteDetails();
      onUpdate?.();
    } catch (error) {
      console.error('Error detaching resource:', error);
      toast.error('Failed to detach resource');
    } finally {
      setDetachingId(null);
      setDetachingType(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getMeasurementLabel = (mode: string, value: number) => {
    if (mode === 'distance') return `${value} mile${value !== 1 ? 's' : ''}`;
    if (mode === 'drive_time') return `${value} min drive`;
    if (mode === 'walk_time') return `${value} min walk`;
    return `${value}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl sm:text-3xl font-black">{siteName}</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="overview" className="font-bold">Overview</TabsTrigger>
                <TabsTrigger value="searches" className="font-bold">
                  Searches ({searches.length})
                </TabsTrigger>
                <TabsTrigger value="sketches" className="font-bold">
                  Sketches ({sketches.length})
                </TabsTrigger>
                <TabsTrigger value="analyses" className="font-bold">
                  Analyses ({analyses.length})
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-6 border-2 border-violet-200">
                    <Search className="h-8 w-8 text-violet-600 mb-3" />
                    <div className="text-3xl font-black text-violet-700">{searches.length}</div>
                    <div className="text-sm font-bold text-violet-600">Saved Searches</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
                    <Ruler className="h-8 w-8 text-blue-600 mb-3" />
                    <div className="text-3xl font-black text-blue-700">{sketches.length}</div>
                    <div className="text-sm font-bold text-blue-600">Sketches</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
                    <BarChart3 className="h-8 w-8 text-purple-600 mb-3" />
                    <div className="text-3xl font-black text-purple-700">{analyses.length}</div>
                    <div className="text-sm font-bold text-purple-600">Analyses</div>
                  </div>
                </div>

                <div className="bg-violet-50 rounded-xl p-6 border-2 border-violet-200">
                  <h3 className="text-lg font-black text-gray-900 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      onClick={() => setActiveTab('searches')}
                      className="w-full bg-white border-2 border-violet-200 hover:bg-violet-50 text-violet-700 font-bold rounded-xl"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      View Searches
                    </Button>
                    <Button
                      onClick={() => setActiveTab('sketches')}
                      className="w-full bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-700 font-bold rounded-xl"
                    >
                      <Ruler className="h-4 w-4 mr-2" />
                      View Sketches
                    </Button>
                    <Button
                      onClick={() => {
                        // Pass site location to SiteSketcher via URL params
                        if (site?.location) {
                          const params = new URLSearchParams({
                            address: site.address,
                            lat: site.location.lat.toString(),
                            lng: site.location.lng.toString(),
                          });
                          router.push(`/sitesketcher?${params.toString()}`);
                        } else {
                          router.push('/sitesketcher');
                        }
                      }}
                      className="w-full bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Sketch
                    </Button>
                    <Button
                      onClick={() => router.push('/new-dashboard/tools/site-demographer')}
                      className="w-full bg-white border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Run Analysis
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Searches Tab */}
              <TabsContent value="searches" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 font-medium">
                    Saved searches attached to this site
                  </p>
                  <Button
                    onClick={() => {
                      fetchAvailableSearches();
                      setShowAttachSearchModal(true);
                    }}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Attach Search
                  </Button>
                </div>

                {searches.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No searches attached yet</p>
                    <p className="text-sm text-gray-500 mt-1">Attach saved searches to see relevant requirements</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searches.map((search) => (
                      <div
                        key={search.id}
                        className="bg-white rounded-xl border-2 border-violet-200 p-4 hover:shadow-lg transition-shadow"
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDetachingId(search.id);
                                setDetachingType('search');
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Sketches Tab */}
              <TabsContent value="sketches" className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 font-medium">
                    SiteSketcher sketches attached to this site
                  </p>
                  <Button
                    onClick={() => {
                      fetchAvailableSketches();
                      setShowAttachSketchModal(true);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Attach Sketch
                  </Button>
                </div>

                {sketches.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <Ruler className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No sketches attached yet</p>
                    <p className="text-sm text-gray-500 mt-1">Attach SiteSketcher drawings to this site</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sketches.map((sketch) => (
                      <div
                        key={sketch.id}
                        className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        {sketch.thumbnail_url && (
                          <div className="aspect-video bg-gray-100">
                            <img
                              src={sketch.thumbnail_url}
                              alt={sketch.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h4 className="font-bold text-gray-900 flex-1">{sketch.name}</h4>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDetachingId(sketch.id);
                                setDetachingType('sketch');
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {sketch.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {sketch.description}
                            </p>
                          )}
                          <Link
                            href={`/sitesketcher?sketch=${sketch.id}`}
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-bold"
                          >
                            Open in SiteSketcher
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Analyses Tab */}
              <TabsContent value="analyses" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600 font-medium">
                      Demographic analyses for this site
                    </p>
                    {isFreeTier && (
                      <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-300">
                        <Lock className="h-3 w-3 mr-1" />
                        Pro
                      </Badge>
                    )}
                  </div>
                  {isPro ? (
                    <Button
                      onClick={() => router.push('/new-dashboard/tools/site-demographer')}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Run Analysis
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowUpgradeBanner(true)}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Upgrade to Save
                    </Button>
                  )}
                </div>

                {isFreeTier ? (
                  <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border-2 border-violet-200 p-8 text-center">
                    <Lock className="h-12 w-12 text-violet-600 mx-auto mb-3" />
                    <h3 className="text-lg font-black text-gray-900 mb-2">Pro Feature</h3>
                    <p className="text-gray-600 font-medium mb-4">
                      Upgrade to Pro to save demographic analyses to your sites
                    </p>
                    <Button
                      onClick={() => setShowUpgradeBanner(true)}
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl"
                    >
                      Upgrade Now
                    </Button>
                  </div>
                ) : analyses.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-gray-200">
                    <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No analyses saved yet</p>
                    <p className="text-sm text-gray-500 mt-1">Run SiteAnalyser and save results to this site</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analyses.map((analysis) => (
                      <div
                        key={analysis.id}
                        className="bg-white rounded-xl border-2 border-purple-200 p-4 hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => router.push(`/new-dashboard/tools/site-demographer?analysis=${analysis.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 mb-2">{analysis.name}</h4>
                            <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                              <span className="font-medium">{analysis.location_name}</span>
                              <span>•</span>
                              <span>{getMeasurementLabel(analysis.measurement_mode, analysis.measurement_value)}</span>
                              <span>•</span>
                              <span>{formatDate(analysis.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/new-dashboard/tools/site-demographer?analysis=${analysis.id}`)}
                              className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              title="View full analysis"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDetachingId(analysis.id);
                                setDetachingType('analysis');
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete analysis"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Attach Search Modal */}
      <Dialog open={showAttachSearchModal} onOpenChange={setShowAttachSearchModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Attach Saved Search</DialogTitle>
          </DialogHeader>

          {availableSearches.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No available searches</p>
              <p className="text-sm text-gray-500 mt-1">All your searches are already attached to this site</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 hover:border-violet-300 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{search.name}</h4>
                    {search.location_address && (
                      <p className="text-sm text-gray-600">{search.location_address}</p>
                    )}
                  </div>
                  <Button
                    onClick={() => handleAttachSearch(search.id)}
                    disabled={attachingSearchId === search.id}
                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl"
                  >
                    {attachingSearchId === search.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Attaching...
                      </>
                    ) : (
                      'Attach'
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Attach Sketch Modal */}
      <Dialog open={showAttachSketchModal} onOpenChange={setShowAttachSketchModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Attach Sketch</DialogTitle>
          </DialogHeader>

          {availableSketches.length === 0 ? (
            <div className="text-center py-8">
              <Ruler className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No available sketches</p>
              <p className="text-sm text-gray-500 mt-1">All your sketches are already attached to this site</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableSketches.map((sketch) => (
                <div
                  key={sketch.id}
                  className="rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-colors overflow-hidden"
                >
                  {sketch.thumbnail_url && (
                    <div className="aspect-video bg-gray-100">
                      <img
                        src={sketch.thumbnail_url}
                        alt={sketch.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-3">
                    <h4 className="font-bold text-gray-900 mb-2 text-sm">{sketch.name}</h4>
                    <Button
                      onClick={() => handleAttachSketch(sketch.id)}
                      disabled={attachingSketchId === sketch.id}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                      size="sm"
                    >
                      {attachingSketchId === sketch.id ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          Attaching...
                        </>
                      ) : (
                        'Attach'
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
      <AlertDialog open={!!detachingId} onOpenChange={() => {
        setDetachingId(null);
        setDetachingType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detach {detachingType}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the {detachingType} from this site, but won't delete it.
              {detachingType === 'analysis' && ' Note: The analysis will be permanently deleted as it belongs to this site.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDetach}
              className="bg-red-600 hover:bg-red-700"
            >
              Detach
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade Banner Modal */}
      {showUpgradeBanner && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={() => setShowUpgradeBanner(false)}
        >
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <UpgradeBanner
              title="Save Demographic Analyses"
              features={[
                'Save unlimited demographic analyses',
                'Attach analyses to sites',
                'Access historical demographic data',
                'Export analysis reports',
                'Access all requirement listings',
                'Pro access to all tools',
              ]}
              context="general"
              onDismiss={() => setShowUpgradeBanner(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
