import { BrowserWindow, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { IPC, type SelectionInitPayload } from '@shared/ipc';
import type { SelectionRect } from '@shared/types';
import { isRectMeaningful, localToGlobalDips } from '@main/selection/geometry';

export interface SelectionResult {
  cancelled: boolean;
  /** Global-DIP rect (origin = primary display top-left). Null when cancelled. */
  rect: SelectionRect | null;
  /** Display the user actually drew on, when not cancelled. */
  displayId: number | null;
}

type OverlayState = 'idle' | 'open' | 'closing';

interface PendingSelection {
  resolve: (result: SelectionResult) => void;
  windows: BrowserWindow[];
  /** Map windowId → SelectionInitPayload, so `selection:request` can answer. */
  inits: Map<number, SelectionInitPayload>;
  state: OverlayState;
}

let pending: PendingSelection | null = null;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

function createOverlayForDisplay(display: Electron.Display): BrowserWindow {
  const win = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    roundedCorners: false,
    backgroundColor: '#00000000',
    show: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 'screen-saver' is required to sit above the menu bar and the Dock.
  // 'floating' (used by the HUD) is not high enough.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setWindowButtonVisibility?.(false);

  if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS === '1') {
    win.webContents.on('did-finish-load', () => {
      win.webContents.openDevTools({ mode: 'detach' });
    });
  }

  void win.loadURL(rendererUrl('selection.html'));
  return win;
}

function tearDown(result: SelectionResult): void {
  if (!pending) return;
  if (pending.state === 'closing') return;
  pending.state = 'closing';
  const { windows, resolve } = pending;
  pending = null;
  for (const w of windows) {
    if (!w.isDestroyed()) w.close();
  }
  resolve(result);
}

function onCommit(_evt: unknown, payload: { displayId: number; rect: SelectionRect }): void {
  if (!pending || pending.state !== 'open') return;
  const init = [...pending.inits.values()].find((i) => i.displayId === payload.displayId);
  if (!init) {
    logger.warn('selection: commit from unknown displayId', payload);
    tearDown({ cancelled: true, rect: null, displayId: null });
    return;
  }
  if (!isRectMeaningful(payload.rect)) {
    logger.info('selection: commit too small, treating as cancel', payload.rect);
    tearDown({ cancelled: true, rect: null, displayId: null });
    return;
  }
  const global = localToGlobalDips(payload.rect, init);
  logger.info('selection: committed', { displayId: payload.displayId, rect: global });
  tearDown({ cancelled: false, rect: global, displayId: payload.displayId });
}

function onCancel(): void {
  if (!pending || pending.state !== 'open') return;
  logger.info('selection: cancelled by renderer');
  tearDown({ cancelled: true, rect: null, displayId: null });
}

function onRequest(evt: Electron.IpcMainInvokeEvent): SelectionInitPayload | null {
  if (!pending) return null;
  const win = BrowserWindow.fromWebContents(evt.sender);
  if (!win) return null;
  return pending.inits.get(win.id) ?? null;
}

/**
 * Register the IPC listeners that ferry user input back from the overlay
 * renderers. Call once at startup from `registerIpcHandlers`.
 */
export function registerSelectionHandlers(): void {
  ipcMain.on(IPC.selection.commit, onCommit);
  ipcMain.on(IPC.selection.cancel, onCancel);
  ipcMain.handle(IPC.selection.request, onRequest);
  screen.on('display-removed', () => {
    if (pending && pending.state === 'open') {
      logger.warn('selection: display removed mid-selection, cancelling');
      tearDown({ cancelled: true, rect: null, displayId: null });
    }
  });
}

/**
 * Show the selection overlay (one transparent window per display) and
 * resolve once the user commits a rect or cancels with ESC.
 *
 * Concurrent calls reject — only one selection at a time.
 */
export function pickRegion(): Promise<SelectionResult> {
  if (pending) {
    return Promise.resolve({ cancelled: true, rect: null, displayId: null });
  }

  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  const inits = new Map<number, SelectionInitPayload>();
  const windows: BrowserWindow[] = [];

  return new Promise<SelectionResult>((resolve) => {
    pending = { resolve, windows, inits, state: 'open' };

    for (const display of displays) {
      const win = createOverlayForDisplay(display);
      windows.push(win);
      const init: SelectionInitPayload = {
        displayId: display.id,
        bounds: display.bounds,
        scaleFactor: display.scaleFactor,
        isPrimary: display.id === primaryId,
      };
      inits.set(win.id, init);

      const sendInit = (): void => {
        if (win.isDestroyed()) return;
        win.webContents.send(IPC.selection.init, init);
        win.show();
        win.focus();
      };
      if (win.webContents.isLoading()) {
        win.webContents.once('did-finish-load', sendInit);
      } else {
        sendInit();
      }

      win.on('closed', () => {
        // If a window dies unexpectedly while we're still open, cancel.
        if (pending && pending.state === 'open') {
          const stillAlive = pending.windows.some((w) => !w.isDestroyed());
          if (!stillAlive) {
            tearDown({ cancelled: true, rect: null, displayId: null });
          }
        }
      });
    }
  });
}
