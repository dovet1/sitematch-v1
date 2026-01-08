'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Plus, Eye, Trash2, Users, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
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

interface Analysis {
  id: string;
  name: string;
  location_name: string;
  measurement_mode: string;
  measurement_value: number;
  created_at: string;
}

interface SiteAnalysesSectionProps {
  siteId: string;
  siteName: string;
  siteAddress: string;
  siteLocation?: { lat: number; lng: number };
  analyses: Analysis[];
  onUpdate?: () => void;
}

export function SiteAnalysesSection({
  siteId,
  siteName,
  siteAddress,
  siteLocation,
  analyses,
  onUpdate
}: SiteAnalysesSectionProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [availableAnalyses, setAvailableAnalyses] = useState<Analysis[]>([]);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const handleCreateNew = () => {
    const params = new URLSearchParams({
      site_id: siteId,
      site_name: siteName,
    });

    if (siteLocation) {
      params.append('address', siteAddress);
      params.append('lat', siteLocation.lat.toString());
      params.append('lng', siteLocation.lng.toString());
    }

    router.push(`/new-dashboard/tools/site-demographer?${params.toString()}`);
  };

  const handleViewAnalysis = (analysisId: string) => {
    router.push(`/new-dashboard/tools/site-demographer?analysis=${analysisId}`);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const response = await fetch(`/api/sites/${siteId}/analyses?analysis_id=${deletingId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to unlink analysis');

      toast.success('Analysis unlinked from site');
      setDeletingId(null);
      onUpdate?.();
    } catch (error) {
      console.error('Error unlinking analysis:', error);
      toast.error('Failed to unlink analysis');
    }
  };

  const fetchAvailableAnalyses = async () => {
    try {
      const response = await fetch('/api/demographic-analyses');
      if (!response.ok) throw new Error('Failed to fetch analyses');

      const data = await response.json();
      // Filter out analyses already attached
      const attachedIds = new Set(analyses.map(a => a.id));
      setAvailableAnalyses(data.analyses.filter((a: Analysis) => !attachedIds.has(a.id)));
    } catch (error) {
      console.error('Error fetching analyses:', error);
      toast.error('Failed to load analyses');
    }
  };

  const handleLinkAnalysis = async (analysisId: string) => {
    setLinkingId(analysisId);

    try {
      const response = await fetch(`/api/sites/${siteId}/analyses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis_id: analysisId })
      });

      if (!response.ok) throw new Error('Failed to link analysis');

      toast.success('Analysis linked successfully');
      setShowLinkModal(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error linking analysis:', error);
      toast.error('Failed to link analysis');
    } finally {
      setLinkingId(null);
    }
  };

  const formatMeasurement = (mode: string, value: number) => {
    if (mode === 'distance') {
      return `${value} mile${value !== 1 ? 's' : ''}`;
    } else if (mode === 'drive_time') {
      return `${value} min drive`;
    } else {
      return `${value} min walk`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900">Market Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">Demographic and catchment area analyses for this site</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              fetchAvailableAnalyses();
              setShowLinkModal(true);
            }}
            variant="outline"
            className="border-2 border-purple-300 hover:bg-purple-50 text-purple-700 font-bold rounded-xl hidden sm:flex"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Link Existing
          </Button>
          <Button
            onClick={handleCreateNew}
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Create New</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Analyses Grid */}
      {analyses.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-violet-50 rounded-3xl border-3 border-purple-200">
          <BarChart3 className="h-16 w-16 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-900 mb-2">No Analyses Yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Run location analyses to understand the catchment area and target market for this site
          </p>
          <Button
            onClick={handleCreateNew}
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold rounded-xl shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Analysis
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyses.map((analysis) => (
            <div
              key={analysis.id}
              className="bg-white rounded-2xl border-3 border-purple-200 overflow-hidden shadow-md hover:shadow-xl transition-all group cursor-pointer"
              onClick={() => handleViewAnalysis(analysis.id)}
            >
              {/* Header with gradient */}
              <div className="bg-gradient-to-br from-purple-100 to-violet-100 p-5 border-b-2 border-purple-200">
                <div className="flex items-start justify-between mb-3">
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(analysis.id);
                    }}
                    className="hover:bg-purple-200 text-purple-700 font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="font-black text-gray-900 text-lg line-clamp-2">{analysis.name}</h3>
              </div>

              {/* Content */}
              <div className="p-5 space-y-3">
                {/* Location */}
                <div>
                  <p className="text-xs font-bold text-purple-600 uppercase mb-1">Location</p>
                  <p className="text-sm text-gray-700 line-clamp-1">{analysis.location_name}</p>
                </div>

                {/* Catchment */}
                <div>
                  <p className="text-xs font-bold text-purple-600 uppercase mb-1">Catchment Area</p>
                  <Badge className="bg-purple-600 text-white font-bold">
                    {formatMeasurement(analysis.measurement_mode, analysis.measurement_value)}
                  </Badge>
                </div>

                {/* Date */}
                <div className="pt-3 border-t-2 border-purple-100">
                  <p className="text-xs text-gray-500">Created {formatDate(analysis.created_at)}</p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="border-t-2 border-purple-100 p-4 bg-purple-50/50">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewAnalysis(analysis.id);
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Full Analysis
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Analysis Modal */}
      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Link Existing Analysis</DialogTitle>
          </DialogHeader>

          {availableAnalyses.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No available analyses to link</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableAnalyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="bg-white rounded-xl border-2 border-purple-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{analysis.name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{analysis.location_name}</p>
                      <Badge className="bg-purple-600 text-white font-bold text-xs">
                        {formatMeasurement(analysis.measurement_mode, analysis.measurement_value)}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => handleLinkAnalysis(analysis.id)}
                      disabled={linkingId === analysis.id}
                      className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white font-bold rounded-xl"
                    >
                      {linkingId === analysis.id ? (
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the analysis from this site. The analysis itself will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
