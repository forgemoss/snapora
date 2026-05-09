import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { app, clipboard, nativeImage } from 'electron';
import logger from '@main/logger';
import { pickRegion } from '@main/selection/overlay';
import { getPreferences } from '@main/storage/prefs';
import { insertCapture } from '@main/storage/db';
import type { CaptureMode, CaptureOptions, CaptureResult, SelectionRect } from '@shared/types';

const SCREENCAPTURE_BIN = '/usr/sbin/screencapture';

/**
 * Build the argv for /usr/sbin/screencapture.
 *
 * Reference: `man screencapture`. Flags we use:
 *   -i  interactive (mouse selection)
 *   -W  start in window-selection mode (only with -i)
 *   -R  rect x,y,w,h in DIPs (skips -i; we drove our own selection)
 *   -t  format (png|jpg|...)
 *   -o  do not include window shadow when in window mode
 *   -x  do not play sound
 *   -T  delay in seconds before capture (full-screen only)
 */
export function buildArgs(
  mode: CaptureMode,
  format: 'png' | 'jpg',
  delaySeconds: number,
  outFile: string,
  silent: boolean,
  region?: SelectionRect,
): string[] {
  // -x silences the shutter sound; omit it when the user wants the sound.
  const args: string[] = silent ? ['-x', '-t', format] : ['-t', format];

  // When we already know the rect (from our overlay or "previous area"),
  // -R replaces the interactive HUD entirely.
  if (region) {
    args.push('-R', `${region.x},${region.y},${region.width},${region.height}`);
    args.push(outFile);
    return args;
  }

  switch (mode) {
    case 'area':
      args.push('-i');
      break;
    case 'window':
      args.push('-i', '-W', '-o');
      break;
    case 'fullscreen':
      if (delaySeconds > 0) args.push('-T', String(delaySeconds));
      break;
  }

  args.push(outFile);
  return args;
}

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
  // For "area" mode, route through our homegrown overlay when the pref is on.
  // The overlay returns a global-DIP rect that we hand to `screencapture -R`.
  let region = options.region;
  if (!region && options.mode === 'area' && getPreferences().useCustomSelectionOverlay) {
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

  const delaySeconds = Math.max(0, Math.round((options.delayMs ?? 0) / 1000));
  // Default silent unless the user explicitly opts in via prefs (handled by callers).
  const silent = options.silent !== false;
  const args = buildArgs(options.mode, format, delaySeconds, outFile, silent, region);

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
    await stat(outFile);
  } catch {
    cancelled = true;
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
