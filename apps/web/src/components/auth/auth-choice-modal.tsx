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
} from '@/components/ui/dialog';
import { UserPlus, LogIn, ArrowRight } from 'lucide-react';
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
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <SignUpModalEnhanced redirectTo={redirectTo}>
            <Button className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700">
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
              <span className="bg-background px-2 text-muted-foreground">or</span>
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
      </DialogContent>
    </Dialog>
  );
}