import { BrowserWindow, systemPreferences } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { getPreferences } from '@main/storage/prefs';
import { IPC } from '@shared/ipc';

/**
 * Transparent, click-through, fullscreen overlay shown during a recording.
 * Hosts two effects:
 *   1. Click highlight  — animated ring at the global mouse-down location.
 *   2. Keystroke pill   — bottom pill rendering the last few keys pressed.
 *
 * Global mouse + keyboard events come from `uiohook-napi`. Loaded lazily so
 * a missing addon (or revoked Accessibility permission) doesn't break the
 * rest of recording — we just skip the overlay and continue.
 */

let win: BrowserWindow | null = null;
type UiohookHandle = {
  on: (event: 'mousedown' | 'keydown', handler: (e: unknown) => void) => void;
  off: (event: string, handler: (e: unknown) => void) => void;
  start: () => void;
  stop: () => void;
};
let uiohook: UiohookHandle | null = null;
let mouseHandler: ((e: unknown) => void) | null = null;
let keyHandler: ((e: unknown) => void) | null = null;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export interface ShowEffectsArgs {
  wantClicks: boolean;
  wantKeys: boolean;
  recordingDisplay: Electron.Display;
}

export function showEffectsWindow(args: ShowEffectsArgs): void {
  if (!args.wantClicks && !args.wantKeys) return;

  // Accessibility is required by uiohook for ANY global hook on macOS (mouse
  // + keyboard alike). If the user hasn't granted it, fire the OS-level
  // prompt-and-add-to-TCC flow (the `true` arg) and degrade gracefully so
  // we don't crash the recording session.
  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    systemPreferences.isTrustedAccessibilityClient(true);
    logger.warn(
      'recording: skipping effects overlay — Accessibility not granted; OS prompt opened',
    );
    return;
  }

  const display = args.recordingDisplay;
  const bounds = display.bounds;

  if (win && !win.isDestroyed()) {
    win.setBounds(bounds);
    win.show();
    pushPrefs(args);
    return;
  }

  win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    focusable: false,
    roundedCorners: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Above the recording-controls bar; fully click-through.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setWindowButtonVisibility?.(false);

  win.on('closed', () => {
    if (win) win = null;
  });

  void win.loadURL(rendererUrl('recording-effects.html'));
  win.once('ready-to-show', () => {
    win?.show();
    pushPrefs(args);
    startGlobalHooks(args);
  });
  logger.info('recording: effects window created', {
    wantClicks: args.wantClicks,
    wantKeys: args.wantKeys,
  });
}

function pushPrefs(args: ShowEffectsArgs): void {
  if (!win || win.isDestroyed()) return;
  const prefs = getPreferences();
  win.webContents.send(IPC.recording.onEffectsConfig, {
    clicks: {
      enabled: args.wantClicks,
      color: prefs.recordingClickColor,
      size: prefs.recordingClickSize,
      style: prefs.recordingClickStyle,
      animated: prefs.recordingClickAnimated,
    },
    keys: {
      enabled: args.wantKeys,
      position: prefs.recordingKeyPosition,
      size: prefs.recordingKeySize,
      style: prefs.recordingKeyStyle,
      onlyCommandKeys: prefs.recordingKeyOnlyCommandKeys,
    },
    displayBounds: args.recordingDisplay.bounds,
    displayScaleFactor: args.recordingDisplay.scaleFactor,
  });
}

async function startGlobalHooks(args: ShowEffectsArgs): Promise<void> {
  // Lazy-load uiohook so a missing/broken native addon doesn't crash main.
  try {
    const mod = (await import('uiohook-napi')) as unknown as { uIOhook: UiohookHandle };
    uiohook = mod.uIOhook;
  } catch (err) {
    logger.warn('recording: uiohook-napi unavailable, skipping global hooks', err);
    uiohook = null;
    return;
  }

  mouseHandler = (e: unknown) => {
    if (!win || win.isDestroyed() || !args.wantClicks) return;
    // libuiohook on macOS calls CGEventGetLocation which returns POINTS
    // (DIPs), not physical pixels — same units as Electron's display.bounds.
    // Just subtract the display origin to get window-local coordinates.
    const { x, y } = e as { x: number; y: number };
    const localX = x - args.recordingDisplay.bounds.x;
    const localY = y - args.recordingDisplay.bounds.y;
    win.webContents.send(IPC.recording.onClickEvent, { x: localX, y: localY });
  };

  keyHandler = (e: unknown) => {
    if (!win || win.isDestroyed() || !args.wantKeys) return;
    win.webContents.send(IPC.recording.onKeyEvent, e);
  };

  try {
    uiohook.on('mousedown', mouseHandler);
    uiohook.on('keydown', keyHandler);
    uiohook.start();
    logger.info('recording: uiohook started');
  } catch (err) {
    logger.warn('recording: uiohook start failed', err);
    uiohook = null;
  }
}

function stopGlobalHooks(): void {
  if (!uiohook) return;
  try {
    if (mouseHandler) uiohook.off('mousedown', mouseHandler);
    if (keyHandler) uiohook.off('keydown', keyHandler);
    uiohook.stop();
  } catch (err) {
    logger.warn('recording: uiohook stop failed', err);
  }
  uiohook = null;
  mouseHandler = null;
  keyHandler = null;
}

export function closeEffectsWindow(): void {
  stopGlobalHooks();
  if (win && !win.isDestroyed()) win.close();
  win = null;
}
