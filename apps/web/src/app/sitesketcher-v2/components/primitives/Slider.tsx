import { clsx } from 'clsx';
import { ChangeEvent, KeyboardEvent, PointerEvent } from 'react';

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
  onChangeStart?: () => void;
  onChangeEnd?: () => void;
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
  onChangeStart,
  onChangeEnd,
}: SliderProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  const handlePointerDown = (e: PointerEvent<HTMLInputElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    onChangeStart?.();
  };

  const handlePointerUp = (e: PointerEvent<HTMLInputElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onChangeEnd?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Home' ||
      e.key === 'End' ||
      e.key === 'PageUp' ||
      e.key === 'PageDown'
    ) {
      onChangeStart?.();
    }
  };

  const handleKeyUp = () => {
    onChangeEnd?.();
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
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={onChangeEnd}
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
