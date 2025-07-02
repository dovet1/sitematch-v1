// =====================================================
// Form Performance Hook - QA Performance Enhancement
// Optimizes large form performance with smart re-rendering
// =====================================================

'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { useDebouncedCallback } from './use-debounced-callback';

interface FormPerformanceOptions {
  autoSaveDelay?: number;
  validationDelay?: number;
  maxFieldsBeforeVirtualization?: number;
  enableFieldTracking?: boolean;
}

interface FieldState {
  value: any;
  isDirty: boolean;
  isTouched: boolean;
  lastChanged: number;
  changeCount: number;
}

export function useFormPerformance<T extends Record<string, any>>(
  initialData: T,
  options: FormPerformanceOptions = {}
) {
  const {
    autoSaveDelay = 1000,
    validationDelay = 300,
    maxFieldsBeforeVirtualization = 50,
    enableFieldTracking = true
  } = options;

  const [formData, setFormData] = useState<T>(initialData);
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  
  const lastSaveRef = useRef<T>(initialData);
  const changedFieldsRef = useRef<Set<string>>(new Set());
  const renderCountRef = useRef(0);

  // Track render count for performance monitoring
  renderCountRef.current++;

  // Debounced auto-save to reduce unnecessary saves
  const debouncedAutoSave = useDebouncedCallback(
    (data: T, changedFields: string[]) => {
      if (JSON.stringify(data) !== JSON.stringify(lastSaveRef.current)) {
        lastSaveRef.current = data;
        
        // Only save if there are meaningful changes
        if (changedFields.length > 0) {
          window.dispatchEvent(new CustomEvent('form-auto-save', { 
            detail: { data, changedFields } 
          }));
        }
      }
    },
    autoSaveDelay
  );

  // Debounced validation to reduce excessive validation calls
  const debouncedValidation = useDebouncedCallback(
    (data: T, field?: string) => {
      window.dispatchEvent(new CustomEvent('form-validate', { 
        detail: { data, field } 
      }));
    },
    validationDelay
  );

  // Optimized field update function
  const updateField = useCallback((
    fieldName: keyof T,
    value: any,
    options: { validate?: boolean; autoSave?: boolean } = {}
  ) => {
    const { validate = true, autoSave = true } = options;

    setFormData(prevData => {
      const newData = { ...prevData, [fieldName]: value };
      
      // Track changed fields
      changedFieldsRef.current.add(fieldName as string);
      
      // Update field state for tracking
      if (enableFieldTracking) {
        setFieldStates(prevStates => ({
          ...prevStates,
          [fieldName as string]: {
            value,
            isDirty: value !== initialData[fieldName],
            isTouched: true,
            lastChanged: Date.now(),
            changeCount: (prevStates[fieldName as string]?.changeCount || 0) + 1
          }
        }));
      }

      // Trigger debounced operations
      if (validate) {
        debouncedValidation(newData, fieldName as string);
      }
      
      if (autoSave) {
        debouncedAutoSave(newData, Array.from(changedFieldsRef.current));
      }

      return newData;
    });
  }, [initialData, enableFieldTracking, debouncedValidation, debouncedAutoSave]);

  // Batch update multiple fields (more efficient for large changes)
  const updateFields = useCallback((
    updates: Partial<T>,
    options: { validate?: boolean; autoSave?: boolean } = {}
  ) => {
    const { validate = true, autoSave = true } = options;

    setFormData(prevData => {
      const newData = { ...prevData, ...updates };
      
      // Track all changed fields
      Object.keys(updates).forEach(key => {
        changedFieldsRef.current.add(key);
      });
      
      // Update field states in batch
      if (enableFieldTracking) {
        setFieldStates(prevStates => {
          const newStates = { ...prevStates };
          Object.entries(updates).forEach(([key, value]) => {
            newStates[key] = {
              value,
              isDirty: value !== initialData[key as keyof T],
              isTouched: true,
              lastChanged: Date.now(),
              changeCount: (prevStates[key]?.changeCount || 0) + 1
            };
          });
          return newStates;
        });
      }

      // Trigger debounced operations
      if (validate) {
        debouncedValidation(newData);
      }
      
      if (autoSave) {
        debouncedAutoSave(newData, Array.from(changedFieldsRef.current));
      }

      return newData;
    });
  }, [initialData, enableFieldTracking, debouncedValidation, debouncedAutoSave]);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormData(initialData);
    setFieldStates({});
    changedFieldsRef.current.clear();
    lastSaveRef.current = initialData;
  }, [initialData]);

  // Get dirty fields (changed from initial)
  const getDirtyFields = useCallback((): string[] => {
    return Object.entries(formData).reduce<string[]>((dirty, [key, value]) => {
      if (JSON.stringify(value) !== JSON.stringify(initialData[key])) {
        dirty.push(key);
      }
      return dirty;
    }, []);
  }, [formData, initialData]);

  // Performance metrics
  const performanceMetrics = useMemo(() => {
    const fieldCount = Object.keys(formData).length;
    const dirtyFields = getDirtyFields();
    const shouldVirtualize = fieldCount > maxFieldsBeforeVirtualization;
    
    return {
      fieldCount,
      dirtyFieldCount: dirtyFields.length,
      renderCount: renderCountRef.current,
      shouldVirtualize,
      changedFieldsCount: changedFieldsRef.current.size,
      lastSaveTime: lastSaveRef.current === formData ? Date.now() : null
    };
  }, [formData, getDirtyFields, maxFieldsBeforeVirtualization]);

  // Memoized form state to prevent unnecessary re-renders
  const memoizedFormState = useMemo(() => ({
    data: formData,
    fieldStates: enableFieldTracking ? fieldStates : {},
    isDirty: getDirtyFields().length > 0,
    metrics: performanceMetrics
  }), [formData, fieldStates, enableFieldTracking, getDirtyFields, performanceMetrics]);

  return {
    // Form data and state
    formData,
    fieldStates: enableFieldTracking ? fieldStates : {},
    
    // Actions
    updateField,
    updateFields,
    resetForm,
    
    // Utilities
    getDirtyFields,
    
    // Performance info
    metrics: performanceMetrics,
    
    // Memoized state for consumption by child components
    formState: memoizedFormState
  };
}

// Hook for field-level performance optimization
export function useFieldPerformance<T>(
  value: T,
  onChange: (value: T) => void,
  options: {
    debounceMs?: number;
    validateOnChange?: boolean;
  } = {}
) {
  const { debounceMs = 300, validateOnChange = true } = options;
  
  const [localValue, setLocalValue] = useState(value);
  const lastValueRef = useRef(value);
  
  // Update local value when prop changes
  if (value !== lastValueRef.current) {
    setLocalValue(value);
    lastValueRef.current = value;
  }
  
  // Debounced onChange to reduce parent re-renders
  const debouncedOnChange = useDebouncedCallback(onChange, debounceMs);
  
  const handleChange = useCallback((newValue: T) => {
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  }, [debouncedOnChange]);
  
  return {
    value: localValue,
    onChange: handleChange,
    isChanging: localValue !== value
  };
}