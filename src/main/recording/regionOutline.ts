import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import type { SelectionRect } from '@shared/types';

/**
 * Tiny click-through borderless window that paints a colored outline around
 * the exact rect that will be recorded. Shown alongside the stage toolbar
 * so the user can VISUALLY confirm the bounds before committing.
 *
 * - Click-through (`setIgnoreMouseEvents`) so the user can interact with
 *   whatever is behind the outline.
 * - `setContentProtection(true)` so this overlay does NOT show up in the
 *   actual recording (the stage closes the overlay before ffmpeg starts).
 */

let win: BrowserWindow | null = null;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export function showRegionOutline(rect: SelectionRect): void {
  if (win && !win.isDestroyed()) {
    win.setBounds({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    win.show();
    return;
  }

  win = new BrowserWindow({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
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
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setContentProtection(true);

  win.on('closed', () => {
    if (win) win = null;
  });

  void win.loadURL(rendererUrl('recording-region-outline.html'));
  win.once('ready-to-show', () => win?.show());
  logger.info('recording: region outline shown', { rect });
}

export function closeRegionOutline(): void {
  if (win && !win.isDestroyed()) win.close();
  win = null;
}
