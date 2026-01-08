'use client';

import { Check, Sparkles, ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface AlreadySubscribedModalProps {
  open: boolean;
  onClose: () => void;
  subscriptionStatus: 'trialing' | 'active';
}

export function AlreadySubscribedModal({
  open,
  onClose,
  subscriptionStatus
}: AlreadySubscribedModalProps) {
  const isTrialing = subscriptionStatus === 'trialing';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] p-0 bg-gradient-to-br from-white via-violet-50/20 to-white !border-0 shadow-2xl">
        {/* Header with celebration gradient */}
        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 text-white overflow-hidden">
          <DialogHeader className="relative space-y-3 text-center">
            <div className="mx-auto w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2">
              <Check className="h-8 w-8 text-white" strokeWidth={3} />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight text-white">
              You're Already a Pro Member! 🎉
            </DialogTitle>
            <DialogDescription className="text-violet-100 text-base">
              {isTrialing
                ? "Your free trial is active and you have full access to all Pro features"
                : "Your subscription is active and you have full access to all Pro features"
              }
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-6">
          {/* Features you have access to */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              ✨ Your Pro Benefits:
            </h3>
            <ul className="space-y-2.5">
              {[
                'Browse 1000s of verified requirements',
                'SiteSketcher access',
                'Create an agency profile',
                'Priority support'
              ].map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                  </div>
                  <span className="text-sm text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              asChild
              className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <Link href="/new-dashboard">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full h-11 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100"
            >
              Close
            </Button>
          </div>

          {/* Help text */}
          <div className="pt-2 text-center">
            <p className="text-xs text-gray-500">
              Questions about your subscription?{' '}
              <a
                href="mailto:rob@sitematcher.co.uk"
                className="text-violet-600 hover:text-violet-700 font-medium hover:underline"
              >
                Contact support
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
