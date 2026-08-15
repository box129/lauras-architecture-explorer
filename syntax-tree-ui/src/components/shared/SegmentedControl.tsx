import clsx from 'clsx';

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string; disabled?: boolean; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div className="flex bg-bg border border-border rounded-lg overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={opt.disabled}
          title={opt.title}
          className={clsx(
            'transition-colors font-medium',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs',
            opt.disabled && 'opacity-40 cursor-not-allowed hover:text-secondary hover:bg-transparent',
            value === opt.value
              ? 'bg-surface text-primary border-b-2 border-b-accent'
              : 'text-secondary hover:text-primary hover:bg-surface/50',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
