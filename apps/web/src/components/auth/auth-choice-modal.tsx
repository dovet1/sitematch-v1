'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import { UserPlus, LogIn, ArrowRight, Lock } from 'lucide-react';
import { SignUpModalEnhanced } from './signup-modal-enhanced';
import { LoginModal } from './login-modal';

interface AuthChoiceModalProps {
  children: React.ReactNode;
  redirectTo?: string;
  title?: string;
  description?: string;
}

export function AuthChoiceModal({
  children,
  redirectTo,
  title = "Sign in to continue",
  description = "Choose how you'd like to access your account"
}: AuthChoiceModalProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="sm:max-w-[420px] max-h-[85vh] overflow-y-auto p-0 bg-gradient-to-br from-white via-violet-50/20 to-white !border-0 !outline-0 !ring-0 shadow-2xl [&>button]:absolute [&>button]:right-4 [&>button]:top-4 [&>button]:z-50 [&>button]:h-10 [&>button]:w-10 [&>button]:rounded-xl [&>button]:bg-white/10 [&>button]:backdrop-blur-sm [&>button]:border [&>button]:border-white/20 [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:hover:border-white/30 [&>button]:transition-all [&>button]:duration-200 [&>button]:flex [&>button]:items-center [&>button]:justify-center">
          {/* Premium Header with Violet Bloom Gradient */}
          <div className="relative px-8 pt-8 pb-6 bg-gradient-to-r from-violet-900 via-purple-800 to-violet-900 text-white overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/30 via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-500/25 via-transparent to-transparent opacity-60" />
            <div className="relative">
              <DialogHeader className="space-y-3 text-center">
                <div className="mx-auto w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2">
                  <Lock className="h-6 w-6 text-white" />
                </div>
                <DialogTitle className="text-2xl font-bold tracking-tight text-white">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-slate-200 text-base leading-relaxed max-w-md mx-auto">
                  {description}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            <div className="space-y-4">
              <SignUpModalEnhanced redirectTo={redirectTo}>
                <Button className="w-full h-12 text-base font-medium bg-violet-600 hover:bg-violet-700">
                  <UserPlus className="mr-2 h-5 w-5" />
                  Create new account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </SignUpModalEnhanced>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <LoginModal redirectTo={redirectTo}>
                <Button
                  variant="outline"
                  className="w-full h-12 text-base font-medium border-2"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign in to existing account
                </Button>
              </LoginModal>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6">
              By continuing, you agree to our{' '}
              <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=0d60ea82-ecb7-43d4-bf2d-a3ea5a0900c6" className="underline hover:text-primary">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="https://app.termly.io/policy-viewer/policy.html?policyUUID=70f2f9d5-072f-443a-944d-39630c45252c" className="underline hover:text-primary">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
