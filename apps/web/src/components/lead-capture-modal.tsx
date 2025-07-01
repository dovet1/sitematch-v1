'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LeadCaptureFormData, LeadPersona } from '@/types/leads';
import { markLeadModalShown } from '@/lib/lead-capture';

interface LeadCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LeadCaptureModal({ isOpen, onClose }: LeadCaptureModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LeadCaptureFormData>();

  const personaOptions: { value: LeadPersona; label: string }[] = [
    { value: 'agent', label: 'Agent' },
    { value: 'investor', label: 'Investor' },
    { value: 'landlord', label: 'Landlord' },
    { value: 'vendor', label: 'Vendor' },
  ];

  const onSubmit = async (data: LeadCaptureFormData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        markLeadModalShown();
        // Close modal after 2 seconds
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setSubmitStatus('error');
        setErrorMessage(result.error || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setSubmitStatus('idle');
    setErrorMessage('');
    onClose();
  };

  const handleDecline = () => {
    markLeadModalShown();
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stay Updated on Property Opportunities</DialogTitle>
          <DialogDescription>
            Get notified about the latest commercial property requirements matching your expertise.
          </DialogDescription>
        </DialogHeader>

        {submitStatus === 'success' ? (
          <div className="text-center py-4">
            <div className="text-green-600 font-medium mb-2">
              ✓ Thank you for subscribing!
            </div>
            <p className="text-sm text-gray-600">
              We'll keep you updated with relevant opportunities.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label>What best describes you?</Label>
              <div className="mt-2 space-y-2">
                {personaOptions.map((option) => (
                  <label key={option.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value={option.value}
                      {...register('persona', { required: 'Please select an option' })}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
              {errors.persona && (
                <p className="text-sm text-red-500 mt-1">{errors.persona.message}</p>
              )}
            </div>

            {submitStatus === 'error' && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleDecline}
                disabled={isSubmitting}
              >
                No thanks
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? 'Subscribing...' : 'Subscribe'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}