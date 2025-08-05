'use client'

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BaseCrudModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave?: () => void;
  onCancel?: () => void;
  saveButtonText?: string;
  cancelButtonText?: string;
  showActions?: boolean;
  isSaving?: boolean;
  className?: string;
}

export function BaseCrudModal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  onSave,
  onCancel,
  saveButtonText = "Save",
  cancelButtonText = "Cancel",
  showActions = true,
  isSaving = false,
  className
}: BaseCrudModalProps) {
  if (!isOpen) return null;

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  const handleSave = () => {
    if (onSave) onSave();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={cn(
          "relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden",
          className
        )}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto max-h-[calc(90vh-140px)]">
            {children}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                {cancelButtonText}
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {isSaving ? 'Saving...' : saveButtonText}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}