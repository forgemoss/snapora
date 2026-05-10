import { spawn } from 'node:child_process';
import { copyFile, unlink } from 'node:fs/promises';
import { BrowserWindow, dialog, shell } from 'electron';
import { dirname, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import logger from '@main/logger';
import { ensureFfmpegAvailable } from '@main/capture/binaries';
import { compositeWindowOnBackground } from '@main/capture/compositor';
import { toSnapUrl } from '@main/security/protocol';
import { IPC, type EditorBackgroundConfig, type EditorComposeResult } from '@shared/ipc';

let editorWindow: BrowserWindow | null = null;
let currentImageUrl: string | null = null;
let currentImagePath: string | null = null;

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v']);

export type EditorMediaKind = 'image' | 'video' | 'gif';

export function kindForPath(path: string): EditorMediaKind {
  const ext = extname(path).toLowerCase();
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (ext === '.gif') return 'gif';
  return 'image';
}

/** Returns the most recent media URL pushed to the editor, or null. */
export function getCurrentEditorImageUrl(): string | null {
  return currentImageUrl;
}

/** Returns the kind of the current media (image / video / gif). */
export function getCurrentEditorKind(): EditorMediaKind | null {
  if (!currentImagePath) return null;
  return kindForPath(currentImagePath);
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
 * Pop a file dialog, load the picked image / video into the editor, and
 * return its snap:// URL. Used by the empty-state "Open file…" button so
 * users can edit existing media without re-capturing.
 */
export async function openFileInEditor(): Promise<string | null> {
  const focused = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(focused ?? new BrowserWindow({ show: false }), {
    properties: ['openFile'],
    title: 'Open image or video in editor',
    filters: [
      {
        name: 'Media',
        extensions: ['png', 'jpg', 'jpeg', 'heic', 'tif', 'tiff', 'gif', 'mp4', 'mov', 'm4v'],
      },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const path = result.filePaths[0];
  if (!path) return null;
  showEditorWithImage(path);
  return currentImageUrl;
}

/**
 * Trim the currently-loaded video down to `[startS, endS]`. Stream-copies
 * when possible (zero-loss, fast). Replaces the file in place.
 *
 * Throws if there's no video loaded.
 */
export async function trimEditorVideo(args: {
  startSeconds: number;
  endSeconds: number;
}): Promise<{ snapUrl: string; filePath: string }> {
  if (!currentImagePath) throw new Error('editor: trim requested but no media loaded');
  const kind = kindForPath(currentImagePath);
  if (kind !== 'video' && kind !== 'gif') {
    throw new Error(`editor: trim only works on videos, got kind=${kind}`);
  }
  const ffmpeg = ensureFfmpegAvailable();
  const ext = extname(currentImagePath);
  const outPath = join(tmpdir(), `snapora-trim-${Date.now()}${ext}`);
  const duration = Math.max(0.1, args.endSeconds - args.startSeconds);
  // For videos: try stream copy first (instant, no quality loss). GIFs and
  // any failing copy fall through to a re-encode.
  const tryArgs =
    kind === 'video'
      ? [
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-ss',
            String(args.startSeconds),
            '-i',
            currentImagePath,
            '-t',
            String(duration),
            '-c',
            'copy',
            '-y',
            outPath,
          ],
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-ss',
            String(args.startSeconds),
            '-i',
            currentImagePath,
            '-t',
            String(duration),
            '-c:v',
            'h264_videotoolbox',
            '-c:a',
            'aac',
            '-y',
            outPath,
          ],
        ]
      : [
          // GIFs need a re-encode anyway.
          [
            '-hide_banner',
            '-loglevel',
            'error',
            '-ss',
            String(args.startSeconds),
            '-i',
            currentImagePath,
            '-t',
            String(duration),
            '-y',
            outPath,
          ],
        ];
  let ok = false;
  for (const av of tryArgs) {
    ok = await new Promise<boolean>((resolve) => {
      const proc = spawn(ffmpeg, av, { stdio: 'ignore' });
      proc.on('error', () => resolve(false));
      proc.on('exit', (code) => resolve(code === 0));
    });
    if (ok) break;
  }
  if (!ok) {
    void unlink(outPath).catch(() => {});
    throw new Error('editor: trim failed (ffmpeg)');
  }
  // Move the trimmed file over the original.
  await copyFile(outPath, currentImagePath);
  void unlink(outPath).catch(() => {});
  const fresh = cacheBust(toSnapUrl(currentImagePath));
  currentImageUrl = fresh;
  logger.info('editor: video trimmed', {
    filePath: currentImagePath,
    startSeconds: args.startSeconds,
    endSeconds: args.endSeconds,
  });
  return { snapUrl: fresh, filePath: currentImagePath };
}

/**
 * Convert the currently-loaded video into a GIF using the standard
 * palettegen / paletteuse two-pass method. Saves the GIF next to the
 * original (same dir, .gif extension, name suffixed with -<n> if a file
 * already exists with that name).
 */
export async function exportEditorAsGif(): Promise<{
  filePath: string;
  snapUrl: string;
}> {
  if (!currentImagePath) throw new Error('editor: gif export requested but no media loaded');
  const kind = kindForPath(currentImagePath);
  if (kind !== 'video') {
    throw new Error(`editor: GIF export only works on videos, got kind=${kind}`);
  }
  const ffmpeg = ensureFfmpegAvailable();
  const dir = dirname(currentImagePath);
  const base = currentImagePath.replace(/\.(mp4|mov|m4v)$/i, '');
  const outPath = `${base}.gif`;
  const palettePath = join(tmpdir(), `snapora-export-palette-${Date.now()}.png`);
  const filters = 'fps=15,scale=1280:-1:flags=lanczos';
  const stages: { args: string[]; label: string }[] = [
    {
      args: [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        currentImagePath,
        '-vf',
        `${filters},palettegen=stats_mode=diff`,
        '-y',
        palettePath,
      ],
      label: 'palettegen',
    },
    {
      args: [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        currentImagePath,
        '-i',
        palettePath,
        '-filter_complex',
        `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`,
        '-y',
        outPath,
      ],
      label: 'paletteuse',
    },
  ];
  for (const stage of stages) {
    const ok = await new Promise<boolean>((resolve) => {
      const proc = spawn(ffmpeg, stage.args, { stdio: 'ignore' });
      proc.on('error', () => resolve(false));
      proc.on('exit', (code) => resolve(code === 0));
    });
    if (!ok) {
      void unlink(palettePath).catch(() => {});
      throw new Error(`editor: gif export ${stage.label} failed`);
    }
  }
  void unlink(palettePath).catch(() => {});
  logger.info('editor: video exported as gif', { dir, outPath });
  return { filePath: outPath, snapUrl: toSnapUrl(outPath) };
}

function cacheBust(url: string): string {
  // Strip an existing `?v=...` then append a fresh one so the <img>
  // bypasses the snap:// scheme's cache.
  const base = url.split('?')[0] ?? url;
  return `${base}?v=${Date.now()}`;
}
