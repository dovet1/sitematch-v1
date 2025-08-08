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
}

export function MobileHeader({
  companyName,
  companyLogo,
  status,
  onBack,
  onPreview
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
    <div className="relative bg-white/95 backdrop-blur-sm border-b border-white/20 shadow-sm">
      {/* Safe area padding */}
      <div className="pt-safe-top">
        <div className="px-4 py-3">
          {/* Top row - Back button, Company info, Preview button */}
          <div className="flex items-center justify-between mb-3">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-gray-700 hover:text-gray-900 hover:bg-white/50 transition-colors p-2 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            {/* Company branding - center */}
            <div className="flex items-center gap-3 flex-1 justify-center px-4">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt={`${companyName} logo`}
                  className="w-8 h-8 object-contain rounded-md bg-white shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-600 rounded-md flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-sm">
                    {companyName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <h1 className="font-semibold text-gray-900 text-lg truncate max-w-[180px]">
                {companyName}
              </h1>
            </div>

            {/* Preview button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreview}
              className="text-violet-600 hover:text-violet-700 hover:bg-violet-50 transition-colors p-2 rounded-lg"
            >
              <Eye className="w-5 h-5" />
            </Button>
          </div>

          {/* Bottom row - Status and tabs will go here */}
          <div className="flex items-center justify-center">
            {/* Status badge */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm",
              statusInfo.bgColor
            )}>
              <StatusIcon className={cn("w-4 h-4", statusInfo.iconColor)} />
              <span className={cn("text-sm font-medium", statusInfo.textColor)}>
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}