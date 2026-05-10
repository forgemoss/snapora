import { BrowserWindow, nativeImage } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import logger from '@main/logger';

export interface CompositeBackground {
  type: 'image' | 'color' | 'gradient';
  /**
   * - `color`: hex like `#0f172a`
   * - `image`: absolute path
   * - `gradient`: any valid CSS background-image value, e.g.
   *   `linear-gradient(135deg, #ff6b6b, #f7931e)`
   */
  value: string;
}

export type CompositeAlignment =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface CompositeOptions {
  /** Path to the raw window screenshot from `screencapture -W -o`. */
  inputPath: string;
  /** Path the composited PNG should be written to. */
  outputPath: string;
  /** Background to render around the window. */
  background: CompositeBackground;
  /** DIPs of empty space between the window edge and the canvas edge. */
  paddingPx: number;
  /** Drop-shadow strength in DIPs. Default 30. Set 0 for no shadow. */
  shadowPx?: number;
  /** Border-radius in DIPs applied to the captured image. Default 0 (use the image's natural alpha shape). */
  cornersPx?: number;
  /** Where the captured image sits within the canvas. Default `center`. */
  alignment?: CompositeAlignment;
}

const COMPOSITE_TIMEOUT_MS = 8_000;
const DEFAULT_SHADOW_PX = 30;

/**
 * Alignment slides the image toward an edge by *doubling padding on the
 * opposite side* (rather than introducing a separate aspect-ratio
 * concept). e.g. `bottom-right` → top + left get 2× padding.
 */
export function paddingForAlignment(
  alignment: CompositeAlignment,
  base: number,
): { top: number; right: number; bottom: number; left: number } {
  let top = base;
  let right = base;
  let bottom = base;
  let left = base;
  if (alignment.startsWith('top')) bottom = base * 2;
  else if (alignment.startsWith('bottom')) top = base * 2;
  if (alignment.endsWith('right')) left = base * 2;
  else if (alignment.endsWith('left')) right = base * 2;
  return { top, right, bottom, left };
}

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
  const padding = paddingForAlignment(opts.alignment ?? 'center', opts.paddingPx);
  const outW = winSize.width + padding.left + padding.right;
  const outH = winSize.height + padding.top + padding.bottom;

  // Load both images as data URLs so the renderer can show them without
  // worrying about file:// + CSP.
  const winDataUrl = `data:image/png;base64,${(await readFile(opts.inputPath)).toString('base64')}`;
  const bgCss = await resolveBackgroundCss(opts.background);

  const shadowPx = opts.shadowPx ?? DEFAULT_SHADOW_PX;
  const cornersPx = opts.cornersPx ?? 0;

  const html = buildHtml({
    bgCss,
    padding,
    shadowPx,
    cornersPx,
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
      basePaddingPx: opts.paddingPx,
      padding,
      shadowPx,
      cornersPx,
      alignment: opts.alignment ?? 'center',
      outSize: `${outW}x${outH}`,
    });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

async function resolveBackgroundCss(bg: CompositeBackground): Promise<string> {
  if (bg.type === 'color') {
    return bg.value;
  }
  if (bg.type === 'gradient') {
    return bg.value;
  }
  // type === 'image'
  const bgBuf = await readFile(bg.value);
  const bgB64 = bgBuf.toString('base64');
  const ext = bg.value.split('.').pop()?.toLowerCase() ?? 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'heic' ? 'heic' : 'png';
  return `center / cover no-repeat url("data:image/${mime};base64,${bgB64}")`;
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
  padding: { top: number; right: number; bottom: number; left: number };
  shadowPx: number;
  cornersPx: number;
  winSize: { width: number; height: number };
  outSize: { w: number; h: number };
  winDataUrl: string;
}): string {
  // For solid colors (and gradients which are also background-image), we
  // need to use `background:` shorthand. CSS handles both.
  const shadow =
    args.shadowPx > 0
      ? `filter: drop-shadow(0 ${Math.round(args.shadowPx / 2)}px ${args.shadowPx}px rgba(0, 0, 0, 0.45));`
      : '';
  // When the user picks rounded corners, wrap the image in a clipping div.
  // The captured PNG's own alpha (rounded macOS window corners) sits
  // inside the rounded clip — for area screenshots this is what produces
  // the visible rounded corner.
  const clipStyles =
    args.cornersPx > 0 ? `border-radius: ${args.cornersPx}px; overflow: hidden; ${shadow}` : shadow;

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
    /*
     * Padding handles alignment (asymmetric values shift the image toward
     * one corner) so we leave display:block here — the .clip is
     * absolutely positioned by the asymmetric padding.
     */
    padding: ${args.padding.top}px ${args.padding.right}px ${args.padding.bottom}px ${args.padding.left}px;
    box-sizing: border-box;
  }
  /*
   * The captured PNG already has the window's native rounded corners
   * (transparent outside the rounding). We use filter:drop-shadow so the
   * shadow follows the real alpha shape — box-shadow on a rectangular
   * wrapper would draw a square shadow ignoring the corners.
   */
  .clip {
    width: ${args.winSize.width}px;
    height: ${args.winSize.height}px;
    ${clipStyles}
  }
  img {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
</head>
<body>
  <div class="canvas">
    <div class="clip"><img src="${args.winDataUrl}"></div>
  </div>
</body>
</html>`;
}
