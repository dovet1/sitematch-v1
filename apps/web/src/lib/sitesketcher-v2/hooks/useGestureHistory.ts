import { useRef } from 'react';

/**
 * Custom hook for managing gesture-based history tracking.
 *
 * This hook provides a pattern for batching undo operations during continuous
 * gestures (like slider movements). Instead of recording history for every
 * intermediate value, it records history once at the start and once at the end,
 * creating a single undoable operation for the entire gesture.
 *
 * @param getCurrentValue - Function to get the current value being modified (may return undefined)
 * @param onChange - Function to apply the change (should be called with recordHistory: false)
 * @param pushHistory - Function to record the current state to history
 * @returns Object with start, change, and end handlers for the gesture
 */
export function useGestureHistory<T>(
  getCurrentValue: () => T | undefined,
  onChange: (value: T) => void,
  pushHistory: () => void
) {
  const gestureRef = useRef({ active: false, changed: false });

  const handleStart = () => {
    if (!gestureRef.current.active) {
      gestureRef.current = { active: true, changed: false };
    }
  };

  const handleChange = (newValue: T) => {
    const currentValue = getCurrentValue();

    // Skip if current value is undefined or if value hasn't actually changed
    if (currentValue === undefined || newValue === currentValue) return;

    // On first actual change, push history to create "before" bookmark
    if (!gestureRef.current.changed) {
      pushHistory();
      gestureRef.current.changed = true;
    }

    // Apply the change without recording history
    onChange(newValue);
  };

  const handleEnd = () => {
    // If no changes were made, just reset and return
    if (!gestureRef.current.changed) {
      gestureRef.current.active = false;
      return;
    }

    // Push history to create "after" bookmark
    pushHistory();
    gestureRef.current = { active: false, changed: false };
  };

  return {
    handleStart,
    handleChange,
    handleEnd,
  };
}
