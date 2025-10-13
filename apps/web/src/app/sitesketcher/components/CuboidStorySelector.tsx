'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import { STORY_HEIGHTS } from '@/types/sitesketcher';

interface CuboidStorySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stories: 1 | 2 | 3) => void;
}

export function CuboidStorySelector({ isOpen, onClose, onSelect }: CuboidStorySelectorProps) {
  const [selectedStories, setSelectedStories] = useState<1 | 2 | 3>(1);

  const handleConfirm = () => {
    onSelect(selectedStories);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Select Building Height
          </DialogTitle>
          <DialogDescription>
            Choose the number of stories for this 3D building
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Story Options */}
          <div className="grid grid-cols-3 gap-3">
            {([1, 2, 3] as const).map((stories) => (
              <button
                key={stories}
                onClick={() => setSelectedStories(stories)}
                className={`
                  flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                  ${selectedStories === stories
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                  }
                `}
              >
                <div className="text-3xl font-bold text-primary">{stories}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stories === 1 ? 'Story' : 'Stories'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ({STORY_HEIGHTS[stories]}m)
                </div>
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p>
              <strong>Selected:</strong> {selectedStories} {selectedStories === 1 ? 'story' : 'stories'}
              ({STORY_HEIGHTS[selectedStories]} meters high)
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Create 3D Building
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
