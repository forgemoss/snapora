import { BrowserWindow, desktopCapturer, screen } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { findWindowBounds } from '@main/recording/windowBounds';
import type { WindowPickerSource } from '@shared/ipc';
import type { SelectionRect } from '@shared/types';

/**
 * Floating thumbnail-grid picker shown when the user starts a window
 * recording. Modeled after CleanShot's "Record Window" overlay.
 *
 * Limitation: Electron's `desktopCapturer` returns thumbnails but no window
 * bounds — without native code (CGS / Accessibility) we can't crop the
 * recording to the window rect. For now `pickWindow()` resolves with the
 * picked source's display_id and the caller records that whole display.
 * Pixel-perfect window crop is a v0.5 follow-up that will need a small
 * native helper.
 */

const W = 720;
const H = 520;

let win: BrowserWindow | null = null;
let pendingResolve: ((value: WindowPickResult) => void) | null = null;

export interface WindowPickResult {
  cancelled: boolean;
  /** The display id (Electron `Display.id`) the picked window is on. */
  displayId: number | null;
  sourceId: string | null;
  sourceName: string | null;
  /** DIPs rect of the picked window (resolved via System Events). null = couldn't resolve. */
  rect: SelectionRect | null;
}

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export async function listCapturableWindows(): Promise<WindowPickerSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 320, height: 200 },
    fetchWindowIcons: true,
  });
  return sources
    .filter((s) => s.name && s.name.trim().length > 0)
    .map((s) => ({
      id: s.id,
      name: s.name,
      appIcon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
      thumbnail: s.thumbnail.toDataURL(),
      displayId: s.display_id ?? '',
    }));
}

/** Resolve a desktopCapturer `display_id` (string) to an Electron display.id. */
function resolveDisplayId(displayIdStr: string): number | null {
  if (!displayIdStr) return null;
  const all = screen.getAllDisplays();
  // display_id on macOS is typically a numeric string matching Display.id.
  const numeric = Number(displayIdStr);
  if (!Number.isNaN(numeric)) {
    const hit = all.find((d) => d.id === numeric);
    if (hit) return hit.id;
  }
  return null;
}

export function pickWindow(): Promise<WindowPickResult> {
  // One picker at a time — close any previous and reject its promise.
  if (win && !win.isDestroyed()) {
    pendingResolve?.({
      cancelled: true,
      displayId: null,
      sourceId: null,
      sourceName: null,
      rect: null,
    });
    win.close();
  }

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const x = Math.round(display.workArea.x + display.workArea.width / 2 - W / 2);
  const y = Math.round(display.workArea.y + display.workArea.height / 2 - H / 2);

  return new Promise<WindowPickResult>((resolve) => {
    pendingResolve = resolve;

    win = new BrowserWindow({
      x,
      y,
      width: W,
      height: H,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: true,
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      roundedCorners: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    win.on('closed', () => {
      if (win) win = null;
      const r = pendingResolve;
      pendingResolve = null;
      r?.({
        cancelled: true,
        displayId: null,
        sourceId: null,
        sourceName: null,
        rect: null,
      });
    });

    void win.loadURL(rendererUrl('recording-window-picker.html'));
    win.once('ready-to-show', () => win?.show());
    logger.info('recording: window picker shown');
  });
}

export async function commitPick(sourceId: string): Promise<void> {
  let displayId: number | null = null;
  let sourceName: string | null = null;
  let rect: SelectionRect | null = null;
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 1, height: 1 },
    });
    const hit = sources.find((s) => s.id === sourceId);
    if (hit) {
      sourceName = hit.name;
      displayId = resolveDisplayId(hit.display_id ?? '');
      // Look up bounds via System Events. This lets ffmpeg crop the display
      // capture down to JUST this window — same path region recordings
      // take, just sourced from osascript instead of a user drag.
      rect = await findWindowBounds(hit.name, null);
      if (rect) {
        logger.info('recording: window bounds resolved', { name: hit.name, rect });
      } else {
        logger.warn('recording: window bounds not found — falling back to full display', {
          name: hit.name,
        });
      }
    }
  } catch (err) {
    logger.warn('recording: window picker resolve failed', err);
  }
  if (displayId == null) {
    displayId = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
  }

  const r = pendingResolve;
  pendingResolve = null;
  if (win && !win.isDestroyed()) win.close();
  win = null;
  r?.({ cancelled: false, displayId, sourceId, sourceName, rect });
}

export function cancelPick(): void {
  const r = pendingResolve;
  pendingResolve = null;
  if (win && !win.isDestroyed()) win.close();
  win = null;
  r?.({ cancelled: true, displayId: null, sourceId: null, sourceName: null, rect: null });
}
