import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';

let historyWindow: BrowserWindow | null = null;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export function openHistoryWindow(): BrowserWindow {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.show();
    historyWindow.focus();
    return historyWindow;
  }

  historyWindow = new BrowserWindow({
    width: 820,
    height: 600,
    minWidth: 640,
    minHeight: 460,
    title: 'Snapora — History',
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

  historyWindow.on('ready-to-show', () => historyWindow?.show());
  historyWindow.on('closed', () => {
    historyWindow = null;
  });

  historyWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS !== '0') {
    historyWindow.webContents.on('did-finish-load', () => {
      historyWindow?.webContents.openDevTools({ mode: 'detach' });
    });
  }

  void historyWindow.loadURL(rendererUrl('history.html'));
  logger.info('history: window created');
  return historyWindow;
}
