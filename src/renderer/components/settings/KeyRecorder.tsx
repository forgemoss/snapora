import { useEffect, useState } from 'react';
import { cn } from '@renderer/lib/cn';

interface KeyRecorderProps {
  /** Electron accelerator string (e.g. "CommandOrControl+Shift+2"). */
  value: string;
  onChange: (next: string) => void;
}

/**
 * Inline button that, when clicked, listens for one keystroke and stores
 * the resulting accelerator. Press Escape to cancel.
 */
export function KeyRecorder({ value, onChange }: KeyRecorderProps) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRecording(false);
        return;
      }
      const accel = buildAccelerator(e);
      if (accel) {
        onChange(accel);
        setRecording(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [recording, onChange]);

  return (
    <button
      type="button"
      onClick={() => setRecording((r) => !r)}
      className={cn(
        'inline-flex h-8 min-w-[120px] items-center justify-center rounded-md border px-3 text-xs font-mono transition',
        recording
          ? 'border-amber-400/60 bg-amber-500/10 text-amber-200 animate-pulse'
          : 'border-white/10 bg-white/[0.04] text-white/95 hover:bg-white/[0.08]',
      )}
    >
      {recording ? 'Press keys…' : displayAccelerator(value)}
    </button>
  );
}

function buildAccelerator(e: KeyboardEvent): string | null {
  // Modifier-only presses are ignored — we wait for a real key.
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const key = normalizeKey(e);
  if (!key) return null;
  parts.push(key);
  // Reject modifier-less single keys — safety against accidental binds.
  if (parts.length < 2) return null;
  return parts.join('+');
}

function normalizeKey(e: KeyboardEvent): string | null {
  // Letters: use uppercase
  if (/^[a-z]$/i.test(e.key)) return e.key.toUpperCase();
  // Digits 0-9: use as-is
  if (/^[0-9]$/.test(e.key)) return e.key;
  // Function keys F1..F24
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.key)) return e.key;
  // Common named keys → Electron accelerator names
  const map: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ' ': 'Space',
    Enter: 'Return',
    Escape: 'Esc',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
  };
  return map[e.key] ?? null;
}

const ACCEL_SYMBOLS: Array<[string, string]> = [
  ['CommandOrControl', '⌘'],
  ['CmdOrCtrl', '⌘'],
  ['Command', '⌘'],
  ['Cmd', '⌘'],
  ['Control', '⌃'],
  ['Ctrl', '⌃'],
  ['Alt', '⌥'],
  ['Option', '⌥'],
  ['Shift', '⇧'],
  ['Return', '↩'],
  ['Esc', '⎋'],
  ['Up', '↑'],
  ['Down', '↓'],
  ['Left', '←'],
  ['Right', '→'],
  ['Space', '␣'],
];

function displayAccelerator(accel: string): string {
  if (!accel) return 'Not set';
  let display = accel;
  for (const [name, symbol] of ACCEL_SYMBOLS) {
    display = display.replaceAll(name, symbol);
  }
  return display.replaceAll('+', '');
}
