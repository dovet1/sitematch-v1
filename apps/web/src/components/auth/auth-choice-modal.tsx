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
import { UserPlus, LogIn, ArrowRight, ChevronLeft } from 'lucide-react';

// Import the form components directly
import { useForm } from 'react-hook-form';
import { Mail, Loader2, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { UserType } from '@/types/auth';

interface AuthChoiceModalProps {
  children: React.ReactNode;
  redirectTo?: string;
  title?: string;
  description?: string;
}

type AuthMode = 'choice' | 'login' | 'signup-step1' | 'signup-step2';

interface LoginFormData {
  email: string;
  password: string;
}

interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
  userType: UserType;
}

const userTypes: { value: UserType; label: string; description: string }[] = [
  { value: 'Commercial Occupier', label: 'Commercial Occupier', description: 'Looking for office or retail space' },
  { value: 'Landlord/Vendor', label: 'Landlord/Vendor', description: 'Property owner or seller' },
  { value: 'Developer', label: 'Developer', description: 'Property developer' },
  { value: 'Housebuilder', label: 'Housebuilder', description: 'Residential developer' },
  { value: 'Consultant', label: 'Consultant', description: 'Property consultant or advisor' },
  { value: 'Government', label: 'Government', description: 'Government or public sector' },
  { value: 'Other', label: 'Other', description: 'Other type of user' },
];

export function AuthChoiceModal({ 
  children, 
  redirectTo,
  title = "Sign in to continue",
  description = "Choose how you'd like to access your account"
}: AuthChoiceModalProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('choice');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const { signIn, signUp } = useAuth();

  const loginForm = useForm<LoginFormData>();
  const signupForm = useForm<SignUpFormData>();

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setMode('choice');
      setError(null);
      setIsLoading(false);
      loginForm.reset();
      signupForm.reset();
      setSignupEmail('');
      setSignupPassword('');
    }
  };

  const onLoginSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await signIn(data.email, data.password, redirectTo);
      loginForm.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const onSignupStep1Submit = async (data: SignUpFormData) => {
    setSignupEmail(data.email);
    setSignupPassword(data.password);
    setMode('signup-step2');
    setError(null);
  };

  const onSignupStep2Submit = async () => {
    const selectedUserType = signupForm.watch('userType');
    if (!selectedUserType) {
      setError('Please select your user type');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await signUp(signupEmail, signupPassword, selectedUserType, redirectTo);
      signupForm.reset();
    } catch (err) {
      console.error('Sign up error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (mode) {
      case 'choice':
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-xl font-semibold">
                {title}
              </DialogTitle>
              <DialogDescription className="text-center text-muted-foreground">
                {description}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              <Button 
                className="w-full h-12 text-base font-medium bg-blue-600 hover:bg-blue-700"
                onClick={() => setMode('signup-step1')}
              >
                <UserPlus className="mr-2 h-5 w-5" />
                Create new account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-12 text-base font-medium border-2"
                onClick={() => setMode('login')}
              >
                <LogIn className="mr-2 h-5 w-5" />
                Sign in to existing account
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-6">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </>
        );

      case 'login':
        return (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode('choice')}
                  className="p-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Sign In
                </DialogTitle>
              </div>
              <DialogDescription>
                Enter your email and password to sign in to your account.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email address</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
                  {...loginForm.register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address'
                    }
                  })}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-red-500">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="Enter your password"
                  {...loginForm.register('password', {
                    required: 'Password is required'
                  })}
                  disabled={isLoading}
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              
              {error && (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Log in
                  </>
                )}
              </Button>
            </form>
          </>
        );

      case 'signup-step1':
        return (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode('choice')}
                  className="p-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Create Account
                </DialogTitle>
              </div>
              <DialogDescription>
                Enter your email and create a password to get started
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={signupForm.handleSubmit(onSignupStep1Submit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email address</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="Enter your email"
                  {...signupForm.register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Please enter a valid email address'
                    }
                  })}
                  disabled={isLoading}
                />
                {signupForm.formState.errors.email && (
                  <p className="text-sm text-red-500">{signupForm.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="Create a password"
                  {...signupForm.register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
                      message: 'Password must contain uppercase, lowercase, and a number'
                    }
                  })}
                  disabled={isLoading}
                />
                {signupForm.formState.errors.password && (
                  <p className="text-sm text-red-500">{signupForm.formState.errors.password.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters with uppercase, lowercase, and a number
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                <Input
                  id="signup-confirm-password"
                  type="password"
                  placeholder="Confirm your password"
                  {...signupForm.register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value, formValues) => 
                      value === formValues.password || 'Passwords do not match'
                  })}
                  disabled={isLoading}
                />
                {signupForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-500">{signupForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              
              {error && (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                Continue
              </Button>
            </form>
          </>
        );

      case 'signup-step2':
        return (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode('signup-step1')}
                  className="p-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Complete Profile
                </DialogTitle>
              </div>
              <DialogDescription>
                Complete your profile to personalize your experience
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 bg-muted rounded-md mb-4">
              <p className="text-sm text-muted-foreground">
                Creating account for: <span className="font-medium text-foreground">{signupEmail}</span>
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); onSignupStep2Submit(); }} className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="user-type" className="text-base font-medium">
                  Which best describes you?
                </Label>
                <p className="text-sm text-muted-foreground">
                  This helps us personalize your experience
                </p>
                
                <Select 
                  onValueChange={(value: UserType) => {
                    signupForm.setValue('userType', value);
                    signupForm.clearErrors('userType');
                  }}
                  value={signupForm.watch('userType')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select your role..." />
                  </SelectTrigger>
                  <SelectContent className="z-[10000]" position="popper" sideOffset={4}>
                    {userTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {signupForm.formState.errors.userType && (
                  <p className="text-sm text-red-500">{signupForm.formState.errors.userType.message}</p>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !signupForm.watch('userType')}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Complete Sign Up
                  </>
                )}
              </Button>
            </form>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] max-h-[90vh] overflow-y-auto">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}