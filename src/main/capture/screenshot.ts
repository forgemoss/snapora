import { spawn } from 'node:child_process';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { app, clipboard, nativeImage } from 'electron';
import logger from '@main/logger';
import { buildArgs } from '@main/capture/screenshotArgs';
import { compositeWindowOnBackground } from '@main/capture/compositor';
import { pickRegion } from '@main/selection/overlay';
import { getPreferences } from '@main/storage/prefs';
import { insertCapture } from '@main/storage/db';
import { setDesktopIconsHidden } from '@main/system/desktopIcons';
import type { AppPreferences, CaptureOptions, CaptureResult } from '@shared/types';

const SCREENCAPTURE_BIN = '/usr/sbin/screencapture';

function defaultSaveDir(): string {
  return join(app.getPath('pictures'), 'Snapora');
}

function timestampedFilename(format: 'png' | 'jpg'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  return `Snapora ${stamp}.${format}`;
}

export async function takeScreenshot(options: CaptureOptions): Promise<CaptureResult> {
  const prefs = getPreferences();

  // Temp icon-hide: only when the during-captures flag is on and the user
  // hasn't already permanently hidden them (then we'd flicker for nothing).
  const tempHideIcons = prefs.hideDesktopIconsDuringCaptures && !prefs.hideDesktopIcons;
  if (tempHideIcons) {
    await setDesktopIconsHidden(true).catch((err) =>
      logger.warn('capture: temp icon hide failed', err),
    );
  }

  try {
    return await runCapture(options, prefs);
  } finally {
    if (tempHideIcons) {
      await setDesktopIconsHidden(false).catch(() => {
        /* logged inside */
      });
    }
  }
}

async function runCapture(options: CaptureOptions, prefs: AppPreferences): Promise<CaptureResult> {
  // For "area" mode, route through our homegrown overlay when the pref is on.
  // The overlay returns a global-DIP rect that we hand to `screencapture -R`.
  let region = options.region;
  if (!region && options.mode === 'area' && prefs.useCustomSelectionOverlay) {
    const result = await pickRegion();
    if (result.cancelled || !result.rect) {
      return {
        filePath: null,
        capturedAt: new Date().toISOString(),
        width: null,
        height: null,
        cancelled: true,
      };
    }
    region = result.rect;
  }

  const format: 'png' | 'jpg' = options.format ?? 'png';
  const saveDir = defaultSaveDir();
  await mkdir(saveDir, { recursive: true });
  const outFile = join(saveDir, timestampedFilename(format));
  await mkdir(dirname(outFile), { recursive: true });

  // For window-mode captures with a custom background, screencapture writes
  // to a temp file first and the compositor produces the final image.
  const willComposite = options.mode === 'window' && prefs.wallpaperMode !== 'system';
  const screencaptureTarget = willComposite
    ? join(tmpdir(), `snapora-window-${Date.now()}.png`)
    : outFile;

  const delaySeconds = Math.max(0, Math.round((options.delayMs ?? 0) / 1000));
  // Default silent unless the user explicitly opts in via prefs (handled by callers).
  const silent = options.silent !== false;
  const args = buildArgs(options.mode, format, delaySeconds, screencaptureTarget, silent, region);

  logger.info('capture: spawning screencapture', { args });

  const exitCode = await new Promise<number>((resolve, reject) => {
    const proc = spawn(SCREENCAPTURE_BIN, args, { stdio: 'ignore' });
    proc.on('error', reject);
    proc.on('exit', (code) => resolve(code ?? -1));
  });

  // Cancellation in interactive modes leaves no file written but exit code is still 0.
  let cancelled = false;
  let width: number | null = null;
  let height: number | null = null;

  try {
    await stat(screencaptureTarget);
  } catch {
    cancelled = true;
  }

  if (!cancelled && exitCode === 0 && willComposite) {
    try {
      await compositeWindowOnBackground({
        inputPath: screencaptureTarget,
        outputPath: outFile,
        background:
          prefs.wallpaperMode === 'customImage'
            ? { type: 'image', value: prefs.customWallpaperImagePath ?? '' }
            : { type: 'color', value: prefs.customWallpaperColor },
        paddingPx: prefs.windowBackgroundPaddingPx,
      });
    } catch (err) {
      // Fall back to the raw window screenshot — better than nothing.
      logger.warn('capture: composite failed, falling back to raw window image', err);
      try {
        await rename(screencaptureTarget, outFile);
      } catch (renameErr) {
        logger.error('capture: fallback rename failed', renameErr);
        cancelled = true;
      }
    } finally {
      // The temp file is no longer needed after a successful composite. If
      // composite failed and we renamed it to outFile, the unlink no-ops.
      void unlink(screencaptureTarget).catch(() => {
        /* file already moved or never existed */
      });
    }
  }

  if (!cancelled && exitCode === 0) {
    if (options.copyToClipboard !== false) {
      const img = nativeImage.createFromPath(outFile);
      if (!img.isEmpty()) {
        clipboard.writeImage(img);
        const size = img.getSize();
        width = size.width;
        height = size.height;
      }
    }
  }

  const capturedAt = new Date().toISOString();

  if (cancelled) {
    logger.info('capture: user cancelled');
  } else if (exitCode !== 0) {
    logger.warn('capture: screencapture exited non-zero', { exitCode });
  } else {
    logger.info('capture: saved', { outFile, width, height });
    // Record in history. Width/height come from the clipboard image when
    // copyToClipboard is on; if it's off they'll be null and that's fine.
    try {
      insertCapture({
        filePath: outFile,
        capturedAt,
        mode: options.mode,
        width,
        height,
      });
    } catch (err) {
      logger.warn('capture: history insert failed', err);
    }
  }

  return {
    filePath: cancelled ? null : outFile,
    capturedAt,
    width,
    height,
    cancelled,
  };
}
