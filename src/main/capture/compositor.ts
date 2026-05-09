import { BrowserWindow, nativeImage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import logger from '@main/logger';

export interface CompositeBackground {
  type: 'image' | 'color';
  /** When `type === 'image'`, absolute path. When `type === 'color'`, hex like `#0f172a`. */
  value: string;
}

export interface CompositeOptions {
  /** Path to the raw window screenshot from `screencapture -W -o`. */
  inputPath: string;
  /** Path the composited PNG should be written to. */
  outputPath: string;
  /** Background to render around the window. */
  background: CompositeBackground;
  /** DIPs of empty space between the window edge and the canvas edge. */
  paddingPx: number;
}

const COMPOSITE_TIMEOUT_MS = 8_000;
const SHADOW_PX = 30; // dropped behind the window — visually closer to CleanShot's default

/**
 * Composite a captured window onto a chosen background using a hidden
 * `BrowserWindow` + `webContents.capturePage()`. The page is sized to
 * `windowSize + 2 * padding` so capturePage returns the full canvas.
 *
 * Why not pure-Node compositing (sharp / jimp / nativeImage bitmap math)?
 * Doing CSS-quality drop shadows in pure pixel code is annoying and adds
 * native-build complexity. We already have Electron — using it as a
 * compositor keeps the dep surface flat.
 */
export async function compositeWindowOnBackground(opts: CompositeOptions): Promise<void> {
  const inputImg = nativeImage.createFromPath(opts.inputPath);
  if (inputImg.isEmpty()) {
    throw new Error(`compositor: empty image at ${opts.inputPath}`);
  }
  const winSize = inputImg.getSize();
  const outW = winSize.width + 2 * opts.paddingPx;
  const outH = winSize.height + 2 * opts.paddingPx;

  // Load both images as data URLs so the renderer can show them without
  // worrying about file:// + CSP.
  const winDataUrl = `data:image/png;base64,${(await readFile(opts.inputPath)).toString('base64')}`;
  let bgCss: string;
  if (opts.background.type === 'color') {
    bgCss = opts.background.value;
  } else {
    const bgBuf = await readFile(opts.background.value);
    const bgB64 = bgBuf.toString('base64');
    // Trust file extension — these come from the OS file dialog.
    const ext = opts.background.value.split('.').pop()?.toLowerCase() ?? 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'heic' ? 'heic' : 'png';
    bgCss = `center / cover no-repeat url("data:image/${mime};base64,${bgB64}")`;
  }

  const html = buildHtml({
    bgCss,
    paddingPx: opts.paddingPx,
    winSize,
    outSize: { w: outW, h: outH },
    winDataUrl,
  });

  const win = new BrowserWindow({
    width: outW,
    height: outH,
    frame: false,
    transparent: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    paintWhenInitiallyHidden: true,
    useContentSize: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Trusted local content (our own HTML + already-validated images).
      // We need this off so the data: URL renders the embedded images
      // without CSP fights.
      webSecurity: false,
    },
  });

  try {
    await loadWithTimeout(win, html);
    // Give the layout one more tick so the embedded image decodes + paints.
    await new Promise((r) => setTimeout(r, 80));
    const captured = await win.webContents.capturePage();
    if (captured.isEmpty()) {
      throw new Error('compositor: capturePage returned empty image');
    }
    await writeFile(opts.outputPath, captured.toPNG());
    logger.info('compositor: composed', {
      input: opts.inputPath,
      output: opts.outputPath,
      bgType: opts.background.type,
      paddingPx: opts.paddingPx,
      outSize: `${outW}x${outH}`,
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

function loadWithTimeout(win: BrowserWindow, html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('compositor: load timed out')),
      COMPOSITE_TIMEOUT_MS,
    );
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timer);
      resolve();
    });
    win.webContents.once('did-fail-load', (_e, code, desc) => {
      clearTimeout(timer);
      reject(new Error(`compositor: did-fail-load ${code} ${desc}`));
    });
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
}

function buildHtml(args: {
  bgCss: string;
  paddingPx: number;
  winSize: { width: number; height: number };
  outSize: { w: number; h: number };
  winDataUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0; padding: 0; width: 100%; height: 100%;
    overflow: hidden;
  }
  .canvas {
    width: ${args.outSize.w}px;
    height: ${args.outSize.h}px;
    background: ${args.bgCss};
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /*
   * The captured PNG already has the window's native rounded corners
   * (transparent outside the rounding). We use filter:drop-shadow so the
   * shadow follows the real alpha shape — box-shadow on a rectangular
   * wrapper would draw a square shadow ignoring the corners.
   */
  img {
    display: block;
    width: ${args.winSize.width}px;
    height: ${args.winSize.height}px;
    filter: drop-shadow(0 ${Math.round(SHADOW_PX / 2)}px ${SHADOW_PX}px rgba(0, 0, 0, 0.45));
  }
</style>
</head>
<body>
  <div class="canvas">
    <img src="${args.winDataUrl}">
  </div>
</body>
</html>`;
}
