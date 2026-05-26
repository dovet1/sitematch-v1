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
  const canDecrement = value > min;
  const canIncrement = value < max;

  const handleDecrement = () => {
    if (canDecrement) {
      onChange(Math.max(min, value - step));
    }
  };

  const handleIncrement = () => {
    if (canIncrement) {
      onChange(Math.min(max, value + step));
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
      <div className="px-3 py-1.5 text-sm font-medium font-mono text-sm-ink min-w-[3rem] text-center">
        {value}
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
