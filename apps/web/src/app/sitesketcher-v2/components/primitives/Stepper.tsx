import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { clsx } from 'clsx';
import { Minus, Plus } from 'lucide-react';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  suffix?: string;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  disabled = false,
  suffix,
}: StepperProps) {
  const [inputValue, setInputValue] = useState(String(value));
  const canDecrement = value > min;
  const canIncrement = value < max;

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const clampValue = (nextValue: number) => Math.min(max, Math.max(min, nextValue));

  const handleDecrement = () => {
    if (canDecrement) {
      onChange(clampValue(value - step));
    }
  };

  const handleIncrement = () => {
    if (canIncrement) {
      onChange(clampValue(value + step));
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextInputValue = event.target.value;
    setInputValue(nextInputValue);

    if (nextInputValue === '') {
      return;
    }

    const nextValue = Number(nextInputValue);
    if (Number.isFinite(nextValue)) {
      onChange(clampValue(nextValue));
    }
  };

  const handleInputBlur = () => {
    const nextValue = Number(inputValue);

    if (!inputValue || !Number.isFinite(nextValue)) {
      setInputValue(String(value));
      return;
    }

    const clampedValue = clampValue(nextValue);
    setInputValue(String(clampedValue));

    if (clampedValue !== value) {
      onChange(clampedValue);
    }
  };

  return (
    <div className="inline-flex items-center border border-sm-border rounded-lg bg-sm-surface">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || !canDecrement}
        className={clsx(
          'p-2 hover:bg-sm-bg transition-colors',
          (!canDecrement || disabled) && 'opacity-30 cursor-not-allowed'
        )}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center justify-center px-2 py-1.5 text-sm font-medium font-mono text-sm-ink min-w-[4rem] text-center">
        <input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          min={min}
          max={Number.isFinite(max) ? max : undefined}
          step={step}
          disabled={disabled}
          className="w-10 bg-transparent text-center font-mono outline-none [appearance:textfield] disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix && <span className="ml-1 text-sm-ink/50">{suffix}</span>}
      </div>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || !canIncrement}
        className={clsx(
          'p-2 hover:bg-sm-bg transition-colors',
          (!canIncrement || disabled) && 'opacity-30 cursor-not-allowed'
        )}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
