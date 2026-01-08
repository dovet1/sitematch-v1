// =====================================================
// Submission Success Transition Component - UX Expert Design
// Smooth transition from loading to success with celebration
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Sparkles, ArrowRight, Home, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// =====================================================
// TYPES
// =====================================================

interface SubmissionSuccessTransitionProps {
  isVisible: boolean;
  listingId: string;
  companyName: string;
  onViewDashboard?: () => void;
  onViewListing?: () => void;
  autoRedirectAfter?: number; // milliseconds, 0 to disable
  className?: string;
}

// =====================================================
// SUBMISSION SUCCESS TRANSITION COMPONENT
// =====================================================

export function SubmissionSuccessTransition({
  isVisible,
  listingId,
  companyName,
  onViewDashboard,
  onViewListing,
  autoRedirectAfter = 0,
  className
}: SubmissionSuccessTransitionProps) {
  const [showContent, setShowContent] = useState(false);
  const [countdown, setCountdown] = useState(autoRedirectAfter > 0 ? Math.ceil(autoRedirectAfter / 1000) : 0);
  const router = useRouter();

  useEffect(() => {
    if (!isVisible) {
      setShowContent(false);
      setCountdown(autoRedirectAfter > 0 ? Math.ceil(autoRedirectAfter / 1000) : 0);
      return;
    }

    // Show content after a brief delay for smooth transition
    const contentTimeout = setTimeout(() => {
      setShowContent(true);
    }, 200);

    // Handle auto-redirect countdown
    if (autoRedirectAfter > 0) {
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            router.push(`/occupier/success/${listingId}`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearTimeout(contentTimeout);
        clearInterval(countdownInterval);
      };
    }

    return () => {
      clearTimeout(contentTimeout);
    };
  }, [isVisible, autoRedirectAfter, listingId, router]);

  if (!isVisible) return null;

  return (
    <div className={cn(
      'fixed inset-0 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-blue-500/10 backdrop-blur-sm z-50 flex items-center justify-center p-4',
      'animate-in fade-in duration-500',
      className
    )}>
      
      {/* Celebration background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-60"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-pink-400 rounded-full animate-ping animation-delay-1000 opacity-60"></div>
        <div className="absolute bottom-1/3 left-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping animation-delay-2000 opacity-60"></div>
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-cyan-400 rounded-full animate-ping animation-delay-3000 opacity-60"></div>
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-emerald-400 rounded-full animate-ping animation-delay-4000 opacity-60"></div>
      </div>

      <Card className={cn(
        'relative w-full max-w-lg bg-white/95 backdrop-blur-xl border-0 shadow-2xl',
        'transform transition-all duration-700',
        showContent ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
      )}>
        <CardContent className="p-10 text-center">
          
          {/* Success icon with celebration animation */}
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full animate-ping opacity-25"></div>
            <div className="absolute inset-2 bg-gradient-to-r from-emerald-300 to-cyan-300 rounded-full animate-pulse opacity-40"></div>
            <div className="relative w-20 h-20 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center shadow-2xl">
              <CheckCircle className="w-10 h-10 text-white drop-shadow-sm" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-400 animate-bounce" />
            <Sparkles className="absolute -bottom-1 -left-1 w-4 h-4 text-pink-400 animate-bounce animation-delay-500" />
          </div>
          
          {/* Success message */}
          <div className="space-y-4 mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
              Successfully Submitted! 🎉
            </h1>
            
            <div className="space-y-2">
              <p className="text-lg text-gray-700">
                Your property requirement for
              </p>
              <p className="text-xl font-semibold text-emerald-700 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200 inline-block">
                {companyName}
              </p>
              <p className="text-gray-600">
                has been submitted for review
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">24-48h</div>
              <div className="text-xs text-blue-700">Review Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-600">✓</div>
              <div className="text-xs text-cyan-700">In Queue</div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                onClick={onViewDashboard || (() => router.push('/new-dashboard'))}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white h-12 shadow-lg hover:shadow-xl transition-all duration-200 group"
              >
                <Home className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Dashboard
              </Button>
              <Button
                onClick={onViewListing || (() => router.push(`/occupier/listing/${listingId}`))}
                variant="outline"
                className="flex-1 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-12 transition-all duration-200 group"
              >
                <Eye className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Preview
              </Button>
            </div>
            
            <Button
              onClick={() => router.push(`/occupier/success/${listingId}`)}
              variant="ghost"
              className="w-full text-gray-600 hover:text-gray-800 hover:bg-gray-50 h-10 group"
            >
              View full details
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Auto-redirect countdown */}
          {autoRedirectAfter > 0 && countdown > 0 && (
            <div className="mt-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Redirecting to success page in <span className="font-semibold text-gray-800">{countdown}</span>s
              </p>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

// =====================================================
// HOOK FOR MANAGING SUCCESS TRANSITION
// =====================================================

export function useSuccessTransition() {
  const [isVisible, setIsVisible] = useState(false);
  const [data, setData] = useState<{
    listingId: string;
    companyName: string;
  } | null>(null);

  const showSuccess = (listingId: string, companyName: string) => {
    setData({ listingId, companyName });
    setIsVisible(true);
  };

  const hideSuccess = () => {
    setIsVisible(false);
    setData(null);
  };

  return {
    isVisible,
    data,
    showSuccess,
    hideSuccess
  };
}