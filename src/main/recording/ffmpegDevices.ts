import { spawn } from 'node:child_process';
import logger from '@main/logger';
import { ensureFfmpegAvailable } from '@main/capture/binaries';
import {
  avfScreenIndexForDisplay as _avfScreenIndexForDisplay,
  parseDevices as _parseDevices,
  type AvfDevices,
} from '@main/recording/ffmpegDevicesParse';

/**
 * Probe the bundled ffmpeg for avfoundation devices. Pure parser is in
 * `ffmpegDevicesParse.ts` so unit tests can import without dragging in
 * Electron.
 */

export type { AvfDevice, AvfDevices } from '@main/recording/ffmpegDevicesParse';
export const parseDevices = _parseDevices;
export const avfScreenIndexForDisplay = _avfScreenIndexForDisplay;

let cache: AvfDevices | null = null;

export async function listAvfDevices(): Promise<AvfDevices> {
  if (cache) return cache;
  const ffmpeg = ensureFfmpegAvailable();

  const stderr = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      ffmpeg,
      ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let buf = '';
    proc.stderr.on('data', (chunk: Buffer) => {
      buf += chunk.toString('utf8');
    });
    proc.on('error', reject);
    // ffmpeg exits non-zero on this probe; that's expected.
    proc.on('exit', () => resolve(buf));
  });

  const result = _parseDevices(stderr);
  cache = result;
  logger.info('ffmpeg: devices probed', {
    cameras: result.videoCameras.length,
    screens: result.videoScreens.length,
    audio: result.audioInputs.length,
  });
  return result;
}

/** Drop the cache so the next call re-probes (e.g. after a display unplug). */
export function invalidateAvfDevicesCache(): void {
  cache = null;
}
