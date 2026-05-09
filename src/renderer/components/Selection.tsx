import { useEffect, useRef, useState } from 'react';
import type { SelectionInitPayload } from '@shared/ipc';
import type { SelectionRect } from '@shared/types';

const MIN_DRAG_DIP = 4;

function rectFromPoints(
  anchor: { x: number; y: number },
  current: { x: number; y: number },
): SelectionRect {
  const x = Math.min(anchor.x, current.x);
  const y = Math.min(anchor.y, current.y);
  const width = Math.abs(current.x - anchor.x);
  const height = Math.abs(current.y - anchor.y);
  return { x, y, width, height };
}

export function SelectionOverlay() {
  const [init, setInit] = useState<SelectionInitPayload | null>(null);
  const [rect, setRect] = useState<SelectionRect | null>(null);
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);

  // Wire init: prefer a fresh request, but also subscribe in case main pushes.
  useEffect(() => {
    let cancelled = false;
    void window.snapora.selection.request().then((payload) => {
      if (!cancelled && payload) setInit(payload);
    });
    const off = window.snapora.selection.onInit((payload) => {
      if (!cancelled) setInit(payload);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  // ESC cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void window.snapora.selection.cancel();
      } else if (
        e.key === 'Enter' &&
        rect &&
        rect.width >= MIN_DRAG_DIP &&
        rect.height >= MIN_DRAG_DIP &&
        init
      ) {
        e.preventDefault();
        void window.snapora.selection.commit(init.displayId, rect);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rect, init]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    anchorRef.current = { x: e.clientX, y: e.clientY };
    draggingRef.current = true;
    setRect({ x: e.clientX, y: e.clientY, width: 0, height: 0 });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !anchorRef.current) return;
    setRect(rectFromPoints(anchorRef.current, { x: e.clientX, y: e.clientY }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current || !anchorRef.current || !init) return;
    draggingRef.current = false;
    const final = rectFromPoints(anchorRef.current, { x: e.clientX, y: e.clientY });
    anchorRef.current = null;
    if (final.width < MIN_DRAG_DIP || final.height < MIN_DRAG_DIP) {
      void window.snapora.selection.cancel();
      return;
    }
    void window.snapora.selection.commit(init.displayId, final);
  };

  // While we wait for init, render a transparent surface that still owns
  // input — that way ESC works even if init never arrives.
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        cursor: 'crosshair',
        backgroundColor: rect ? 'transparent' : 'rgba(0, 0, 0, 0.18)',
      }}
    >
      {rect && rect.width > 0 && rect.height > 0 ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              border: '1px dashed rgba(255, 255, 255, 0.95)',
              boxShadow: '0 0 0 100vmax rgba(0, 0, 0, 0.35)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: rect.x + rect.width + 8,
              top: rect.y + rect.height + 8,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'rgba(15, 23, 42, 0.9)',
              color: 'white',
              fontSize: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {Math.round(rect.width)} × {Math.round(rect.height)}
          </div>
        </>
      ) : null}
    </div>
  );
}
