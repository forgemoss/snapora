import { app } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import logger from '@main/logger';

/**
 * Resolve the path to the bundled ffmpeg binary.
 *
 * - In a packaged build, the binary is shipped via electron-builder's
 *   `extraResources` and lives at `<app>.app/Contents/Resources/bin/ffmpeg`.
 * - In dev (`npm run dev`), it lives in the repo at
 *   `resources/bin/ffmpeg-{arch}`. `app.getAppPath()` resolves to the project
 *   root in dev, so we go up + into `resources/bin`.
 */
export function resolveFfmpegPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', 'ffmpeg');
  }
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return join(app.getAppPath(), 'resources', 'bin', `ffmpeg-${arch}`);
}

/**
 * Throw a helpful error if the ffmpeg binary isn't where we expect it.
 * Calls into screen recording should run this once before spawning.
 */
export function ensureFfmpegAvailable(): string {
  const path = resolveFfmpegPath();
  if (!existsSync(path)) {
    logger.error('ffmpeg: missing at', path);
    throw new Error(
      `ffmpeg binary missing at ${path}. Run \`npm run prepare:resources\` to fetch it.`,
    );
  }
  return path;
}
