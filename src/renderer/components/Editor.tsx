import { Copy, Pencil, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WindowChrome, WindowFooter, WindowShell } from './Layout';
import { Button } from './ui/button';

/**
 * v0.1 — placeholder editor that displays the captured image with a basic action bar.
 * v0.3 — replaces the centered <img> with a Konva-backed annotation canvas.
 */
export function Editor() {
  // Receives a snap:// URL from the main process; usable directly in <img src>.
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe first so we don't miss a push that arrives while we're requesting.
    const off = window.snapora.editor.onImageReady((url: string) => setImageUrl(url));
    // Also pull the current image — covers the race where main pushed
    // before this effect ran (e.g. first capture after window creation).
    void window.snapora.editor.requestCurrent().then((url) => {
      if (url) setImageUrl(url);
    });
    return off;
  }, []);

  const hasImage = imageUrl !== null;

  return (
    <WindowShell>
      <WindowChrome
        title={hasImage ? shortPathFromSnapUrl(imageUrl!) : 'Snapora — Editor'}
        right={
          hasImage ? (
            <>
              <Button variant="ghost" size="sm" disabled title="Annotate (v0.3)">
                <Pencil className="h-3.5 w-3.5" />
                Annotate
              </Button>
              <Button variant="ghost" size="sm" title="Copy to clipboard">
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Button variant="primary" size="sm" title="Save as…">
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </>
          ) : null
        }
      />
      <main className="grid flex-1 place-items-center overflow-auto p-8">
        {hasImage ? (
          <img
            src={imageUrl}
            alt="captured"
            className="max-h-full max-w-full rounded-lg shadow-2xl ring-1 ring-white/10"
          />
        ) : (
          <div className="text-center text-white/40">
            <p className="text-sm">No capture yet</p>
            <p className="mt-1 text-xs">Press your hotkey to take a screenshot.</p>
          </div>
        )}
      </main>
      <WindowFooter>
        <span>Annotation tools coming in v0.3 — see ROADMAP.md</span>
        {hasImage ? <span className="font-mono">PNG</span> : null}
      </WindowFooter>
    </WindowShell>
  );
}

function shortPathFromSnapUrl(snapUrl: string): string {
  // snap:///Users/.../Snapora%20foo.png → readable last few segments
  try {
    const path = decodeURIComponent(new URL(snapUrl).pathname);
    const parts = path.split('/');
    if (parts.length <= 4) return path;
    return `…/${parts.slice(-3).join('/')}`;
  } catch {
    return snapUrl;
  }
}
