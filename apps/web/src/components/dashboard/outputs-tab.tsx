'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Ruler,
  BarChart3,
  Loader2,
  Link2,
  Unlink,
  Trash2,
  Building2,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useRouter } from 'next/navigation';

interface SavedSearch {
  id: string;
  name: string;
  site_id: string | null;
  site_name?: string;
  listing_type?: string;
  location_address?: string;
  created_at: string;
}

interface Sketch {
  id: string;
  name: string;
  site_id: string | null;
  site_name?: string;
  description?: string;
  created_at: string;
}

interface Analysis {
  id: string;
  name: string;
  site_id: string | null;
  site_name?: string;
  location_name: string;
  measurement_mode: string;
  measurement_value: number;
  created_at: string;
}

interface Site {
  id: string;
  name: string;
}

interface OutputsTabProps {
  userId: string;
}

export function OutputsTab({ userId }: OutputsTabProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'searches' | 'sketches' | 'analyses'>('searches');
  const [loading, setLoading] = useState(true);

  // Data states
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  // UI states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<'search' | 'sketch' | 'analysis' | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkingType, setLinkingType] = useState<'search' | 'sketch' | 'analysis' | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  useEffect(() => {
    fetchAllData();
  }, [userId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSearches(),
        fetchSketches(),
        fetchAnalyses(),
        fetchSites(),
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load outputs');
    } finally {
      setLoading(false);
    }
  };

  const fetchSearches = async () => {
    try {
      const response = await fetch('/api/saved-searches');
      if (!response.ok) throw new Error('Failed to fetch searches');
      const data = await response.json();

      // Enrich with site names
      const enriched = await Promise.all(
        data.searches.map(async (search: SavedSearch) => {
          if (search.site_id) {
            try {
              const siteResponse = await fetch(`/api/sites/${search.site_id}`);
              if (siteResponse.ok) {
                const siteData = await siteResponse.json();
                return { ...search, site_name: siteData.site.name };
              }
            } catch (error) {
              console.error('Error fetching site name:', error);
            }
          }
          return search;
        })
      );

      setSearches(enriched);
    } catch (error) {
      console.error('Error fetching searches:', error);
    }
  };

  const fetchSketches = async () => {
    try {
      const response = await fetch('/api/sitesketcher/sketches');
      if (!response.ok) throw new Error('Failed to fetch sketches');
      const data = await response.json();

      // Enrich with site names
      const enriched = await Promise.all(
        data.sketches.map(async (sketch: Sketch) => {
          if (sketch.site_id) {
            try {
              const siteResponse = await fetch(`/api/sites/${sketch.site_id}`);
              if (siteResponse.ok) {
                const siteData = await siteResponse.json();
                return { ...sketch, site_name: siteData.site.name };
              }
            } catch (error) {
              console.error('Error fetching site name:', error);
            }
          }
          return sketch;
        })
      );

      setSketches(enriched);
    } catch (error) {
      console.error('Error fetching sketches:', error);
    }
  };

  const fetchAnalyses = async () => {
    try {
      const response = await fetch('/api/demographic-analyses');
      if (!response.ok) throw new Error('Failed to fetch analyses');
      const data = await response.json();

      // Enrich with site names
      const enriched = await Promise.all(
        data.analyses.map(async (analysis: Analysis) => {
          if (analysis.site_id) {
            try {
              const siteResponse = await fetch(`/api/sites/${analysis.site_id}`);
              if (siteResponse.ok) {
                const siteData = await siteResponse.json();
                return { ...analysis, site_name: siteData.site.name };
              }
            } catch (error) {
              console.error('Error fetching site name:', error);
            }
          }
          return analysis;
        })
      );

      setAnalyses(enriched);
    } catch (error) {
      console.error('Error fetching analyses:', error);
    }
  };

  const fetchSites = async () => {
    try {
      const response = await fetch('/api/sites');
      if (!response.ok) throw new Error('Failed to fetch sites');
      const data = await response.json();
      setSites(data.sites || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    }
  };

  const handleDelete = async () => {
    if (!deletingId || !deletingType) return;

    try {
      let endpoint = '';
      if (deletingType === 'search') {
        endpoint = `/api/saved-searches/${deletingId}`;
      } else if (deletingType === 'sketch') {
        endpoint = `/api/sitesketcher/sketches/${deletingId}`;
      } else if (deletingType === 'analysis') {
        endpoint = `/api/demographic-analyses/${deletingId}`;
      }

      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');

      toast.success(`${deletingType} deleted successfully`);
      await fetchAllData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    } finally {
      setDeletingId(null);
      setDeletingType(null);
    }
  };

  const handleLink = async () => {
    if (!linkingId || !linkingType || !selectedSiteId) return;

    try {
      let endpoint = '';
      if (linkingType === 'search') {
        endpoint = `/api/sites/${selectedSiteId}/searches`;
      } else if (linkingType === 'sketch') {
        endpoint = `/api/sites/${selectedSiteId}/sketches`;
      } else if (linkingType === 'analysis') {
        endpoint = `/api/sites/${selectedSiteId}/analyses`;
      }

      const body: any = {};
      if (linkingType === 'search') body.search_id = linkingId;
      else if (linkingType === 'sketch') body.sketch_id = linkingId;
      else if (linkingType === 'analysis') body.analysis_id = linkingId;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to link');

      toast.success(`${linkingType} linked to site successfully`);
      await fetchAllData();
    } catch (error) {
      console.error('Error linking:', error);
      toast.error('Failed to link to site');
    } finally {
      setLinkingId(null);
      setLinkingType(null);
      setSelectedSiteId('');
    }
  };

  const handleUnlink = async (id: string, type: 'search' | 'sketch' | 'analysis', siteId: string) => {
    try {
      let endpoint = '';
      if (type === 'search') {
        endpoint = `/api/sites/${siteId}/searches?search_id=${id}`;
      } else if (type === 'sketch') {
        endpoint = `/api/sites/${siteId}/sketches?sketch_id=${id}`;
      } else if (type === 'analysis') {
        endpoint = `/api/sites/${siteId}/analyses?analysis_id=${id}`;
      }

      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to unlink');

      toast.success(`${type} unlinked from site successfully`);
      await fetchAllData();
    } catch (error) {
      console.error('Error unlinking:', error);
      toast.error('Failed to unlink from site');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900">My Outputs</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-base sm:text-lg font-medium">
            All your saved searches, sketches, and demographic analyses in one place
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="searches" className="font-bold">
              <Search className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Searches</span> ({searches.length})
            </TabsTrigger>
            <TabsTrigger value="sketches" className="font-bold">
              <Ruler className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Sketches</span> ({sketches.length})
            </TabsTrigger>
            <TabsTrigger value="analyses" className="font-bold">
              <BarChart3 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Analyses</span> ({analyses.length})
            </TabsTrigger>
          </TabsList>

          {/* Searches Tab */}
          <TabsContent value="searches" className="space-y-4">
            {searches.length === 0 ? (
              <div className="bg-white rounded-3xl border-3 border-violet-200 shadow-xl p-12 text-center">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No saved searches yet</p>
                <p className="text-sm text-gray-500 mt-2">Create saved searches to track listings that match your criteria</p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {searches.map((search) => (
                    <div
                      key={search.id}
                      className="bg-white rounded-2xl border-3 border-violet-200 p-5 shadow-lg space-y-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Name</p>
                        <p className="text-base font-bold text-gray-900">{search.name}</p>
                      </div>

                      {search.location_address && (
                        <div>
                          <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Location</p>
                          <p className="text-sm text-gray-600 font-medium">{search.location_address}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Site</p>
                        {search.site_id && search.site_name ? (
                          <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-300 font-bold">
                            <Building2 className="h-3 w-3 mr-1" />
                            {search.site_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 font-medium">
                            Not linked
                          </Badge>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-1">Created</p>
                        <p className="text-sm text-gray-600 font-medium">{formatDate(search.created_at)}</p>
                      </div>

                      <div className="pt-3 border-t-2 border-violet-100 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/search?saved_search=${search.id}`)}
                          className="flex-1 text-violet-600 border-violet-300 hover:bg-violet-50 font-bold"
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          View
                        </Button>
                        {!search.site_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLinkingId(search.id);
                              setLinkingType('search');
                            }}
                            className="flex-1 border-gray-300 hover:bg-gray-50 font-bold"
                          >
                            <Link2 className="h-4 w-4 mr-1.5" />
                            Link
                          </Button>
                        )}
                        {search.site_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnlink(search.id, 'search', search.site_id!)}
                            className="flex-1 border-gray-300 hover:bg-gray-50 font-bold"
                          >
                            <Unlink className="h-4 w-4 mr-1.5" />
                            Unlink
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeletingId(search.id);
                            setDeletingType('search');
                          }}
                          className="border-red-300 text-red-600 hover:bg-red-50 font-bold px-3"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block bg-white rounded-3xl border-3 border-violet-200 shadow-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-violet-200">
                        <TableHead className="font-black text-violet-600 uppercase tracking-wide">Name</TableHead>
                        <TableHead className="font-black text-violet-600 uppercase tracking-wide">Location</TableHead>
                        <TableHead className="font-black text-violet-600 uppercase tracking-wide">Linked Site</TableHead>
                        <TableHead className="font-black text-violet-600 uppercase tracking-wide">Created</TableHead>
                        <TableHead className="text-right font-black text-violet-600 uppercase tracking-wide">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searches.map((search) => (
                        <TableRow key={search.id} className="border-b border-violet-100">
                          <TableCell className="font-bold text-gray-900">{search.name}</TableCell>
                          <TableCell className="text-gray-600 font-medium">{search.location_address || '-'}</TableCell>
                          <TableCell>
                            {search.site_id && search.site_name ? (
                              <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-300 font-bold">
                                <Building2 className="h-3 w-3 mr-1" />
                                {search.site_name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500 font-medium">
                                Not linked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-600 font-medium">{formatDate(search.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/search?saved_search=${search.id}`)}
                                className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 font-bold"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!search.site_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setLinkingId(search.id);
                                    setLinkingType('search');
                                  }}
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold"
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                              )}
                              {search.site_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnlink(search.id, 'search', search.site_id!)}
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold"
                                >
                                  <Unlink className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeletingId(search.id);
                                  setDeletingType('search');
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          {/* Sketches Tab */}
          <TabsContent value="sketches" className="space-y-4">
            {sketches.length === 0 ? (
              <div className="bg-white rounded-3xl border-3 border-blue-200 shadow-xl p-12 text-center">
                <Ruler className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No sketches yet</p>
                <p className="text-sm text-gray-500 mt-2">Create site sketches using SiteSketcher</p>
                <Button
                  onClick={() => router.push('/sitesketcher')}
                  className="mt-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl"
                >
                  <Ruler className="h-4 w-4 mr-2" />
                  Open SiteSketcher
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {sketches.map((sketch) => (
                    <div
                      key={sketch.id}
                      className="bg-white rounded-2xl border-3 border-blue-200 p-5 shadow-lg space-y-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Name</p>
                        <p className="text-base font-bold text-gray-900">{sketch.name}</p>
                      </div>

                      {sketch.description && (
                        <div>
                          <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Description</p>
                          <p className="text-sm text-gray-600 font-medium">{sketch.description}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Site</p>
                        {sketch.site_id && sketch.site_name ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 font-bold">
                            <Building2 className="h-3 w-3 mr-1" />
                            {sketch.site_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 font-medium">
                            Not linked
                          </Badge>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Created</p>
                        <p className="text-sm text-gray-600 font-medium">{formatDate(sketch.created_at)}</p>
                      </div>

                      <div className="pt-3 border-t-2 border-blue-100 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/sitesketcher?sketch=${sketch.id}`)}
                          className="flex-1 text-blue-600 border-blue-300 hover:bg-blue-50 font-bold"
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          View
                        </Button>
                        {!sketch.site_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLinkingId(sketch.id);
                              setLinkingType('sketch');
                            }}
                            className="flex-1 border-gray-300 hover:bg-gray-50 font-bold"
                          >
                            <Link2 className="h-4 w-4 mr-1.5" />
                            Link
                          </Button>
                        )}
                        {sketch.site_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnlink(sketch.id, 'sketch', sketch.site_id!)}
                            className="flex-1 border-gray-300 hover:bg-gray-50 font-bold"
                          >
                            <Unlink className="h-4 w-4 mr-1.5" />
                            Unlink
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeletingId(sketch.id);
                            setDeletingType('sketch');
                          }}
                          className="border-red-300 text-red-600 hover:bg-red-50 font-bold px-3"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block bg-white rounded-3xl border-3 border-blue-200 shadow-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-blue-200">
                        <TableHead className="font-black text-blue-600 uppercase tracking-wide">Name</TableHead>
                        <TableHead className="font-black text-blue-600 uppercase tracking-wide">Description</TableHead>
                        <TableHead className="font-black text-blue-600 uppercase tracking-wide">Linked Site</TableHead>
                        <TableHead className="font-black text-blue-600 uppercase tracking-wide">Created</TableHead>
                        <TableHead className="text-right font-black text-blue-600 uppercase tracking-wide">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sketches.map((sketch) => (
                        <TableRow key={sketch.id} className="border-b border-blue-100">
                          <TableCell className="font-bold text-gray-900">{sketch.name}</TableCell>
                          <TableCell className="text-gray-600 font-medium">{sketch.description || '-'}</TableCell>
                          <TableCell>
                            {sketch.site_id && sketch.site_name ? (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-300 font-bold">
                                <Building2 className="h-3 w-3 mr-1" />
                                {sketch.site_name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500 font-medium">
                                Not linked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-600 font-medium">{formatDate(sketch.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/sitesketcher?sketch=${sketch.id}`)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!sketch.site_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setLinkingId(sketch.id);
                                    setLinkingType('sketch');
                                  }}
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold"
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                              )}
                              {sketch.site_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnlink(sketch.id, 'sketch', sketch.site_id!)}
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold"
                                >
                                  <Unlink className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeletingId(sketch.id);
                                  setDeletingType('sketch');
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          {/* Analyses Tab */}
          <TabsContent value="analyses" className="space-y-4">
            {analyses.length === 0 ? (
              <div className="bg-white rounded-3xl border-3 border-purple-200 shadow-xl p-12 text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">No analyses yet</p>
                <p className="text-sm text-gray-500 mt-2">Create demographic analyses using SiteAnalyser</p>
                <Button
                  onClick={() => router.push('/new-dashboard/tools/site-demographer')}
                  className="mt-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold rounded-xl"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Open SiteAnalyser
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                  {analyses.map((analysis) => (
                    <div
                      key={analysis.id}
                      className="bg-white rounded-2xl border-3 border-purple-200 p-5 shadow-lg space-y-3"
                    >
                      <div>
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">Name</p>
                        <p className="text-base font-bold text-gray-900">{analysis.name}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">Location</p>
                        <p className="text-sm text-gray-600 font-medium">{analysis.location_name}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">Measurement</p>
                        <p className="text-sm text-gray-600 font-medium">{getMeasurementLabel(analysis.measurement_mode, analysis.measurement_value)}</p>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">Site</p>
                        {analysis.site_id && analysis.site_name ? (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-300 font-bold">
                            <Building2 className="h-3 w-3 mr-1" />
                            {analysis.site_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500 font-medium">
                            Not linked
                          </Badge>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">Created</p>
                        <p className="text-sm text-gray-600 font-medium">{formatDate(analysis.created_at)}</p>
                      </div>

                      <div className="pt-3 border-t-2 border-purple-100 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/new-dashboard/tools/site-demographer?analysis=${analysis.id}`)}
                          className="flex-1 text-purple-600 border-purple-300 hover:bg-purple-50 font-bold"
                        >
                          <Eye className="h-4 w-4 mr-1.5" />
                          View
                        </Button>
                        {!analysis.site_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setLinkingId(analysis.id);
                              setLinkingType('analysis');
                            }}
                            className="flex-1 border-gray-300 hover:bg-gray-50 font-bold"
                          >
                            <Link2 className="h-4 w-4 mr-1.5" />
                            Link
                          </Button>
                        )}
                        {analysis.site_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUnlink(analysis.id, 'analysis', analysis.site_id!)}
                            className="flex-1 border-gray-300 hover:bg-gray-50 font-bold"
                          >
                            <Unlink className="h-4 w-4 mr-1.5" />
                            Unlink
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeletingId(analysis.id);
                            setDeletingType('analysis');
                          }}
                          className="border-red-300 text-red-600 hover:bg-red-50 font-bold px-3"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block bg-white rounded-3xl border-3 border-purple-200 shadow-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2 border-purple-200">
                        <TableHead className="font-black text-purple-600 uppercase tracking-wide">Name</TableHead>
                        <TableHead className="font-black text-purple-600 uppercase tracking-wide">Location</TableHead>
                        <TableHead className="font-black text-purple-600 uppercase tracking-wide">Measurement</TableHead>
                        <TableHead className="font-black text-purple-600 uppercase tracking-wide">Linked Site</TableHead>
                        <TableHead className="font-black text-purple-600 uppercase tracking-wide">Created</TableHead>
                        <TableHead className="text-right font-black text-purple-600 uppercase tracking-wide">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyses.map((analysis) => (
                        <TableRow key={analysis.id} className="border-b border-purple-100">
                          <TableCell className="font-bold text-gray-900">{analysis.name}</TableCell>
                          <TableCell className="text-gray-600 font-medium">{analysis.location_name}</TableCell>
                          <TableCell className="text-gray-600 font-medium">{getMeasurementLabel(analysis.measurement_mode, analysis.measurement_value)}</TableCell>
                          <TableCell>
                            {analysis.site_id && analysis.site_name ? (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-300 font-bold">
                                <Building2 className="h-3 w-3 mr-1" />
                                {analysis.site_name}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500 font-medium">
                                Not linked
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-600 font-medium">{formatDate(analysis.created_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/new-dashboard/tools/site-demographer?analysis=${analysis.id}`)}
                                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 font-bold"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {!analysis.site_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setLinkingId(analysis.id);
                                    setLinkingType('analysis');
                                  }}
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold"
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                              )}
                              {analysis.site_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnlink(analysis.id, 'analysis', analysis.site_id!)}
                                  className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 font-bold"
                                >
                                  <Unlink className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeletingId(analysis.id);
                                  setDeletingType('analysis');
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={() => {
        setDeletingId(null);
        setDeletingType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingType}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this {deletingType}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link to Site Dialog */}
      <AlertDialog open={!!linkingId} onOpenChange={() => {
        setLinkingId(null);
        setLinkingType(null);
        setSelectedSiteId('');
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link {linkingType} to Site</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a site to link this {linkingType} to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 p-2 font-medium"
            >
              <option value="">Select a site...</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLink}
              disabled={!selectedSiteId}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Link to Site
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
