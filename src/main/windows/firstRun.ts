import { BrowserWindow, app } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { getPreferences, setPreferences } from '@main/storage/prefs';

let firstRunWindow: BrowserWindow | null = null;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export function openFirstRunWindow(): BrowserWindow {
  if (firstRunWindow && !firstRunWindow.isDestroyed()) {
    firstRunWindow.show();
    firstRunWindow.focus();
    return firstRunWindow;
  }

  firstRunWindow = new BrowserWindow({
    width: 560,
    height: 640,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Welcome to Snapora',
    show: false,
    backgroundColor: '#0f172a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  firstRunWindow.on('ready-to-show', () => firstRunWindow?.show());
  firstRunWindow.on('closed', () => {
    firstRunWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS !== '0') {
    firstRunWindow.webContents.on('did-finish-load', () => {
      firstRunWindow?.webContents.openDevTools({ mode: 'detach' });
    });
  }

  void firstRunWindow.loadURL(rendererUrl('first-run.html'));
  logger.info('first-run: window created');
  return firstRunWindow;
}

export function closeFirstRunWindow(): void {
  if (firstRunWindow && !firstRunWindow.isDestroyed()) firstRunWindow.close();
}

/** Show the wizard on launch if the user hasn't completed it yet. */
export function maybeShowFirstRunWizard(): void {
  if (getPreferences().seenFirstRun) return;
  openFirstRunWindow();
}

/** Mark the wizard as seen and close the window. */
export function markFirstRunDone(): void {
  setPreferences({ seenFirstRun: true });
  closeFirstRunWindow();
  logger.info('first-run: marked done');
}

/** Quit and respawn — required after the user grants Screen Recording. */
export function relaunchApp(): void {
  logger.info('first-run: relaunching app');
  app.relaunch();
  app.exit(0);
}
