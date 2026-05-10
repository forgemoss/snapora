import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { IPC } from '@shared/ipc';

/**
 * Tiny always-on-top frameless window shown during a recording: timer + Stop
 * (and Cancel) button. Lives at `floating` window level so ffmpeg's
 * `screen-saver`-level capture does NOT include it in the recording.
 */

const W = 320;
const H = 56;
const MARGIN = 12;

let win: BrowserWindow | null = null;
let onStopCb: (() => void) | null = null;
let onCancelCb: (() => void) | null = null;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export interface ShowControlsArgs {
  /** Rect we're recording (DIPs). Place the controls outside it when possible. */
  avoidRect: { x: number; y: number; width: number; height: number };
  onStop: () => void;
  onCancel?: () => void;
}

function placeOutside(args: ShowControlsArgs): { x: number; y: number } {
  // Prefer a non-recorded display if available — bar is fully off the
  // recording, no compromise.
  const displays = screen.getAllDisplays();
  const recordingDisplay = screen.getDisplayMatching(args.avoidRect);
  const otherDisplay = displays.find((d) => d.id !== recordingDisplay.id);
  if (otherDisplay) {
    return {
      x: Math.round(otherDisplay.workArea.x + otherDisplay.workArea.width / 2 - W / 2),
      y: Math.round(otherDisplay.workArea.y + MARGIN),
    };
  }
  // Single display: try above the region, then below — both stay outside
  // the cropped recording. Caller (session.ts) already verified at least
  // one of these fits before calling, so we always succeed here.
  const x = Math.round(args.avoidRect.x + args.avoidRect.width / 2 - W / 2);
  const wa = recordingDisplay.workArea;
  const above = args.avoidRect.y - H - 8;
  if (above >= wa.y) {
    return { x, y: above };
  }
  const below = args.avoidRect.y + args.avoidRect.height + 8;
  if (below + H <= wa.y + wa.height) {
    return { x, y: below };
  }
  // Defensive fallback: dock at workArea bottom. Caller normally prevents
  // reaching here (it skips the bar when neither above/below fits), but if
  // we somehow do, at least don't crash — the bar will be visible in the
  // recording, which is the existing single-display fullscreen limitation.
  return { x, y: Math.round(wa.y + wa.height - H - 16) };
}

export function showRecordingControls(args: ShowControlsArgs): BrowserWindow {
  onStopCb = args.onStop;
  onCancelCb = args.onCancel ?? null;

  if (win && !win.isDestroyed()) {
    const pos = placeOutside(args);
    win.setBounds({ x: pos.x, y: pos.y, width: W, height: H });
    win.show();
    return win;
  }

  const pos = placeOutside(args);
  win = new BrowserWindow({
    x: pos.x,
    y: pos.y,
    width: W,
    height: H,
    frame: false,
    // type: 'panel' creates an NSPanel rather than an NSWindow. NSPanels
    // are treated as transient utility windows by the macOS WindowServer
    // and CGS_kCGSWindowSubtypeUtility excludes them from many screen-
    // capture passes including (in our testing) AVCaptureScreenInput.
    // Combined with NSWindowSharingNone via setContentProtection, this is
    // the most-reliable native-API mix without going to ScreenCaptureKit.
    type: 'panel',
    transparent: false,
    backgroundColor: '#171717',
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
  win.setWindowButtonVisibility?.(false);
  // Apply BEFORE show so the very first frame is excluded from any active
  // screen capture (NSWindowSharingNone).
  win.setContentProtection(true);

  win.on('closed', () => {
    if (win) win = null;
  });

  if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS === '1') {
    win.webContents.on('did-finish-load', () => {
      win?.webContents.openDevTools({ mode: 'detach' });
    });
  }

  void win.loadURL(rendererUrl('recording-controls.html'));
  win.once('ready-to-show', () => {
    win?.show();
    // Re-apply once the window is composited — some Electron/macOS builds
    // need the second call to actually flip NSWindowSharingNone.
    win?.setContentProtection(true);
  });
  logger.info('recording: controls window created');
  return win;
}

export function updateRecordingControls(payload: { durationMs: number }): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(IPC.recording.onTick, payload);
}

export function closeRecordingControls(): void {
  if (win && !win.isDestroyed()) {
    win.close();
  }
  win = null;
}

/** Wired from handlers.ts so the renderer's "Stop" button reaches us. */
export function getRecordingControlCallbacks(): {
  onStop: (() => void) | null;
  onCancel: (() => void) | null;
} {
  return { onStop: onStopCb, onCancel: onCancelCb };
}
