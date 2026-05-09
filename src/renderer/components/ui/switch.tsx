import * as React from 'react';
import { cn } from '@renderer/lib/cn';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function Switch({ checked, onCheckedChange, disabled, id, ...rest }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-white/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-amber-500' : 'bg-white/10',
      )}
      {...rest}
    >
      <span
        className={cn(
          'pointer-events-none block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
