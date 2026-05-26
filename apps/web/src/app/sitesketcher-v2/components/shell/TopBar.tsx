'use client';

import { useState, useEffect } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { Button } from '../primitives';
import {
  Save,
  Undo2,
  Redo2,
  Search,
  ChevronRight,
  Home,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

export function TopBar() {
  const {
    sketchId,
    sketchName,
    isDirty,
    lastSaved,
    canUndo,
    canRedo,
    undo,
    redo,
    getSketchData,
    setSketchName,
    setSketchId,
    setLastSaved,
    markClean,
  } = useSketchStore();

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);

    try {
      const data = getSketchData();

      if (sketchId) {
        // Update existing sketch
        const response = await fetch(`/api/sitesketcher-v2/sketches/${sketchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sketchName,
            data,
          }),
        });

        if (response.status === 403) {
          const error = await response.json();
          alert(error.error || 'Pro subscription required to save');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to save sketch');
        }

        const result = await response.json();
        setLastSaved(new Date(result.sketch.updated_at));
        markClean();
      } else {
        // Create new sketch - prompt for name
        const name = prompt('Enter sketch name:', sketchName);
        if (!name) {
          return;
        }

        const response = await fetch('/api/sitesketcher-v2/sketches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            data,
          }),
        });

        if (response.status === 403) {
          const error = await response.json();
          alert(error.error || 'Pro subscription required to save');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to create sketch');
        }

        const result = await response.json();
        setSketchId(result.sketch.id);
        setSketchName(result.sketch.name);
        setLastSaved(new Date(result.sketch.updated_at));
        markClean();
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save sketch. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {
    if (canUndo()) undo();
  };

  const handleRedo = () => {
    if (canRedo()) redo();
  };

  // Auto-save effect
  useEffect(() => {
    // Only auto-save if sketch already exists (has ID)
    if (!sketchId || !isDirty || saving) return;

    const timer = setTimeout(async () => {
      try {
        const data = getSketchData();

        const response = await fetch(`/api/sitesketcher-v2/sketches/${sketchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sketchName, data }),
        });

        if (response.ok) {
          const result = await response.json();
          setLastSaved(new Date(result.sketch.updated_at));
          markClean();
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
        // Silent failure - manual save still works
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [isDirty, sketchId, sketchName, saving, getSketchData, setLastSaved, markClean]);

  return (
    <div className="h-14 bg-sm-surface border-b border-sm-border flex items-center justify-between px-4 flex-shrink-0">
      {/* Left: Logo + Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
        >
          <div className="w-8 h-8 bg-sm-violet rounded-lg flex items-center justify-center">
            <Home className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-sm-ink">CD</span>
        </Link>

        <ChevronRight className="w-4 h-4 text-sm-ink/30" />

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-sm-ink">
            {sketchName}
          </span>
          {isDirty && (
            <span className="w-2 h-2 bg-sm-violet rounded-full" title="Unsaved changes" />
          )}
        </div>

        {lastSaved && !isDirty && (
          <span className="text-xs text-sm-ink/50">
            Saved {formatTimeSince(lastSaved)}
          </span>
        )}
      </div>

      {/* Center: Search (placeholder for now) */}
      <div className="flex-1 max-w-md mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sm-ink/40" />
          <input
            type="text"
            placeholder="Search location..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-sm-bg border border-sm-border rounded-lg focus:outline-none focus:border-sm-violet transition-colors"
          />
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<Undo2 className="w-4 h-4" />}
            onClick={handleUndo}
            disabled={!canUndo()}
            title="Undo (⌘Z)"
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<Redo2 className="w-4 h-4" />}
            onClick={handleRedo}
            disabled={!canRedo()}
            title="Redo (⌘⇧Z)"
          />
        </div>

        <Button
          size="md"
          variant="primary"
          icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function formatTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
