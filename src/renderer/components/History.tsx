import { FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@renderer/lib/cn';
import type { HistoryItem } from '@shared/ipc';
import { WindowChrome, WindowShell } from './Layout';
import { Button } from './ui/button';

export function History() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);

  const refresh = useCallback(async () => {
    const next = await window.snapora.history.list(200);
    setItems(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleClearAll = async () => {
    if (!confirm('Clear all history? This does not delete the image files on disk.')) return;
    await window.snapora.history.clearAll();
    await refresh();
  };

  const handleDelete = async (id: number, alsoFile: boolean) => {
    await window.snapora.history.deleteEntry(id, alsoFile);
    await refresh();
  };

  return (
    <WindowShell>
      <WindowChrome
        title={`History${items ? ` · ${items.length}` : ''}`}
        right={
          items && items.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={handleClearAll}>
              Clear all
            </Button>
          ) : null
        }
      />
      <main className="flex-1 overflow-y-auto p-6">
        {items === null ? (
          <EmptyState message="Loading…" />
        ) : items.length === 0 ? (
          <EmptyState message="No captures yet. Press ⌘⇧2 to take your first screenshot." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {items.map((item) => (
              <HistoryCard key={item.id} item={item} onDelete={handleDelete} />
            ))}
          </ul>
        )}
      </main>
    </WindowShell>
  );
}

function HistoryCard({
  item,
  onDelete,
}: {
  item: HistoryItem;
  onDelete: (id: number, alsoFile: boolean) => void;
}) {
  const date = new Date(item.capturedAt);

  return (
    <li
      className={cn(
        'group relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.025] transition hover:border-white/10',
        !item.exists && 'opacity-50',
      )}
    >
      <div className="aspect-video overflow-hidden bg-black/30">
        {item.exists ? (
          <img src={item.snapUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-white/40">
            File missing
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-white/85">
            {date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-white/40">
            {item.mode}
            {item.width && item.height ? (
              <>
                {' · '}
                {item.width}×{item.height}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <IconButton
            label="Open in editor"
            onClick={() => void window.snapora.history.openInEditor(item.id)}
            disabled={!item.exists}
          >
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="Reveal in Finder"
            onClick={() => void window.snapora.history.revealInFinder(item.id)}
            disabled={!item.exists}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Delete (also remove file)" onClick={() => onDelete(item.id, true)}>
            <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
          </IconButton>
        </div>
      </div>
    </li>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-7 w-7 place-items-center rounded-md text-white/65 transition hover:bg-white/5 hover:text-white/95 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center text-center text-sm text-white/45">
      {message}
    </div>
  );
}
