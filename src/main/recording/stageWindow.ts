import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { closeEffectsWindow } from '@main/recording/effectsWindow';
import { closeRegionOutline, showRegionOutline } from '@main/recording/regionOutline';
import { closeWebcamWindow } from '@main/recording/webcamWindow';
import { IPC } from '@shared/ipc';
import type { SelectionRect } from '@shared/types';

/**
 * Pre-recording "stage" toolbar — appears over the user's selected region
 * after they've dragged a rect, BEFORE the recording actually starts.
 *
 * Mirrors the CleanShot UX: size readout, microphone / system-audio /
 * camera / clicks / keystrokes toggles, and a Record GIF / Record Video
 * action menu. The user adjusts the per-recording settings here, then
 * commits with one of the action buttons.
 *
 * Lives at `floating` window level (below the eventual avfoundation capture
 * level so it doesn't appear in the recording itself). Closes the moment
 * the user commits / cancels.
 */

const W = 360;
const H = 218;
const MARGIN = 12;

export function getStageWindow(): BrowserWindow | null {
  return win;
}

let win: BrowserWindow | null = null;
let pendingResolve: ((value: StageResult) => void) | null = null;
let pendingInit: StageInit | null = null;

/** Renderer-pull entry: the stage UI calls this on mount instead of relying
 * on a ready-to-show push (which races React's useEffect registration). */
export function getPendingStageInit(): StageInit | null {
  return pendingInit;
}

export interface StageInit {
  region: SelectionRect;
  /** Display the user dragged on, used to position the stage. */
  displayId: number;
}

/**
 * What the stage hands back to the caller once the user clicks Record.
 * `cancelled` is true when the user closes the stage without recording.
 */
export interface StageResult {
  cancelled: boolean;
  output: 'mp4' | 'gif';
  recordMicrophone: boolean;
  recordWebcam: boolean;
  captureClicks: boolean;
  captureKeystrokes: boolean;
}

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

function placeBelowRegion(region: SelectionRect): { x: number; y: number } {
  const display = screen.getDisplayMatching(region);
  // Prefer the strip just below the rect; if no room there, drop to just
  // above. Last resort: tuck inside the bottom edge of the rect.
  const x = Math.round(region.x + region.width / 2 - W / 2);
  const below = region.y + region.height + MARGIN;
  const above = region.y - H - MARGIN;
  if (below + H <= display.workArea.y + display.workArea.height) {
    return { x: clampInsideDisplay(x, display, W), y: below };
  }
  if (above >= display.workArea.y) {
    return { x: clampInsideDisplay(x, display, W), y: above };
  }
  return {
    x: clampInsideDisplay(x, display, W),
    y: Math.round(region.y + region.height - H - MARGIN),
  };
}

function clampInsideDisplay(x: number, display: Electron.Display, width: number): number {
  const min = display.workArea.x + 8;
  const max = display.workArea.x + display.workArea.width - width - 8;
  return Math.max(min, Math.min(max, x));
}

/**
 * Show the stage toolbar over the selected region. Resolves with the
 * user's choice (record video / record gif / cancel).
 */
export function showRecordingStage(init: StageInit): Promise<StageResult> {
  // Only one stage at a time — close any previous and reject its promise.
  if (win && !win.isDestroyed()) {
    pendingResolve?.({ cancelled: true } as StageResult);
    win.close();
  }

  const pos = placeBelowRegion(init.region);
  pendingInit = init;

  // Visible outline around the recording region — so the user can SEE the
  // exact bounds before committing. Closed in commitStage / cancelStage.
  showRegionOutline(init.region);

  return new Promise<StageResult>((resolve) => {
    pendingResolve = resolve;

    win = new BrowserWindow({
      x: pos.x,
      y: pos.y,
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
    win.setWindowButtonVisibility?.(false);

    win.on('closed', () => {
      if (win) win = null;
      pendingInit = null;
      const r = pendingResolve;
      pendingResolve = null;
      // Default if window closed without an explicit commit/cancel.
      r?.({ cancelled: true } as StageResult);
    });

    if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS === '1') {
      win.webContents.on('did-finish-load', () => {
        win?.webContents.openDevTools({ mode: 'detach' });
      });
    }

    void win.loadURL(rendererUrl('recording-stage.html'));
    win.once('ready-to-show', () => {
      win?.show();
      win?.webContents.send(IPC.recording.onStageInit, init);
    });
    logger.info('recording: stage shown', { region: init.region });
  });
}

/** Called from IPC when the user commits a recording from the stage. */
export function commitStage(result: Omit<StageResult, 'cancelled'>): void {
  const r = pendingResolve;
  pendingResolve = null;
  pendingInit = null;
  if (win && !win.isDestroyed()) win.close();
  win = null;
  closeRegionOutline();
  r?.({ cancelled: false, ...result });
}

/** Called from IPC when the user dismisses the stage without recording. */
export function cancelStage(): void {
  const r = pendingResolve;
  pendingResolve = null;
  pendingInit = null;
  if (win && !win.isDestroyed()) win.close();
  win = null;
  closeRegionOutline();
  // The user backed out — tear down any preview-mode overlays we showed.
  // (When the stage commits, session.ts owns these lifecycles instead.)
  closeWebcamWindow();
  closeEffectsWindow();
  r?.({ cancelled: true } as StageResult);
}
