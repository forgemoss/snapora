import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { BrowserWindow, nativeImage, screen } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { ensureFfmpegAvailable } from '@main/capture/binaries';
import { toSnapUrl } from '@main/security/protocol';
import { getPreferences } from '@main/storage/prefs';
import { IPC, type HudCard } from '@shared/ipc';
import type { AppPreferences } from '@shared/types';

/**
 * Quick Access HUD — small frameless window that appears in the corner after
 * every capture. CleanShot-style stack: when multiple captures land in quick
 * succession, they pile up vertically (newest on top) instead of replacing
 * one another. Lets the user copy/save/edit/discard each card individually.
 *
 * Note on transparent windows: macOS + Electron transparent + alwaysOnTop +
 * showInactive does NOT reliably deliver click events to WebKit, even with
 * acceptFirstMouse. Until that's resolved upstream we ship a solid-background
 * HUD that's normally interactive.
 */

const HUD_GAP = 10; // px between stacked cards
const HUD_MARGIN = 20; // px from screen edge
const HUD_MAX_STACK = 5;

const SIZE_BY_PREF: Record<AppPreferences['hudSize'], { width: number; cardHeight: number }> = {
  small: { width: 200, cardHeight: 130 },
  medium: { width: 240, cardHeight: 160 },
  large: { width: 320, cardHeight: 215 },
};

let hudWindow: BrowserWindow | null = null;
let stack: HudCard[] = [];
let nextCardId = 1;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

function dimensions(prefs: AppPreferences): { width: number; cardHeight: number } {
  return SIZE_BY_PREF[prefs.hudSize] ?? SIZE_BY_PREF.medium;
}

function totalHeightForStack(count: number, prefs: AppPreferences): number {
  const { cardHeight } = dimensions(prefs);
  if (count <= 0) return cardHeight;
  return cardHeight * count + HUD_GAP * (count - 1);
}

function placementDisplay(prefs: AppPreferences): Electron.Display {
  if (prefs.hudFollowActiveScreen) {
    return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  }
  return screen.getPrimaryDisplay();
}

function positionForCorner(win: BrowserWindow, height: number, prefs: AppPreferences): void {
  const { width } = dimensions(prefs);
  const display = placementDisplay(prefs);
  const { workArea } = display;
  const right = workArea.x + workArea.width - width - HUD_MARGIN;
  const left = workArea.x + HUD_MARGIN;
  const top = workArea.y + HUD_MARGIN;
  const bottom = workArea.y + workArea.height - height - HUD_MARGIN;

  let x: number, y: number;
  switch (prefs.hudPosition) {
    case 'top-left':
      x = left;
      y = top;
      break;
    case 'top-right':
      x = right;
      y = top;
      break;
    case 'bottom-left':
      x = left;
      y = bottom;
      break;
    case 'bottom-right':
    default:
      x = right;
      y = bottom;
  }
  win.setBounds({ x: Math.round(x), y: Math.round(y), width, height });
}

function createHudWindow(initialHeight: number, prefs: AppPreferences): BrowserWindow {
  const { width } = dimensions(prefs);
  const win = new BrowserWindow({
    width,
    height: initialHeight,
    frame: false,
    // transparent + alwaysOnTop combine in macOS in a way that prevents click
    // delivery — both removed for now. Solid bg + CSS rounded corners gives a
    // similar look while restoring interactivity.
    transparent: false,
    backgroundColor: '#0f172a',
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
  // Stays above other apps without taking the focus-stealing alwaysOnTop level.
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setWindowButtonVisibility?.(false);

  win.on('closed', () => {
    if (hudWindow === win) {
      hudWindow = null;
      stack = [];
    }
  });

  if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS !== '0') {
    win.webContents.on('did-finish-load', () => {
      win.webContents.openDevTools({ mode: 'detach' });
    });
  }

  void win.loadURL(rendererUrl('hud.html'));
  return win;
}

function broadcastStack(): void {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  hudWindow.webContents.send(IPC.hud.onStack, stack);
}

function resizeAndPosition(): void {
  if (!hudWindow || hudWindow.isDestroyed()) return;
  const prefs = getPreferences();
  const height = totalHeightForStack(Math.max(stack.length, 1), prefs);
  positionForCorner(hudWindow, height, prefs);
}

/** Push a fresh capture onto the HUD stack. */
export function showHudWithImage(filePath: string): void {
  const url = toSnapUrl(filePath);
  const img = nativeImage.createFromPath(filePath);
  const size = img.isEmpty() ? null : img.getSize();
  const card: HudCard = {
    id: nextCardId++,
    filePath,
    snapUrl: url,
    width: size?.width ?? null,
    height: size?.height ?? null,
    capturedAt: new Date().toISOString(),
  };

  // Newest on top; cap at HUD_MAX_STACK (oldest dropped off).
  stack = [card, ...stack].slice(0, HUD_MAX_STACK);

  if (!hudWindow || hudWindow.isDestroyed()) {
    const prefs = getPreferences();
    const initialHeight = totalHeightForStack(stack.length, prefs);
    hudWindow = createHudWindow(initialHeight, prefs);
  }

  resizeAndPosition();

  const send = (): void => {
    broadcastStack();
    hudWindow?.show();
  };
  if (hudWindow.webContents.isLoading()) {
    hudWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }

  logger.info('hud: card pushed', { id: card.id, stackSize: stack.length, filePath });
}

export function dismissHud(): void {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.hide();
  }
}

/**
 * Push a recording onto the HUD stack. The thumbnail is a still frame
 * extracted by ffmpeg (`-ss 1 -frames:v 1`); we paint that in the HUD card
 * with a small REC badge instead of trying to play the video.
 */
export async function showHudWithVideo(filePath: string, durationMs: number): Promise<void> {
  const thumbPath = join(tmpdir(), `snapora-hud-thumb-${Date.now()}.png`);
  let thumbReady = false;
  try {
    const ffmpeg = ensureFfmpegAvailable();
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        ffmpeg,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-ss',
          '1',
          '-i',
          filePath,
          '-frames:v',
          '1',
          '-y',
          thumbPath,
        ],
        { stdio: 'ignore' },
      );
      proc.on('error', reject);
      proc.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg thumb exit ${code}`)),
      );
    });
    thumbReady = true;
  } catch (err) {
    logger.warn('hud: video thumbnail extraction failed', err);
  }

  const previewSource = thumbReady ? thumbPath : filePath;
  const previewImg = nativeImage.createFromPath(previewSource);
  const size = previewImg.isEmpty() ? null : previewImg.getSize();
  const card: HudCard = {
    id: nextCardId++,
    filePath,
    // The renderer's <img src=...> uses the snap:// scheme so we can load
    // local files cleanly. Point at the thumbnail PNG (which lives in tmp)
    // so we don't have to make snap:// understand .mp4 streaming.
    snapUrl: toSnapUrl(thumbReady ? thumbPath : filePath),
    width: size?.width ?? null,
    height: size?.height ?? null,
    capturedAt: new Date().toISOString(),
    kind: 'recording',
    durationMs,
  };

  stack = [card, ...stack].slice(0, HUD_MAX_STACK);

  if (!hudWindow || hudWindow.isDestroyed()) {
    const prefs = getPreferences();
    const initialHeight = totalHeightForStack(stack.length, prefs);
    hudWindow = createHudWindow(initialHeight, prefs);
  }
  resizeAndPosition();
  const send = (): void => {
    broadcastStack();
    hudWindow?.show();
  };
  if (hudWindow.webContents.isLoading()) {
    hudWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
  logger.info('hud: recording pushed', {
    id: card.id,
    durationMs,
    filePath,
  });
}

/** Read the current stack — handlers read this directly. */
export function getHudStack(): HudCard[] {
  return stack.slice();
}

/** Find a card by id (returns undefined if not present). */
export function findHudCard(id: number): HudCard | undefined {
  return stack.find((c) => c.id === id);
}

/**
 * Remove one card from the stack. Resizes the window to the new stack
 * height; if the stack is empty after removal, hides the HUD entirely.
 * Returns the removed card so callers can act on its filePath.
 */
export function removeHudCard(id: number): HudCard | undefined {
  const found = stack.find((c) => c.id === id);
  if (!found) return undefined;
  stack = stack.filter((c) => c.id !== id);
  if (stack.length === 0) {
    dismissHud();
  } else {
    resizeAndPosition();
    broadcastStack();
  }
  return found;
}
