import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { getPreferences } from '@main/storage/prefs';
import { IPC } from '@shared/ipc';
import type { AppPreferences } from '@shared/types';

/**
 * Floating webcam preview shown during recording (and optionally always-on
 * via tray). Captures the user's facecam via `getUserMedia` in the renderer
 * and just paints it — ffmpeg pulls the screen pixels (including this
 * window) so we don't need a second avfoundation input.
 *
 * Window level is `screen-saver` so it sits above the recording overlays.
 * We *want* this window captured by ffmpeg.
 */

let win: BrowserWindow | null = null;

function sizeForPref(size: AppPreferences['recordingWebcamSize']): { w: number; h: number } {
  switch (size) {
    case 'small':
      return { w: 160, h: 160 };
    case 'large':
      return { w: 320, h: 320 };
    case 'medium':
    default:
      return { w: 240, h: 240 };
  }
}

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export interface ShowWebcamArgs {
  recordingDisplayBounds: { x: number; y: number; width: number; height: number };
}

function positionForCorner(
  display: { workArea: { x: number; y: number; width: number; height: number } },
  pos: AppPreferences['recordingWebcamPosition'],
  w: number,
  h: number,
  margin = 24,
): { x: number; y: number } {
  const { workArea } = display;
  const right = workArea.x + workArea.width - w - margin;
  const bottom = workArea.y + workArea.height - h - margin;
  switch (pos) {
    case 'top-left':
      return { x: workArea.x + margin, y: workArea.y + margin };
    case 'top-right':
      return { x: right, y: workArea.y + margin };
    case 'bottom-left':
      return { x: workArea.x + margin, y: bottom };
    case 'bottom-right':
    default:
      return { x: right, y: bottom };
  }
}

export function showWebcamWindow(args: ShowWebcamArgs): void {
  const prefs = getPreferences();
  const fullscreen = prefs.recordingWebcamFullscreen;
  const display = screen.getDisplayMatching(args.recordingDisplayBounds);

  let w: number;
  let h: number;
  let x: number;
  let y: number;

  if (fullscreen) {
    w = display.bounds.width;
    h = display.bounds.height;
    x = display.bounds.x;
    y = display.bounds.y;
  } else {
    const dims = sizeForPref(prefs.recordingWebcamSize);
    w = dims.w;
    h = dims.h;
    const pos = positionForCorner(display, prefs.recordingWebcamPosition, w, h);
    x = pos.x;
    y = pos.y;
  }

  if (win && !win.isDestroyed()) {
    win.setBounds({ x, y, width: w, height: h });
    // Bump the level: preview mode lives at 'floating' (NOT captured); during
    // recording we want it captured by ffmpeg, which sits at 'screen-saver'.
    win.setAlwaysOnTop(true, 'screen-saver');
    win.show();
    pushPrefs();
    return;
  }

  win = new BrowserWindow({
    x,
    y,
    width: w,
    height: h,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    // Native shadow follows the rectangle, not our circle/rounded clip, so we
    // disable it and paint a CSS drop-shadow in the renderer that respects
    // the alpha shape. Fullscreen has no shadow regardless.
    hasShadow: false,
    resizable: false,
    movable: !fullscreen,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    roundedCorners: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // screen-saver level so we appear ABOVE app windows in the recording.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setWindowButtonVisibility?.(false);

  win.on('closed', () => {
    if (win) win = null;
  });

  void win.loadURL(rendererUrl('webcam.html'));
  win.once('ready-to-show', () => {
    win?.show();
    pushPrefs();
  });
  logger.info('recording: webcam window created', { size: prefs.recordingWebcamSize, fullscreen });
}

function pushPrefs(): void {
  if (!win || win.isDestroyed()) return;
  const prefs = getPreferences();
  win.webContents.send(IPC.recording.onWebcamPrefs, {
    deviceLabel: prefs.recordingWebcamDevice,
    shape: prefs.recordingWebcamShape,
    mirrored: prefs.recordingWebcamMirrored,
    fullscreen: prefs.recordingWebcamFullscreen,
  });
}

export function closeWebcamWindow(): void {
  if (win && !win.isDestroyed()) win.close();
  win = null;
}

/**
 * Stage-time preview of the webcam — small, rounded, bottom-right of the
 * region (or display). Always non-fullscreen and at `floating` level so it
 * is NOT captured by ffmpeg before the recording actually starts.
 *
 * When the user commits the stage, `showWebcamWindow()` re-bumps this same
 * window to the user's preferred size/level (`screen-saver`) so it carries
 * cleanly into the recording without a flicker.
 */
export function showWebcamPreview(regionBounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): void {
  const W = 160;
  const H = 160;
  const margin = 16;
  const display = screen.getDisplayMatching(regionBounds);

  // Default: bottom-right of the region. If the region is too small to host
  // it comfortably, anchor to the display's bottom-right instead.
  let x: number;
  let y: number;
  if (regionBounds.width >= W + margin * 2 && regionBounds.height >= H + margin * 2) {
    x = Math.round(regionBounds.x + regionBounds.width - W - margin);
    y = Math.round(regionBounds.y + regionBounds.height - H - margin);
  } else {
    x = Math.round(display.workArea.x + display.workArea.width - W - margin);
    y = Math.round(display.workArea.y + display.workArea.height - H - margin);
  }

  if (win && !win.isDestroyed()) {
    win.setBounds({ x, y, width: W, height: H });
    win.setAlwaysOnTop(true, 'floating');
    win.show();
    pushPreviewPrefs();
    return;
  }

  win = new BrowserWindow({
    x,
    y,
    width: W,
    height: H,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    // Native macOS shadow follows the WINDOW's rectangle, not our circle clip,
    // so it leaves a visible square outline around the preview. Keep it off
    // and let the renderer paint a `drop-shadow(...)` that follows the alpha.
    hasShadow: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    roundedCorners: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // 'floating' so the preview itself is NOT in the recording (we're still
  // pre-record). The level gets bumped to 'screen-saver' on stage commit.
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setWindowButtonVisibility?.(false);
  win.on('closed', () => {
    if (win) win = null;
  });

  void win.loadURL(rendererUrl('webcam.html'));
  win.once('ready-to-show', () => {
    win?.show();
    pushPreviewPrefs();
  });
  logger.info('recording: webcam preview shown', { regionBounds });
}

/** Send the preview-flavored prefs (always non-fullscreen). */
function pushPreviewPrefs(): void {
  if (!win || win.isDestroyed()) return;
  const prefs = getPreferences();
  win.webContents.send(IPC.recording.onWebcamPrefs, {
    deviceLabel: prefs.recordingWebcamDevice,
    shape: prefs.recordingWebcamShape,
    mirrored: prefs.recordingWebcamMirrored,
    fullscreen: false,
  });
}
