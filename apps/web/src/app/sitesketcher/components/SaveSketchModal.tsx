'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface SaveSketchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
  initialName?: string;
  initialDescription?: string;
  mode?: 'save' | 'update';
}

export function SaveSketchModal({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  initialDescription = '',
  mode = 'save',
}: SaveSketchModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name for your sketch');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save sketch');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setName('');
      setDescription('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'save' ? 'Save Sketch' : 'Update Sketch'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'save'
              ? 'Give your sketch a name to save it for later'
              : 'Update the name or description of your sketch'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sketch-name">Name *</Label>
            <Input
              id="sketch-name"
              placeholder="My Site Sketch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sketch-description">Description (Optional)</Label>
            <Textarea
              id="sketch-description"
              placeholder="Add notes about this sketch..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              mode === 'save' ? 'Save' : 'Update'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
