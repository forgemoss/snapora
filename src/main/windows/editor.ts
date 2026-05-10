import { BrowserWindow, dialog, shell } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { compositeWindowOnBackground } from '@main/capture/compositor';
import { toSnapUrl } from '@main/security/protocol';
import { IPC, type EditorBackgroundConfig, type EditorComposeResult } from '@shared/ipc';

let editorWindow: BrowserWindow | null = null;
let currentImageUrl: string | null = null;
let currentImagePath: string | null = null;

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
  currentImagePath = filePath;
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

/**
 * Re-composite the current editor image with a new background config and
 * replace the file in place. Returns a fresh snap:// URL with a cache-bust
 * suffix so the renderer's <img> reloads.
 *
 * If `config.type === 'none'`, the file is left untouched.
 */
export async function composeEditorImage(
  config: EditorBackgroundConfig,
): Promise<EditorComposeResult> {
  if (!currentImagePath || !currentImageUrl) {
    throw new Error('editor: compose requested but no image is loaded');
  }
  if (config.type === 'none') {
    // Nothing to do — return the current URL with a fresh cache-bust so
    // any renderer-side state updates still trigger an <img> reload.
    return { snapUrl: cacheBust(currentImageUrl) };
  }

  const fallbackHex = '#0f172a';
  await compositeWindowOnBackground({
    inputPath: currentImagePath,
    outputPath: currentImagePath, // replace in place
    background:
      config.type === 'color'
        ? { type: 'color', value: config.value ?? fallbackHex }
        : config.type === 'gradient'
          ? { type: 'gradient', value: config.value ?? fallbackHex }
          : { type: 'image', value: config.value ?? '' },
    paddingPx: config.paddingPx,
    shadowPx: config.shadowPx,
    cornersPx: config.cornersPx,
    alignment: config.alignment,
  });

  const fresh = cacheBust(toSnapUrl(currentImagePath));
  currentImageUrl = fresh;
  logger.info('editor: composed', {
    file: currentImagePath,
    bg: config.type,
    paddingPx: config.paddingPx,
    shadowPx: config.shadowPx,
    cornersPx: config.cornersPx,
    alignment: config.alignment,
  });
  return { snapUrl: fresh };
}

/**
 * Pop a file dialog, load the picked image into the editor, and return
 * its snap:// URL. Used by the empty-state "Open file…" button so users
 * can edit existing screenshots without re-capturing.
 */
export async function openFileInEditor(): Promise<string | null> {
  const focused = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(focused ?? new BrowserWindow({ show: false }), {
    properties: ['openFile'],
    title: 'Open image in editor',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'heic', 'tif', 'tiff'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const path = result.filePaths[0];
  if (!path) return null;
  showEditorWithImage(path);
  return currentImageUrl;
}

function cacheBust(url: string): string {
  // Strip an existing `?v=...` then append a fresh one so the <img>
  // bypasses the snap:// scheme's cache.
  const base = url.split('?')[0] ?? url;
  return `${base}?v=${Date.now()}`;
}
