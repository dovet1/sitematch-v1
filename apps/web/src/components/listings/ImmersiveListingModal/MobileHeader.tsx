'use client';

import React from 'react';
import { ArrowLeft, Eye, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  companyName: string;
  companyLogo?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  onBack: () => void;
  onPreview: () => void;
  shareButton?: React.ReactNode;
}

export function MobileHeader({
  companyName,
  companyLogo,
  status,
  onBack,
  onPreview,
  shareButton
}: MobileHeaderProps) {
  // Status configuration
  const statusConfig = {
    draft: {
      icon: Clock,
      label: 'Draft',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      iconColor: 'text-gray-600'
    },
    pending: {
      icon: Clock,
      label: 'Under Review',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-800',
      iconColor: 'text-amber-600'
    },
    approved: {
      icon: CheckCircle,
      label: 'Live',
      bgColor: 'bg-green-50',
      textColor: 'text-green-800',
      iconColor: 'text-green-600'
    },
    rejected: {
      icon: XCircle,
      label: 'Needs Changes',
      bgColor: 'bg-red-50',
      textColor: 'text-red-800',
      iconColor: 'text-red-600'
    }
  };

  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="relative">
      {/* Safe area padding */}
      <div className="pt-safe-top">
        <div className="px-4 py-4">
          {/* Top row - Back button, Company info, Preview button */}
          <div className="flex items-center justify-between mb-3">
            {/* Back button */}
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>

            {/* Company branding - center */}
            <div className="flex items-center gap-3 flex-1 justify-center px-3">
              {companyLogo ? (
                <div className="relative">
                  <img
                    src={companyLogo}
                    alt={`${companyName} logo`}
                    className="w-10 h-10 object-contain rounded-xl bg-white shadow-sm border border-gray-100 p-1"
                  />
                </div>
              ) : (
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-white font-bold text-base">
                      {companyName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <h1 className="font-bold text-gray-900 text-lg tracking-tight truncate max-w-[180px]">
                  {companyName}
                </h1>
                <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Listing Management</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Share button (if provided) */}
              {shareButton}
              
              {/* Preview button */}
              <button
                onClick={onPreview}
                className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-50 to-violet-100/50 hover:from-violet-100 hover:to-violet-100 active:from-violet-200 active:to-violet-200 transition-all duration-200"
                style={{ touchAction: 'manipulation' }}
              >
                <Eye className="w-5 h-5 text-violet-700" />
              </button>
            </div>
          </div>

          {/* Bottom row - Status badge */}
          <div className="flex items-center justify-center">
            <div className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm",
              status === 'draft' && 'bg-gray-100 text-gray-700',
              status === 'pending' && 'bg-amber-50 text-amber-700 border border-amber-200/50',
              status === 'approved' && 'bg-emerald-50 text-emerald-700 border border-emerald-200/50',
              status === 'rejected' && 'bg-red-50 text-red-700 border border-red-200/50'
            )}>
              <StatusIcon className={cn(
                "w-3.5 h-3.5",
                status === 'draft' && 'text-gray-500',
                status === 'pending' && 'text-amber-600',
                status === 'approved' && 'text-emerald-600',
                status === 'rejected' && 'text-red-600'
              )} />
              <span>{statusInfo.label}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}