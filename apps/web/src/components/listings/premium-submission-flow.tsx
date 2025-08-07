// =====================================================
// Premium Submission Flow - UX Expert Design
// Orchestrates the complete submission experience
// =====================================================

'use client';

import { useState } from 'react';
import { PremiumSubmissionLoading } from './premium-submission-loading';
import { SubmissionSuccessTransition } from './submission-success-transition';

// =====================================================
// TYPES
// =====================================================

export type SubmissionState = 'idle' | 'loading' | 'success' | 'error';

interface PremiumSubmissionFlowProps {
  children: (submitHandler: (listingData: any) => Promise<void>) => React.ReactNode;
  onSubmissionComplete?: (listingId: string) => void;
  onError?: (error: Error) => void;
  submitFunction: (data: any) => Promise<{ id: string; company_name: string }>;
  className?: string;
}

// =====================================================
// PREMIUM SUBMISSION FLOW COMPONENT
// =====================================================

export function PremiumSubmissionFlow({
  children,
  onSubmissionComplete,
  onError,
  submitFunction,
  className
}: PremiumSubmissionFlowProps) {
  const [state, setState] = useState<SubmissionState>('idle');
  const [submissionData, setSubmissionData] = useState<{
    listingId: string;
    companyName: string;
  } | null>(null);

  const handleSubmit = async (listingData: any) => {
    try {
      setState('loading');
      
      // Call the actual submission function
      const result = await submitFunction(listingData);
      
      // Set success data
      setSubmissionData({
        listingId: result.id,
        companyName: result.company_name
      });
      
      setState('success');
      
      // Notify parent component
      if (onSubmissionComplete) {
        onSubmissionComplete(result.id);
      }
      
    } catch (error) {
      setState('error');
      if (onError) {
        onError(error as Error);
      }
      console.error('Submission failed:', error);
    }
  };

  const handleLoadingComplete = () => {
    setState('success');
  };

  return (
    <div className={className}>
      {/* Render children with submit handler */}
      {children(handleSubmit)}

      {/* Premium Loading Overlay */}
      <PremiumSubmissionLoading
        isVisible={state === 'loading'}
        onComplete={handleLoadingComplete}
      />

      {/* Success Transition */}
      {submissionData && (
        <SubmissionSuccessTransition
          isVisible={state === 'success'}
          listingId={submissionData.listingId}
          companyName={submissionData.companyName}
          autoRedirectAfter={0} // Let user choose when to proceed
        />
      )}
    </div>
  );
}

// =====================================================
// ENHANCED SUBMIT BUTTON COMPONENT
// =====================================================

interface PremiumSubmitButtonProps {
  onSubmit: () => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function PremiumSubmitButton({
  onSubmit,
  loading = false,
  disabled = false,
  children,
  className
}: PremiumSubmitButtonProps) {
  return (
    <button
      onClick={onSubmit}
      disabled={disabled || loading}
      className={`
        relative overflow-hidden
        px-8 py-4 rounded-xl
        bg-gradient-to-r from-violet-600 to-purple-600
        hover:from-violet-700 hover:to-purple-700
        disabled:from-gray-400 disabled:to-gray-500
        text-white font-semibold
        shadow-lg hover:shadow-xl
        transform hover:scale-105 active:scale-95
        transition-all duration-200
        focus:outline-none focus:ring-4 focus:ring-violet-200
        group
        ${className}
      `}
    >
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
      
      {/* Button content */}
      <div className="relative flex items-center justify-center gap-2">
        {loading && (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
        )}
        <span>{children}</span>
      </div>
    </button>
  );
}

// =====================================================
// UTILITY HOOKS
// =====================================================

export function useSubmissionState() {
  const [state, setState] = useState<SubmissionState>('idle');
  const [error, setError] = useState<Error | null>(null);

  const reset = () => {
    setState('idle');
    setError(null);
  };

  const setLoading = () => setState('loading');
  const setSuccess = () => setState('success');
  const setError_ = (error: Error) => {
    setError(error);
    setState('error');
  };

  return {
    state,
    error,
    isLoading: state === 'loading',
    isSuccess: state === 'success',
    isError: state === 'error',
    isIdle: state === 'idle',
    reset,
    setLoading,
    setSuccess,
    setError: setError_
  };
}

// =====================================================
// EXAMPLE USAGE
// =====================================================

/*
// Example implementation:

export function MySubmissionForm() {
  const submitListing = async (data: any) => {
    // Your actual API call here
    const response = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error('Submission failed');
    
    return await response.json();
  };

  return (
    <PremiumSubmissionFlow
      submitFunction={submitListing}
      onSubmissionComplete={(listingId) => {
        console.log('Submission completed:', listingId);
      }}
      onError={(error) => {
        console.error('Submission error:', error);
      }}
    >
      {(handleSubmit) => (
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const data = Object.fromEntries(formData);
          handleSubmit(data);
        }}>
          // Form fields would go here
          
          <PremiumSubmitButton
            onSubmit={async () => {
              // This is just example code - in real usage, you'd get actual form data
              await handleSubmit({});
            }}
          >
            Submit for Review
          </PremiumSubmitButton>
        </form>
      )}
    </PremiumSubmissionFlow>
  );
}
*/