import { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ checked, onChange, label, disabled = false, size = 'md' }, ref) => {
    const sizeClasses = {
      sm: {
        track: 'w-9 h-5',
        thumb: 'w-4 h-4',
        translate: checked ? 'translate-x-4' : 'translate-x-0.5',
      },
      md: {
        track: 'w-11 h-6',
        thumb: 'w-5 h-5',
        translate: checked ? 'translate-x-5' : 'translate-x-0.5',
      },
    };

    const currentSize = sizeClasses[size];

    return (
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={clsx(
            'relative inline-flex items-center rounded-full transition-colors focus-ring',
            currentSize.track,
            checked ? 'bg-sm-violet' : 'bg-sm-border',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span
            className={clsx(
              'inline-block bg-white rounded-full shadow-sm transition-transform',
              currentSize.thumb,
              currentSize.translate
            )}
          />
        </button>
        {label && (
          <span className={clsx('text-sm text-sm-ink', disabled && 'opacity-50')}>
            {label}
          </span>
        )}
      </label>
    );
  }
);

Toggle.displayName = 'Toggle';
