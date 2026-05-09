import * as React from 'react';
import { cn } from '@renderer/lib/cn';

/** Shared chrome for every Snapora window. */
export function WindowShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex h-full flex-col text-[color:var(--color-fg)] bg-slate-900', className)}
    >
      {children}
    </div>
  );
}

interface WindowChromeProps {
  title?: React.ReactNode;
  /** Pad left for macOS traffic lights when titleBarStyle: 'hiddenInset'. */
  trafficLightOffset?: boolean;
  /** Right-side actions (buttons, status pills). */
  right?: React.ReactNode;
  className?: string;
}

/**
 * Top bar with drag region. The whole bar is draggable except for child elements
 * marked `data-no-drag` (the right-side actions are wrapped that way).
 */
export function WindowChrome({
  title,
  trafficLightOffset = true,
  right,
  className,
}: WindowChromeProps) {
  return (
    <header
      className={cn(
        'flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-4 select-none',
        trafficLightOffset && 'pl-20',
        className,
      )}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="text-sm font-medium tracking-wide text-white/70 truncate">{title}</div>
      <div
        className="flex items-center gap-1.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {right}
      </div>
    </header>
  );
}

export function WindowFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <footer
      className={cn(
        'flex h-9 shrink-0 items-center justify-between border-t border-white/5 px-4 text-xs text-white/40',
        className,
      )}
    >
      {children}
    </footer>
  );
}
