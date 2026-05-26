import { clsx } from 'clsx';
import { ChangeEvent } from 'react';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  suffix?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  suffix,
  disabled = false,
}: SliderProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-xs font-medium text-sm-ink">{label}</span>}
          {showValue && (
            <span className="text-xs font-mono text-sm-ink/70">
              {value}
              {suffix}
            </span>
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={clsx(
            'w-full h-2 rounded-full appearance-none cursor-pointer slider-v2',
            'focus:outline-none focus-ring',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{
            background: `linear-gradient(to right, #7033FF 0%, #7033FF ${percentage}%, #E8E4DC ${percentage}%, #E8E4DC 100%)`,
          }}
        />
      </div>
    </div>
  );
}
