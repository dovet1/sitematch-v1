'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Ruler, Plus, Eye, Trash2, Link2, Loader2 } from 'lucide-react';
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

interface Sketch {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  created_at: string;
}

interface SiteSketchesSectionProps {
  siteId: string;
  siteName: string;
  siteAddress: string;
  siteLocation?: { lat: number; lng: number };
  sketches: Sketch[];
  onUpdate?: () => void;
}

export function SiteSketchesSection({
  siteId,
  siteName,
  siteAddress,
  siteLocation,
  sketches,
  onUpdate
}: SiteSketchesSectionProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [availableSketches, setAvailableSketches] = useState<Sketch[]>([]);
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

    router.push(`/sitesketcher?${params.toString()}`);
  };

  const handleViewSketch = (sketchId: string) => {
    router.push(`/sitesketcher?sketch=${sketchId}`);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      const response = await fetch(`/api/sites/${siteId}/sketches?sketch_id=${deletingId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to unlink sketch');

      toast.success('Sketch unlinked from site');
      setDeletingId(null);
      onUpdate?.();
    } catch (error) {
      console.error('Error unlinking sketch:', error);
      toast.error('Failed to unlink sketch');
    }
  };

  const fetchAvailableSketches = async () => {
    try {
      const response = await fetch('/api/sitesketcher/sketches');
      if (!response.ok) throw new Error('Failed to fetch sketches');

      const data = await response.json();
      // Filter out sketches already attached
      const attachedIds = new Set(sketches.map(s => s.id));
      setAvailableSketches(data.sketches.filter((s: Sketch) => !attachedIds.has(s.id)));
    } catch (error) {
      console.error('Error fetching sketches:', error);
      toast.error('Failed to load sketches');
    }
  };

  const handleLinkSketch = async (sketchId: string) => {
    setLinkingId(sketchId);

    try {
      const response = await fetch(`/api/sites/${siteId}/sketches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sketch_id: sketchId })
      });

      if (!response.ok) throw new Error('Failed to link sketch');

      toast.success('Sketch linked successfully');
      setShowLinkModal(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error linking sketch:', error);
      toast.error('Failed to link sketch');
    } finally {
      setLinkingId(null);
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
          <h2 className="text-2xl font-black text-gray-900">Site Plans</h2>
          <p className="text-sm text-gray-600 mt-1">Visual sketches and plans created for this site</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              fetchAvailableSketches();
              setShowLinkModal(true);
            }}
            variant="outline"
            className="border-2 border-blue-300 hover:bg-blue-50 text-blue-700 font-bold rounded-xl hidden sm:flex"
          >
            <Link2 className="h-4 w-4 mr-2" />
            Link Existing
          </Button>
          <Button
            onClick={handleCreateNew}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Create New</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Sketches Grid */}
      {sketches.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl border-3 border-blue-200">
          <Ruler className="h-16 w-16 text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-black text-gray-900 mb-2">No Sketches Yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Create visual plans and sketches to explore different layouts for this site
          </p>
          <Button
            onClick={handleCreateNew}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Your First Sketch
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sketches.map((sketch) => (
            <div
              key={sketch.id}
              className="bg-white rounded-2xl border-3 border-blue-200 overflow-hidden shadow-md hover:shadow-xl transition-all group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center">
                {sketch.thumbnail_url ? (
                  <img
                    src={sketch.thumbnail_url}
                    alt={sketch.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Ruler className="h-12 w-12 text-blue-400" />
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleViewSketch(sketch.id)}
                    className="bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeletingId(sketch.id)}
                    className="bg-red-600 hover:bg-red-700 font-bold rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-black text-gray-900 mb-1 line-clamp-1">{sketch.name}</h3>
                {sketch.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{sketch.description}</p>
                )}
                <p className="text-xs text-gray-500">Created {formatDate(sketch.created_at)}</p>
              </div>

              {/* Mobile Actions */}
              <div className="sm:hidden p-4 pt-0 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleViewSketch(sketch.id)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeletingId(sketch.id)}
                  className="border-2 border-red-300 text-red-600 hover:bg-red-50 font-bold rounded-xl"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link Sketch Modal */}
      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Link Existing Sketch</DialogTitle>
          </DialogHeader>

          {availableSketches.length === 0 ? (
            <div className="text-center py-8">
              <Ruler className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No available sketches to link</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableSketches.map((sketch) => (
                <div
                  key={sketch.id}
                  className="bg-white rounded-xl border-2 border-blue-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 mb-1">{sketch.name}</h4>
                      {sketch.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{sketch.description}</p>
                      )}
                    </div>
                    <Button
                      onClick={() => handleLinkSketch(sketch.id)}
                      disabled={linkingId === sketch.id}
                      className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold rounded-xl"
                    >
                      {linkingId === sketch.id ? (
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
            <AlertDialogTitle>Unlink Sketch?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the sketch from this site. The sketch itself will not be deleted.
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
