'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Save,
  FolderOpen,
  FilePlus,
  FileX,
  Download,
  History,
  Copy,
  Pencil,
  Menu
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface DocumentBarProps {
  sketchName: string;
  hasUnsavedChanges: boolean;
  onRenameSketch: (name: string) => void;
  onNewSketch: () => void;
  onOpenSketch: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCloseSketch: () => void;
  onExportPNG: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onShowVersionHistory?: () => void;
  isSaving?: boolean;
  className?: string;
}

export function DocumentBar({
  sketchName,
  hasUnsavedChanges,
  onRenameSketch,
  onNewSketch,
  onOpenSketch,
  onSave,
  onSaveAs,
  onCloseSketch,
  onExportPNG,
  onExportJSON,
  onExportCSV,
  onExportPDF,
  onShowVersionHistory,
  isSaving = false,
  className = '',
}: DocumentBarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(sketchName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedName(sketchName);
  }, [sketchName]);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = () => {
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== sketchName) {
      onRenameSketch(trimmed);
    } else {
      setEditedName(sketchName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setEditedName(sketchName);
      setIsEditingName(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          onSaveAs();
        } else {
          onSave();
        }
      } else if (modKey && e.key === 'n') {
        e.preventDefault();
        onNewSketch();
      } else if (modKey && e.key === 'o') {
        e.preventDefault();
        onOpenSketch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onSaveAs, onNewSketch, onOpenSketch]);

  return (
    <div className={`flex items-center gap-2 px-4 py-2 bg-background border-b ${className}`}>
      {/* Document Name with Unsaved Indicator */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />

        {isEditingName ? (
          <Input
            ref={inputRef}
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleNameKeyDown}
            className="h-7 max-w-xs"
          />
        ) : (
          <button
            onClick={handleNameClick}
            className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors truncate group"
            title="Click to rename"
          >
            <span className="truncate">{sketchName}</span>
            <Pencil className="h-3 w-3 text-muted-foreground group-hover:text-primary flex-shrink-0" />
          </button>
        )}

        {hasUnsavedChanges && !isSaving && (
          <span className="text-orange-500 text-lg leading-none flex-shrink-0" title="Unsaved changes">
            ●
          </span>
        )}

        {isSaving && (
          <span className="text-blue-500 text-sm flex-shrink-0 animate-pulse">
            Saving...
          </span>
        )}
      </div>

      {/* File Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="File menu">
            <Menu className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onNewSketch}>
            <FilePlus className="mr-2 h-4 w-4" />
            New Sketch
            <span className="ml-auto text-xs text-muted-foreground">⌘N</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onOpenSketch}>
            <FolderOpen className="mr-2 h-4 w-4" />
            Open...
            <span className="ml-auto text-xs text-muted-foreground">⌘O</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={onSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            <Save className="mr-2 h-4 w-4" />
            Save
            <span className="ml-auto text-xs text-muted-foreground">⌘S</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onSaveAs}>
            <Copy className="mr-2 h-4 w-4" />
            Save As...
            <span className="ml-auto text-xs text-muted-foreground">⌘⇧S</span>
          </DropdownMenuItem>

          {onShowVersionHistory && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onShowVersionHistory}>
                <History className="mr-2 h-4 w-4" />
                Version History
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onCloseSketch}>
            <FileX className="mr-2 h-4 w-4" />
            Close Sketch
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
