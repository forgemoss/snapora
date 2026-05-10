import { useEffect, useRef, useState } from 'react';
import { cn } from '@renderer/lib/cn';

interface ClickConfig {
  enabled: boolean;
  color: string;
  size: 'small' | 'medium' | 'large';
  style: 'outline' | 'filled';
  animated: boolean;
}

interface KeyConfig {
  enabled: boolean;
  position:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
  size: 'small' | 'medium' | 'large';
  style: 'dark' | 'light';
  onlyCommandKeys: boolean;
}

interface EffectsConfig {
  clicks: ClickConfig;
  keys: KeyConfig;
}

interface ClickRipple {
  id: number;
  x: number;
  y: number;
  startedAt: number;
}

interface KeystrokeEvent {
  rawcode?: number;
  keychar?: number;
  keycode?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

interface KeyDisplay {
  id: number;
  label: string;
  startedAt: number;
}

const CLICK_LIFETIME_MS = 500;
const KEY_LIFETIME_MS = 1500;

function clickPx(size: ClickConfig['size']): number {
  if (size === 'small') return 32;
  if (size === 'large') return 80;
  return 56;
}

function keyboxClasses(size: KeyConfig['size'], style: KeyConfig['style']): string {
  const sz =
    size === 'small'
      ? 'text-base px-3 py-1.5 rounded-md'
      : size === 'large'
        ? 'text-3xl px-5 py-3 rounded-2xl'
        : 'text-xl px-4 py-2 rounded-xl';
  const sty =
    style === 'light'
      ? 'bg-white/95 text-slate-900 ring-1 ring-black/15'
      : 'bg-slate-900/90 text-white ring-1 ring-white/15';
  return `${sz} ${sty} font-mono shadow-2xl`;
}

function positionClasses(pos: KeyConfig['position']): string {
  switch (pos) {
    case 'top-left':
      return 'top-12 left-12';
    case 'top-center':
      return 'top-12 left-1/2 -translate-x-1/2';
    case 'top-right':
      return 'top-12 right-12';
    case 'bottom-left':
      return 'bottom-16 left-12';
    case 'bottom-right':
      return 'bottom-16 right-12';
    case 'bottom-center':
    default:
      return 'bottom-16 left-1/2 -translate-x-1/2';
  }
}

/** Render a uiohook keydown event as the kind of "⌘⇧F" pill CleanShot uses. */
function labelForKey(e: KeystrokeEvent): string | null {
  const parts: string[] = [];
  if (e.metaKey) parts.push('⌘');
  if (e.ctrlKey) parts.push('⌃');
  if (e.altKey) parts.push('⌥');
  if (e.shiftKey) parts.push('⇧');

  // uiohook event includes `keychar` (printable) and `keycode` (USB HID).
  // We try keychar first; fall back to a name lookup.
  if (e.keychar && e.keychar !== 0) {
    const ch = String.fromCharCode(e.keychar);
    if (ch.trim().length > 0) parts.push(ch.toUpperCase());
  } else if (typeof e.keycode === 'number') {
    const named = NAMED_KEYS[e.keycode];
    if (named) parts.push(named);
  }
  if (parts.length === 0) return null;
  return parts.join('');
}

/** Subset of uiohook keycodes for keys the user is likely to highlight. */
const NAMED_KEYS: Record<number, string> = {
  14: '⌫', // Backspace
  15: '⇥', // Tab
  28: '⏎', // Enter
  57: 'Space',
  1: '⎋', // Escape
  3675: '←',
  3677: '→',
  3672: '↑',
  3680: '↓',
  59: 'F1',
  60: 'F2',
  61: 'F3',
  62: 'F4',
  63: 'F5',
  64: 'F6',
  65: 'F7',
  66: 'F8',
  67: 'F9',
  68: 'F10',
  87: 'F11',
  88: 'F12',
};

export function RecordingEffects() {
  const [config, setConfig] = useState<EffectsConfig | null>(null);
  const [ripples, setRipples] = useState<ClickRipple[]>([]);
  const [keys, setKeys] = useState<KeyDisplay[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const off = window.snapora.recording.onEffectsConfig((cfg) => {
      setConfig(cfg as EffectsConfig);
    });
    return off;
  }, []);

  useEffect(() => {
    if (!config?.clicks.enabled) return;
    const off = window.snapora.recording.onClickEvent(({ x, y }) => {
      const id = ++idRef.current;
      setRipples((r) => [...r, { id, x, y, startedAt: Date.now() }]);
      setTimeout(() => {
        setRipples((r) => r.filter((s) => s.id !== id));
      }, CLICK_LIFETIME_MS + 50);
    });
    return off;
  }, [config?.clicks.enabled]);

  useEffect(() => {
    if (!config?.keys.enabled) return;
    const off = window.snapora.recording.onKeyEvent((raw) => {
      const e = raw as KeystrokeEvent;
      if (config.keys.onlyCommandKeys && !(e.metaKey || e.ctrlKey || e.altKey)) {
        return;
      }
      const label = labelForKey(e);
      if (!label) return;
      const id = ++idRef.current;
      setKeys((k) => {
        // Keep last 4 keystrokes max.
        const next = [...k, { id, label, startedAt: Date.now() }];
        return next.slice(-4);
      });
      setTimeout(() => {
        setKeys((k) => k.filter((s) => s.id !== id));
      }, KEY_LIFETIME_MS + 50);
    });
    return off;
  }, [config?.keys.enabled, config?.keys.onlyCommandKeys]);

  if (!config) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {ripples.map((r) => {
        const size = clickPx(config.clicks.size);
        return (
          <div
            key={r.id}
            className={cn(
              config.clicks.animated ? 'animate-[pulse_400ms_ease-out_1]' : '',
              'absolute rounded-full',
              config.clicks.style === 'filled' ? '' : 'border-[3px] bg-transparent',
            )}
            style={{
              left: r.x - size / 2,
              top: r.y - size / 2,
              width: size,
              height: size,
              borderColor: config.clicks.color,
              backgroundColor:
                config.clicks.style === 'filled' ? config.clicks.color : 'transparent',
              opacity: config.clicks.style === 'filled' ? 0.55 : 0.85,
              boxShadow: `0 0 24px ${config.clicks.color}66`,
              animation: config.clicks.animated
                ? 'snapora-click-pulse 500ms ease-out forwards'
                : undefined,
            }}
          />
        );
      })}

      {keys.length > 0 ? (
        <div
          className={cn('absolute flex items-center gap-2', positionClasses(config.keys.position))}
        >
          {keys.map((k) => (
            <div key={k.id} className={keyboxClasses(config.keys.size, config.keys.style)}>
              {k.label}
            </div>
          ))}
        </div>
      ) : null}

      <style>{`
        @keyframes snapora-click-pulse {
          0%   { transform: scale(0.4); opacity: 0.95; }
          70%  { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
