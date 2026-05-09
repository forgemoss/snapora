import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { toSnapUrl } from '@main/security/protocol';
import { IPC } from '@shared/ipc';

let editorWindow: BrowserWindow | null = null;
let currentImageUrl: string | null = null;

/** Returns the most recent image URL pushed to the editor, or null. */
export function getCurrentEditorImageUrl(): string | null {
  return currentImageUrl;
}

function rendererUrl(file: string): string {
  // electron-vite sets ELECTRON_RENDERER_URL in dev to the Vite dev server origin.
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/${file}`;
  }
  return `file://${join(__dirname, `../renderer/${file}`)}`;
}

export function getOrCreateEditorWindow(): BrowserWindow {
  if (editorWindow && !editorWindow.isDestroyed()) {
    return editorWindow;
  }

  editorWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    title: 'Snapora — Editor',
    show: false,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  editorWindow.on('ready-to-show', () => editorWindow?.show());
  editorWindow.on('closed', () => {
    editorWindow = null;
  });

  editorWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Auto-open DevTools in dev so we can see renderer errors.
  // Set SNAPORA_DEV_TOOLS=0 to disable.
  if (process.env.ELECTRON_RENDERER_URL && process.env.SNAPORA_DEV_TOOLS !== '0') {
    editorWindow.webContents.on('did-finish-load', () => {
      editorWindow?.webContents.openDevTools({ mode: 'detach' });
    });
  }
  editorWindow.webContents.on('render-process-gone', (_e, details) => {
    logger.error('editor: renderer crashed', details);
  });

  void editorWindow.loadURL(rendererUrl('editor.html'));
  logger.info('editor: window created');
  return editorWindow;
}

/** Open the editor window without a captured image — useful for testing UI. */
export function openEditorEmpty(): void {
  const win = getOrCreateEditorWindow();
  win.show();
  win.focus();
}

export function showEditorWithImage(filePath: string): void {
  const win = getOrCreateEditorWindow();
  // Convert to snap:// so the renderer can load the local file safely
  // (file:// is blocked by Electron's web-security from non-file origins).
  currentImageUrl = toSnapUrl(filePath);
  // Push for the case where the renderer is already mounted and listening.
  // The renderer ALSO calls requestCurrent() on mount, which covers the
  // first-capture race where did-finish-load fires before React's useEffect.
  win.webContents.send(IPC.editor.onImageReady, currentImageUrl);
  win.show();
  win.focus();
}
