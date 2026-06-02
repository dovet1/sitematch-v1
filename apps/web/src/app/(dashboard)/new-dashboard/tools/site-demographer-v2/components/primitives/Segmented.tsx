import { clsx } from 'clsx';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
}: SegmentedProps<T>) {
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-sm px-3.5 py-2',
  };

  return (
    <div
      className={clsx(
        'inline-flex p-1 bg-sm-bg border border-sm-border rounded-lg',
        fullWidth && 'w-full'
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-all',
            sizeClasses[size],
            fullWidth && 'flex-1',
            value === option.value
              ? 'bg-sm-surface text-sm-ink shadow-sm'
              : 'text-sm-ink/60 hover:text-sm-ink'
          )}
        >
          {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
