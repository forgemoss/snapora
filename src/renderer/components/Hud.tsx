import { ClipboardCopy, Download, Wand2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@renderer/lib/cn';

const AUTO_DISMISS_MS = 6000;

type ActionKey = 'close' | 'edit' | 'copy' | 'save';

export function Hud() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHovered = useRef(false);

  const clearTimer = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  };

  const scheduleDismiss = useCallback(() => {
    clearTimer();
    if (isHovered.current) return;
    dismissTimer.current = setTimeout(() => {
      void window.snapora.hud.dismiss();
    }, AUTO_DISMISS_MS);
  }, []);

  useEffect(() => {
    const off = window.snapora.hud.onImageReady((url) => {
      setImageUrl(url);
      setPendingAction(null);
      setToast(null);
      scheduleDismiss();
    });
    void window.snapora.hud.requestCurrent().then((url) => {
      if (url) {
        setImageUrl(url);
        scheduleDismiss();
      }
    });
    return () => {
      off();
      clearTimer();
    };
  }, [scheduleDismiss]);

  const handleEnter = () => {
    isHovered.current = true;
    clearTimer();
  };
  const handleLeave = () => {
    isHovered.current = false;
    scheduleDismiss();
  };

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

  if (!imageUrl) {
    return null;
  }

  return (
    <div
      className="flex h-screen w-screen items-center justify-center bg-slate-900 p-1.5"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className="group relative h-full w-full overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
        <img
          src={imageUrl}
          alt="captured"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Dark overlay — fades in on hover */}
        <div className="pointer-events-none absolute inset-0 bg-black/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />

        {toast ? (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-emerald-500/85 text-sm font-medium text-white">
            {toast}
          </div>
        ) : null}

        {/* Action layer — fades in on hover */}
        <div className="absolute inset-0 z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <CornerButton
            className="left-1.5 top-1.5"
            label="Discard (delete from disk)"
            onClick={run('close', () => window.snapora.hud.closeAndDelete())}
          >
            <X className="h-3 w-3" />
          </CornerButton>

          <CornerButton
            className="bottom-1.5 left-1.5"
            label="Open in editor"
            onClick={run('edit', () => window.snapora.hud.openInEditor())}
          >
            <Wand2 className="h-3 w-3" />
          </CornerButton>

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <PillButton
              icon={<ClipboardCopy className="h-3 w-3" />}
              onClick={run('copy', () => window.snapora.hud.copy(), 'Copied')}
              disabled={pendingAction === 'copy'}
            >
              Copy
            </PillButton>
            <PillButton
              icon={<Download className="h-3 w-3" />}
              onClick={run('save', () => window.snapora.hud.saveAs(), 'Saved')}
              disabled={pendingAction === 'save'}
            >
              Save
            </PillButton>
          </div>
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
