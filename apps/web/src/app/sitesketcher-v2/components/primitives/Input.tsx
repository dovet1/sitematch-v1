import { InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, suffix, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-medium text-sm-ink mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm-ink/50">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={clsx(
              'w-full px-3 py-2 text-sm bg-sm-surface border rounded-lg transition-colors focus-ring',
              error
                ? 'border-red-500 focus:border-red-600'
                : 'border-sm-border focus:border-sm-violet',
              icon && 'pl-9',
              suffix && 'pr-9',
              className
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-sm-ink/50">
              {suffix}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
