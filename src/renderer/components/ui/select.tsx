import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@renderer/lib/cn';

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: SelectOption<T>[];
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** Minimal styled native <select>. Replace with a Radix Select when we need richer behavior. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
  className,
  id,
}: SelectProps<T>) {
  return (
    <div className={cn('relative inline-block', className)}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 appearance-none rounded-md border border-white/10 bg-white/[0.04] py-1 pl-2.5 pr-7 text-sm text-white/95 outline-none transition focus:border-amber-400/50 disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/50" />
    </div>
  );
}
