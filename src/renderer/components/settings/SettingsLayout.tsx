import * as React from 'react';
import { cn } from '@renderer/lib/cn';

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-white/95">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-white/50">{description}</p> : null}
      </div>
      <div className="rounded-xl border border-white/5 bg-white/[0.025] divide-y divide-white/5">
        {children}
      </div>
    </div>
  );
}

export function Row({
  label,
  description,
  control,
  className,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-4 px-4 py-3', className)}>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white/95">{label}</div>
        {description ? <div className="mt-0.5 text-xs text-white/50">{description}</div> : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
