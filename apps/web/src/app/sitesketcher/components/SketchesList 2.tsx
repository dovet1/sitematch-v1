'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Trash2, Copy, FileText, Clock } from 'lucide-react';
import type { SavedSketch } from '@/types/sitesketcher';
import { fetchSketches, deleteSketch, duplicateSketch } from '@/lib/sitesketcher/sketch-service';
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

interface SketchesListProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSketch: (sketch: SavedSketch) => void;
}

export function SketchesList({ isOpen, onClose, onLoadSketch }: SketchesListProps) {
  const [sketches, setSketches] = useState<SavedSketch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSketches();
    }
  }, [isOpen]);

  const loadSketches = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchSketches();
      setSketches(data);
    } catch (err) {
      setError('Failed to load sketches');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteSketch(id);
      setSketches(sketches.filter(s => s.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError('Failed to delete sketch');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setActionLoading(id);
    try {
      const newSketch = await duplicateSketch(id);
      setSketches([newSketch, ...sketches]);
    } catch (err) {
      setError('Failed to duplicate sketch');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>My Sketches</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[60vh]">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="text-center py-8">
                <p className="text-destructive text-sm">{error}</p>
                <Button
                  variant="outline"
                  onClick={loadSketches}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            )}

            {!isLoading && !error && sketches.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No saved sketches yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create a drawing and save it to see it here
                </p>
              </div>
            )}

            {!isLoading && !error && sketches.length > 0 && (
              <div className="space-y-3">
                {sketches.map((sketch) => (
                  <Card
                    key={sketch.id}
                    className="hover:border-primary transition-colors cursor-pointer"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className="flex-1 min-w-0"
                          onClick={() => {
                            onLoadSketch(sketch);
                            onClose();
                          }}
                        >
                          <h3 className="font-semibold truncate">
                            {sketch.name}
                          </h3>
                          {sketch.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {sketch.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(sketch.updated_at)}
                            </span>
                            <span>{sketch.data.polygons.length} polygons</span>
                            {sketch.data.parkingOverlays.length > 0 && (
                              <span>{sketch.data.parkingOverlays.length} parking</span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicate(sketch.id)}
                            disabled={actionLoading === sketch.id}
                            title="Duplicate"
                          >
                            {actionLoading === sketch.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(sketch.id)}
                            disabled={actionLoading === sketch.id}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sketch?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the sketch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
