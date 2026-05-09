import { BrowserWindow, dialog, shell } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';

let settingsWindow: BrowserWindow | null = null;

function rendererUrl(file: string): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 760,
    height: 560,
    minWidth: 640,
    minHeight: 460,
    title: 'Snapora — Settings',
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

  settingsWindow.on('ready-to-show', () => settingsWindow?.show());
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS !== '0') {
    settingsWindow.webContents.on('did-finish-load', () => {
      settingsWindow?.webContents.openDevTools({ mode: 'detach' });
    });
  }

  void settingsWindow.loadURL(rendererUrl('settings.html'));
  logger.info('settings: window created');
  return settingsWindow;
}

/**
 * IPC helper exposed to the renderer for the "Choose folder" button on
 * the General settings page. Returns a path or null on cancel.
 */
export async function chooseSaveDirectory(): Promise<string | null> {
  const focused = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(focused ?? new BrowserWindow({ show: false }), {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose Snapora save folder',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0] ?? null;
}
