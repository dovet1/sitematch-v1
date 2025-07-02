// =====================================================
// Optimized Input Component - QA Performance Enhancement
// High-performance input with debouncing and memoization
// =====================================================

'use client';

import React, { memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { useFieldPerformance } from '@/hooks/use-form-performance';

interface OptimizedInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  readOnly?: boolean;
  disabled?: boolean;
  debounceMs?: number;
  validateOnChange?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const OptimizedInputComponent: React.FC<OptimizedInputProps> = ({
  value,
  onChange,
  debounceMs = 300,
  validateOnChange = true,
  onBlur,
  onFocus,
  ...inputProps
}) => {
  const { value: localValue, onChange: handleChange, isChanging } = useFieldPerformance(
    value,
    onChange,
    { debounceMs, validateOnChange }
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e.target.value);
  }, [handleChange]);

  const handleBlur = useCallback(() => {
    // Force sync on blur to ensure data consistency
    if (isChanging) {
      onChange(localValue);
    }
    onBlur?.();
  }, [isChanging, localValue, onChange, onBlur]);

  return (
    <Input
      {...inputProps}
      value={localValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      onFocus={onFocus}
    />
  );
};

// Memoize to prevent unnecessary re-renders
export const OptimizedInput = memo(OptimizedInputComponent);

// Optimized Textarea Component
interface OptimizedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  cols?: number;
  readOnly?: boolean;
  disabled?: boolean;
  debounceMs?: number;
  validateOnChange?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  maxLength?: number;
}

const OptimizedTextareaComponent: React.FC<OptimizedTextareaProps> = ({
  value,
  onChange,
  debounceMs = 500, // Slightly longer for text areas
  validateOnChange = true,
  onBlur,
  onFocus,
  className = '',
  maxLength,
  ...textareaProps
}) => {
  const { value: localValue, onChange: handleChange, isChanging } = useFieldPerformance(
    value,
    onChange,
    { debounceMs, validateOnChange }
  );

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleChange(e.target.value);
  }, [handleChange]);

  const handleBlur = useCallback(() => {
    // Force sync on blur
    if (isChanging) {
      onChange(localValue);
    }
    onBlur?.();
  }, [isChanging, localValue, onChange, onBlur]);

  const characterCount = localValue.length;
  const isNearLimit = maxLength && characterCount > maxLength * 0.8;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <div className="space-y-1">
      <textarea
        {...textareaProps}
        value={localValue}
        onChange={handleTextareaChange}
        onBlur={handleBlur}
        onFocus={onFocus}
        maxLength={maxLength}
        className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOverLimit ? 'border-red-500' : ''
        } ${className}`}
      />
      {maxLength && (
        <div className={`text-xs text-right ${
          isOverLimit ? 'text-red-500' : 
          isNearLimit ? 'text-yellow-600' : 
          'text-gray-500'
        }`}>
          {characterCount} / {maxLength}
        </div>
      )}
    </div>
  );
};

export const OptimizedTextarea = memo(OptimizedTextareaComponent);

// Optimized Number Input
interface OptimizedNumberInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  disabled?: boolean;
  debounceMs?: number;
  validateOnChange?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
  id?: string;
  name?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const OptimizedNumberInputComponent: React.FC<OptimizedNumberInputProps> = ({
  value,
  onChange,
  debounceMs = 300,
  validateOnChange = true,
  onBlur,
  onFocus,
  ...inputProps
}) => {
  const stringValue = value?.toString() || '';
  
  const { value: localValue, onChange: handleChange, isChanging } = useFieldPerformance(
    stringValue,
    (newStringValue: string) => {
      const numValue = newStringValue === '' ? undefined : Number(newStringValue);
      onChange(numValue);
    },
    { debounceMs, validateOnChange }
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty string and valid numbers
    if (inputValue === '' || /^\d*\.?\d*$/.test(inputValue)) {
      handleChange(inputValue);
    }
  }, [handleChange]);

  const handleBlur = useCallback(() => {
    // Force sync and cleanup on blur
    if (isChanging) {
      const numValue = localValue === '' ? undefined : Number(localValue);
      onChange(numValue);
    }
    onBlur?.();
  }, [isChanging, localValue, onChange, onBlur]);

  return (
    <Input
      {...inputProps}
      type="number"
      value={localValue}
      onChange={handleInputChange}
      onBlur={handleBlur}
      onFocus={onFocus}
    />
  );
};

export const OptimizedNumberInput = memo(OptimizedNumberInputComponent);