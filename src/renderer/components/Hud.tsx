import { ClipboardCopy, Download, Trash2, Wand2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@renderer/lib/cn';
import type { HudCard } from '@shared/ipc';

type ActionKey = 'close' | 'delete' | 'edit' | 'copy' | 'save';

// `WebkitAppRegion` isn't in React's strict CSSProperties type, so cast.
const DRAG_REGION = { WebkitAppRegion: 'drag' } as unknown as React.CSSProperties;
const NO_DRAG_REGION = { WebkitAppRegion: 'no-drag' } as unknown as React.CSSProperties;

export function Hud() {
  const [cards, setCards] = useState<HudCard[]>([]);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHovered = useRef(false);
  // Cached auto-close pref so the timer doesn't have to await prefs each tick.
  const autoCloseMs = useRef<number | null>(6000);

  const clearTimer = (): void => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  };

  const scheduleDismiss = useCallback((): void => {
    clearTimer();
    if (isHovered.current) return;
    if (autoCloseMs.current == null) return; // disabled
    dismissTimer.current = setTimeout(() => {
      void window.snapora.hud.dismiss();
    }, autoCloseMs.current);
  }, []);

  // Pull HUD prefs from main on every stack push so changes in Settings
  // take effect on the next capture without reloading.
  const refreshAutoClose = useCallback(async (): Promise<void> => {
    const prefs = await window.snapora.preferences.get();
    autoCloseMs.current = prefs.hudAutoCloseEnabled ? prefs.hudAutoCloseSeconds * 1000 : null;
  }, []);

  useEffect(() => {
    const off = window.snapora.hud.onStack((next) => {
      setCards(next);
      if (next.length > 0) {
        void refreshAutoClose().then(scheduleDismiss);
      }
    });
    void window.snapora.hud.requestStack().then((current) => {
      if (current.length > 0) {
        setCards(current);
        void refreshAutoClose().then(scheduleDismiss);
      }
    });
    return () => {
      off();
      clearTimer();
    };
  }, [refreshAutoClose, scheduleDismiss]);

  const handleEnter = (): void => {
    isHovered.current = true;
    clearTimer();
  };
  const handleLeave = (): void => {
    isHovered.current = false;
    scheduleDismiss();
  };

  if (cards.length === 0) return null;

  return (
    // Wrapper is the drag region — clicking the gap above / between cards
    // moves the window. Cards opt back out via NO_DRAG_REGION.
    <div
      className="flex h-screen w-screen flex-col gap-2.5 bg-slate-900"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={DRAG_REGION}
    >
      {cards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
    </div>
  );
}

function Card({ card }: { card: HudCard }) {
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const run =
    (key: ActionKey, fn: () => Promise<unknown>, successToast?: string) =>
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setPendingAction(key);
      try {
        await fn();
        if (successToast) {
          setToast(successToast);
          setTimeout(() => setToast(null), 800);
        }
      } catch (err) {
        console.error('[hud] action failed', key, err);
      } finally {
        setPendingAction(null);
      }
    };

  return (
    <div
      className="group relative h-40 w-full shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10"
      // The card itself is interactive — disable the wrapper's drag region
      // so clicks and HTML5 drag events on the image work normally.
      style={NO_DRAG_REGION}
    >
      <img
        src={card.snapUrl}
        alt="captured"
        className="absolute inset-0 h-full w-full object-cover"
        draggable
        onDragStart={(e) => {
          // Suppress HTML5 drag — Electron's startDrag takes over so the
          // file can be dropped into other apps as an actual file.
          e.preventDefault();
          window.snapora.hud.beginDrag(card.id);
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />

      {toast ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-emerald-500/85 text-sm font-medium text-white">
          {toast}
        </div>
      ) : null}

      <div className="absolute inset-0 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <CornerButton
          className="left-1.5 top-1.5"
          label="Close (keep on disk)"
          onClick={run('close', () => window.snapora.hud.dismissCard(card.id))}
        >
          <X className="h-3 w-3" />
        </CornerButton>

        <CornerButton
          className="right-1.5 top-1.5"
          label="Delete from disk"
          onClick={run('delete', () => window.snapora.hud.discardCard(card.id))}
        >
          <Trash2 className="h-3 w-3" />
        </CornerButton>

        <CornerButton
          className="bottom-1.5 left-1.5"
          label="Open in editor"
          onClick={run('edit', () => window.snapora.hud.openCardInEditor(card.id))}
        >
          <Wand2 className="h-3 w-3" />
        </CornerButton>

        {card.width && card.height ? (
          <div className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
            {card.width} × {card.height}
          </div>
        ) : null}

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <PillButton
            icon={<ClipboardCopy className="h-3 w-3" />}
            onClick={run(
              'copy',
              async () => {
                await window.snapora.hud.copyCard(card.id);
                await window.snapora.hud.dismissCard(card.id);
              },
              'Copied',
            )}
            disabled={pendingAction === 'copy'}
          >
            Copy
          </PillButton>
          <PillButton
            icon={<Download className="h-3 w-3" />}
            onClick={run(
              'save',
              async () => {
                const r = await window.snapora.hud.saveCard(card.id);
                if (r.saved) await window.snapora.hud.dismissCard(card.id);
              },
              'Saved',
            )}
            disabled={pendingAction === 'save'}
          >
            Save
          </PillButton>
        </div>
      </div>
    </div>
  );
}

function CornerButton({
  className,
  children,
  label,
  onClick,
  disabled,
}: {
  className?: string;
  children: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'absolute z-30 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white/90 ring-1 ring-white/20 transition hover:bg-black/90 disabled:cursor-not-allowed',
        className,
      )}
    >
      {children}
    </button>
  );
}

function PillButton({
  children,
  icon,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="z-30 flex min-w-[88px] items-center justify-center gap-1.5 rounded-full bg-white px-3.5 py-1 text-xs font-medium text-slate-900 shadow-md ring-1 ring-black/10 transition hover:bg-white/95 active:scale-[0.98] disabled:opacity-60"
    >
      {icon}
      {children}
    </button>
  );
}
