'use client';

import { useState, useEffect } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Loader2, Trash2, Download } from 'lucide-react';

interface SavedSketch {
  id: string;
  name: string;
  updated_at: string;
  data: any;
}

export function SavedSketchesPanel() {
  const { sketchId, loadSketch } = useSketchStore();
  const [sketches, setSketches] = useState<SavedSketch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sketches on mount
  useEffect(() => {
    fetchSketches();
  }, []);

  const fetchSketches = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/sitesketcher-v2/sketches');

      if (response.status === 401) {
        setError('Please sign in to access saved sketches');
        setLoading(false);
        return;
      }

      if (response.status === 403) {
        const errorData = await response.json();
        setError(errorData.error || 'Pro subscription required to access saved sketches');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API error:', response.status, errorData);
        setError(errorData.error || 'Failed to load sketches');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setSketches(data.sketches || []);
    } catch (err) {
      console.error('Error fetching sketches:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sketches');
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (sketch: SavedSketch) => {
    try {
      const response = await fetch(`/api/sitesketcher-v2/sketches/${sketch.id}`);

      if (!response.ok) {
        throw new Error('Failed to load sketch');
      }

      const data = await response.json();
      loadSketch(data.sketch);
    } catch (err) {
      console.error('Error loading sketch:', err);
      alert('Failed to load sketch');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/sitesketcher-v2/sketches/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete sketch');
      }

      // Refresh list
      fetchSketches();
    } catch (err) {
      console.error('Error deleting sketch:', err);
      alert('Failed to delete sketch');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-sm-ink mb-1">Saved Sketches</h3>
        <p className="text-xs text-sm-ink/60">
          Load or manage your saved sketches
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-sm-violet animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-center py-8">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          {error.includes('Pro subscription') && (
            <button className="text-xs text-sm-violet hover:underline">
              Upgrade to Pro
            </button>
          )}
        </div>
      )}

      {!loading && !error && sketches.length === 0 && (
        <div className="text-center py-8 text-sm text-sm-ink/50">
          No saved sketches yet
          <br />
          <span className="text-xs">Create and save a sketch to see it here</span>
        </div>
      )}

      {!loading && !error && sketches.length > 0 && (
        <div className="space-y-1">
          {sketches.map((sketch) => {
            const isActive = sketchId === sketch.id;
            const polygonCount = sketch.data?.polygons?.length || 0;
            const parkingCount = sketch.data?.parkingBlocks?.length || 0;

            return (
              <div
                key={sketch.id}
                className={`
                  flex items-center gap-2 p-3 rounded border transition-all
                  ${
                    isActive
                      ? 'bg-sm-violet/10 border-sm-violet'
                      : 'hover:bg-sm-bg border-sm-border'
                  }
                `}
              >
                <button
                  onClick={() => handleLoad(sketch)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="text-sm font-medium text-sm-ink truncate">
                    {sketch.name}
                  </div>
                  <div className="text-xs text-sm-ink/60 flex items-center gap-2 mt-1">
                    <span>{formatDate(sketch.updated_at)}</span>
                    <span>•</span>
                    <span>{polygonCount} polygon{polygonCount !== 1 ? 's' : ''}</span>
                    {parkingCount > 0 && (
                      <>
                        <span>•</span>
                        <span>{parkingCount} parking</span>
                      </>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => handleDelete(sketch.id, sketch.name)}
                  className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
