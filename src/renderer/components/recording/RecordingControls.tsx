import { GripVertical, Pause, Play, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const DRAG = { WebkitAppRegion: 'drag' } as unknown as React.CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as unknown as React.CSSProperties;

function format(durationMs: number): string {
  const total = Math.max(0, Math.floor(durationMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordingControls() {
  const [durationMs, setDurationMs] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const offTick = window.snapora.recording.onTick(({ durationMs: ms }) => {
      setDurationMs(ms);
    });
    const offState = window.snapora.recording.onState((snap) => {
      setPaused(snap.phase === 'paused');
    });
    return () => {
      offTick();
      offState();
    };
  }, []);

  return (
    <div
      className="flex h-full w-full items-center gap-1 rounded-2xl bg-neutral-900/95 px-2 ring-1 ring-white/10 backdrop-blur"
      style={DRAG}
    >
      {/* Stop + timer (one logical group, big red) */}
      <button
        type="button"
        onClick={() => void window.snapora.recording.stop()}
        title="Stop recording"
        aria-label="Stop recording"
        className="grid h-9 w-9 place-items-center rounded-full ring-2 ring-red-500 transition hover:bg-red-500/15"
        style={NO_DRAG}
      >
        <Square className="h-3.5 w-3.5 fill-red-500 text-red-500" />
      </button>
      <span className="select-none px-1 font-mono text-sm font-semibold tabular-nums text-red-500">
        {format(durationMs)}
      </span>

      <Divider />

      {/* Pause / Resume */}
      <ControlButton
        title={paused ? 'Resume recording' : 'Pause recording'}
        onClick={() =>
          paused
            ? void window.snapora.recording.resume?.()
            : void window.snapora.recording.pause?.()
        }
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </ControlButton>

      {/* Restart — discards what's recorded and immediately starts over from t=0 */}
      <ControlButton
        title="Restart recording"
        onClick={() => void window.snapora.recording.restart?.()}
      >
        <RotateCcw className="h-4 w-4" />
      </ControlButton>

      {/* Trash — discard + close (no save) */}
      <ControlButton
        title="Discard recording"
        onClick={() => void window.snapora.recording.cancel()}
        danger
      >
        <Trash2 className="h-4 w-4" />
      </ControlButton>

      {/* Drag handle indicator (whole bar is draggable, this is just the affordance) */}
      <span
        className="ml-0.5 grid h-9 w-5 place-items-center text-white/30"
        title="Drag to move"
        aria-hidden
      >
        <GripVertical className="h-4 w-4" />
      </span>
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={
        'grid h-9 w-9 place-items-center rounded-full text-white/85 transition hover:bg-white/10 hover:text-white' +
        (danger ? ' hover:bg-red-500/20 hover:text-red-300' : '')
      }
      style={NO_DRAG}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />;
}
