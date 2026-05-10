import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { WindowPickerSource } from '@shared/ipc';
import { cn } from '@renderer/lib/cn';

const DRAG = { WebkitAppRegion: 'drag' } as unknown as React.CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as unknown as React.CSSProperties;

export function WindowPicker() {
  const [sources, setSources] = useState<WindowPickerSource[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await window.snapora.recording.windowPickerList();
        if (!cancelled) setSources(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.snapora.recording.windowPickerCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const filtered = useMemo(() => {
    if (!sources) return [];
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter((s) => s.name.toLowerCase().includes(q));
  }, [sources, query]);

  const pick = (sourceId: string): void => {
    window.snapora.recording.windowPickerPick(sourceId);
  };

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-slate-900/95 ring-1 ring-white/10 backdrop-blur"
      style={DRAG}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between border-b border-white/5 px-4 py-3"
        style={DRAG}
      >
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white/95">Pick a window to record</span>
          <span className="text-[11px] text-white/45">Esc to cancel</span>
        </div>
        <button
          type="button"
          aria-label="Cancel"
          onClick={() => window.snapora.recording.windowPickerCancel()}
          className="grid h-7 w-7 place-items-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white/95"
          style={NO_DRAG}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-2 pt-3" style={NO_DRAG}>
        <input
          type="text"
          autoFocus
          value={query}
          placeholder="Search windows…"
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md bg-white/[0.06] px-3 py-1.5 text-sm text-white/95 placeholder:text-white/35 ring-1 ring-white/10 outline-none focus:ring-white/20"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-3" style={NO_DRAG}>
        {error && <div className="px-2 py-3 text-sm text-red-300">Error: {error}</div>}
        {!sources && !error && (
          <div className="grid h-full place-items-center text-xs text-white/45">
            Loading windows…
          </div>
        )}
        {sources && filtered.length === 0 && !error && (
          <div className="grid h-full place-items-center text-xs text-white/45">
            No windows match your search.
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {filtered.map((s) => (
            <WindowTile key={s.id} source={s} onPick={() => pick(s.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function WindowTile({ source, onPick }: { source: WindowPickerSource; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'group flex flex-col gap-1 overflow-hidden rounded-lg p-1.5 text-left transition',
        'hover:bg-white/[0.06] focus:bg-white/[0.08] focus:outline-none',
      )}
    >
      <div className="aspect-video overflow-hidden rounded-md bg-black/40 ring-1 ring-white/5">
        {source.thumbnail ? (
          <img
            src={source.thumbnail}
            alt=""
            draggable={false}
            className="h-full w-full object-contain"
          />
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 px-1">
        {source.appIcon && (
          <img src={source.appIcon} alt="" className="h-3.5 w-3.5 flex-shrink-0" />
        )}
        <span className="truncate text-xs text-white/85">{source.name}</span>
      </div>
    </button>
  );
}
