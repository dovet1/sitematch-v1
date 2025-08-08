'use client'

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMobileBreakpoint } from '@/components/listings/ImmersiveListingModal/hooks/useMobileBreakpoint';

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
  const { isMobileUI } = useMobileBreakpoint();
  
  if (!isOpen) return null;

  const handleCancel = () => {
    if (onCancel) onCancel();
    onClose();
  };

  const handleSave = () => {
    if (onSave) onSave();
  };

  return (
    <div className="fixed inset-0 z-[10002] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
        onClick={isMobileUI ? undefined : onClose}
      />
      
      {/* Modal */}
      <div className={cn(
        "flex items-center justify-center min-h-screen",
        isMobileUI ? "p-0" : "p-4"
      )}>
        <div className={cn(
          "relative bg-white shadow-xl w-full flex flex-col",
          isMobileUI 
            ? "h-screen md:h-auto md:max-h-[calc(100vh-8rem)] md:rounded-lg"
            : "max-w-2xl max-h-[90vh] overflow-hidden rounded-lg",
          className
        )}>
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between border-b border-gray-200 flex-shrink-0",
            isMobileUI ? "p-4 pt-safe-top" : "p-6"
          )}>
            <h2 className={cn(
              "font-semibold text-gray-900",
              isMobileUI ? "text-lg" : "text-xl"
            )}>{title}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className={cn(
                "rounded-full transition-all hover:bg-gray-100 active:scale-95",
                isMobileUI ? "p-3 -mr-1" : "p-2"
              )}
            >
              <X className={cn(isMobileUI ? "w-6 h-6" : "w-5 h-5")} />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>

          {/* Actions */}
          {showActions && (
            <div className={cn(
              "flex items-center gap-3 border-t border-gray-200 bg-gray-50 flex-shrink-0",
              isMobileUI 
                ? "p-4 pb-safe-bottom justify-stretch" 
                : "p-6 justify-end"
            )}>
              {isMobileUI ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex-1 h-12 text-base font-medium"
                  >
                    {cancelButtonText}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 h-12 text-base font-medium bg-violet-600 hover:bg-violet-700 text-white transition-all active:scale-95"
                  >
                    {isSaving ? 'Saving...' : saveButtonText}
                  </Button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}