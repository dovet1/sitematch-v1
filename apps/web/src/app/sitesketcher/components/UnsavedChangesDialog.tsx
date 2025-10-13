'use client';

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

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  sketchName: string;
  onDontSave: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function UnsavedChangesDialog({
  isOpen,
  sketchName,
  onDontSave,
  onCancel,
  onSave,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save changes to "{sketchName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Your changes will be lost if you don't save them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
          <AlertDialogAction onClick={onSave} className="w-full sm:w-auto m-0">
            Save
          </AlertDialogAction>
          <AlertDialogCancel onClick={onCancel} className="w-full sm:w-auto m-0">
            Cancel
          </AlertDialogCancel>
          <AlertDialogCancel onClick={onDontSave} className="w-full sm:w-auto m-0">
            Don't Save
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
