import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { toSnapUrl } from '@main/security/protocol';
import { IPC } from '@shared/ipc';

/**
 * Quick Access HUD — small frameless window that appears bottom-right after
 * every capture. Lets the user Copy / Save / Edit / discard without opening
 * the full editor.
 *
 * Note on transparent windows: macOS + Electron transparent + alwaysOnTop +
 * showInactive does NOT reliably deliver click events to WebKit, even with
 * acceptFirstMouse. Until that's resolved upstream we ship a solid-background
 * HUD that's normally interactive.
 */

const HUD_WIDTH = 240;
const HUD_HEIGHT = 160;
const HUD_MARGIN = 20;

let hudWindow: BrowserWindow | null = null;
let currentImagePath: string | null = null;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

function positionBottomRight(win: BrowserWindow): void {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { workArea } = display;
  const x = Math.round(workArea.x + workArea.width - HUD_WIDTH - HUD_MARGIN);
  const y = Math.round(workArea.y + workArea.height - HUD_HEIGHT - HUD_MARGIN);
  win.setBounds({ x, y, width: HUD_WIDTH, height: HUD_HEIGHT });
}

function createHudWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: HUD_WIDTH,
    height: HUD_HEIGHT,
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
    if (hudWindow === win) hudWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS !== '0') {
    win.webContents.on('did-finish-load', () => {
      win.webContents.openDevTools({ mode: 'detach' });
    });
  }

  void win.loadURL(rendererUrl('hud.html'));
  return win;
}

export function showHudWithImage(filePath: string): void {
  currentImagePath = filePath;
  const url = toSnapUrl(filePath);

  if (!hudWindow || hudWindow.isDestroyed()) {
    hudWindow = createHudWindow();
  }

  positionBottomRight(hudWindow);

  const send = () => hudWindow?.webContents.send(IPC.hud.onImageReady, url);
  if (hudWindow.webContents.isLoading()) {
    hudWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }

  hudWindow.show();
  logger.info('hud: shown', { filePath });
}

export function dismissHud(): void {
  if (hudWindow && !hudWindow.isDestroyed()) {
    hudWindow.hide();
  }
}

export function getHudCurrentImage(): { filePath: string | null; url: string | null } {
  return {
    filePath: currentImagePath,
    url: currentImagePath ? toSnapUrl(currentImagePath) : null,
  };
}
