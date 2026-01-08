// =====================================================
// Agency Submission Success Transition Component - UX Expert Design
// Smooth transition from loading to success with celebration for agency submissions
// =====================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Sparkles, ArrowRight, Home, Eye, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// =====================================================
// TYPES
// =====================================================

interface AgencySubmissionSuccessTransitionProps {
  isVisible: boolean;
  agencyId: string;
  agencyName: string;
  agencyLogo?: string;
  onViewDashboard?: () => void;
  onEditAgency?: () => void;
  onPreviewAgency?: () => void;
  autoRedirectAfter?: number; // milliseconds, 0 to disable
  className?: string;
}

// =====================================================
// AGENCY SUBMISSION SUCCESS TRANSITION COMPONENT
// =====================================================

export function AgencySubmissionSuccessTransition({
  isVisible,
  agencyId,
  agencyName,
  agencyLogo,
  onViewDashboard,
  onEditAgency,
  onPreviewAgency,
  autoRedirectAfter = 0,
  className
}: AgencySubmissionSuccessTransitionProps) {
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
            router.push(`/new-dashboard`);
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
  }, [isVisible, autoRedirectAfter, router]);

  if (!isVisible) return null;

  return (
    <div className={cn(
      'fixed inset-0 bg-gradient-to-br from-violet-500/10 via-blue-500/10 to-cyan-500/10 backdrop-blur-sm z-50 overflow-y-auto',
      'animate-in fade-in duration-500',
      className
    )}>
      {/* Celebration background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-violet-400 rounded-full animate-ping opacity-60"></div>
        <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-blue-400 rounded-full animate-ping animation-delay-1000 opacity-60"></div>
        <div className="absolute bottom-1/3 left-1/2 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping animation-delay-2000 opacity-60"></div>
        <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-purple-400 rounded-full animate-ping animation-delay-3000 opacity-60"></div>
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-indigo-400 rounded-full animate-ping animation-delay-4000 opacity-60"></div>
      </div>

      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <Card className={cn(
          'relative w-full max-w-lg bg-white/95 backdrop-blur-xl border-0 shadow-2xl',
          'transform transition-all duration-700',
          showContent ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}>
        <CardContent className="p-8 sm:p-10 text-center">
          
          {/* Success icon with celebration animation */}
          <div className="relative inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 mb-6 sm:mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-blue-400 rounded-full animate-ping opacity-25"></div>
            <div className="absolute inset-2 bg-gradient-to-r from-violet-300 to-blue-300 rounded-full animate-pulse opacity-40"></div>
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full flex items-center justify-center shadow-2xl">
              <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-sm" />
            </div>
            <Sparkles className="absolute -top-2 -right-2 w-5 h-5 sm:w-6 sm:h-6 text-amber-400 animate-bounce" />
            <Sparkles className="absolute -bottom-1 -left-1 w-3 h-3 sm:w-4 sm:h-4 text-pink-400 animate-bounce animation-delay-500" />
          </div>
          
          {/* Success message */}
          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Successfully Submitted! 🎉
            </h1>
            
            <div className="space-y-2">
              <p className="text-base sm:text-lg text-gray-700">
                Your agency profile for
              </p>
              
              {/* Agency name with optional logo */}
              <div className="flex items-center justify-center gap-3 px-4 py-3 bg-violet-50 rounded-lg border border-violet-200">
                {agencyLogo && (
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-violet-200 flex-shrink-0">
                    <Image
                      src={agencyLogo}
                      alt={`${agencyName} logo`}
                      width={32}
                      height={32}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <p className="text-lg sm:text-xl font-semibold text-violet-700">
                  {agencyName}
                </p>
              </div>
              
              <p className="text-sm sm:text-base text-gray-600">
                has been submitted for review
              </p>
            </div>
          </div>

          {/* Quick stats - Agency specific */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8 p-3 sm:p-4 bg-gradient-to-r from-violet-50 to-blue-50 rounded-xl">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-violet-600">1-2</div>
              <div className="text-xs text-violet-700">Business Days</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-blue-600">✓</div>
              <div className="text-xs text-blue-700">In Review Queue</div>
            </div>
          </div>

          {/* Action buttons - Mobile optimized */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={onViewDashboard || (() => router.push('/new-dashboard'))}
                className="w-full sm:flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white h-11 sm:h-12 shadow-lg hover:shadow-xl transition-all duration-200 group"
              >
                <Home className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Dashboard
              </Button>
              <Button
                onClick={onEditAgency || (() => router.push(`/agencies/${agencyId}/edit`))}
                variant="outline"
                className="w-full sm:flex-1 border-2 border-violet-200 text-violet-700 hover:bg-violet-50 h-11 sm:h-12 transition-all duration-200 group"
              >
                <Building2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Edit Profile
              </Button>
            </div>
            
            <Button
              onClick={onPreviewAgency}
              variant="ghost"
              className="w-full text-gray-600 hover:text-gray-800 hover:bg-gray-50 h-10 group"
            >
              Preview agency profile
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Auto-redirect countdown */}
          {autoRedirectAfter > 0 && countdown > 0 && (
            <div className="mt-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Redirecting to dashboard in <span className="font-semibold text-gray-800">{countdown}</span>s
              </p>
            </div>
          )}

          {/* Additional context for mobile */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm">What happens next?</h3>
            <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
              <li>• Our team will review your agency profile</li>
              <li>• You&apos;ll receive email updates on the review status</li>
              <li>• Once approved, your profile will be live on the directory</li>
              <li>• You can continue editing while under review</li>
            </ul>
          </div>

        </CardContent>
        </Card>
      </div>
    </div>
  );
}

// =====================================================
// HOOK FOR MANAGING AGENCY SUCCESS TRANSITION
// =====================================================

export function useAgencySuccessTransition() {
  const [isVisible, setIsVisible] = useState(false);
  const [data, setData] = useState<{
    agencyId: string;
    agencyName: string;
    agencyLogo?: string;
  } | null>(null);

  const showSuccess = (agencyId: string, agencyName: string, agencyLogo?: string) => {
    setData({ agencyId, agencyName, agencyLogo });
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