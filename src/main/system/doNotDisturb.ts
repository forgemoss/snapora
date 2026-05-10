import { spawn } from 'node:child_process';
import logger from '@main/logger';

/**
 * Toggle macOS "Do Not Disturb" focus mode by invoking the user's Shortcuts
 * app via the `shortcuts` CLI (shipped with macOS Monterey+).
 *
 * Snapora ships a small workflow at `resources/shortcuts/Toggle DnD.shortcut`
 * that the user installs once on first use; this fn just runs it.
 *
 * Returns true on success. If the CLI isn't present or the shortcut isn't
 * installed, returns false and logs a warning — the caller should treat the
 * recording as "best effort" rather than aborting.
 */
const SHORTCUT_NAME = 'Snapora — Toggle Do Not Disturb';

export function setDoNotDisturb(_on: boolean): Promise<boolean> {
  // The `shortcuts run` CLI is fire-and-forget — we can't pass an `on/off`
  // arg easily, so the shortcut is a toggle. Callers track whether they
  // turned it on so they know to toggle back at stop time.
  return new Promise((resolve) => {
    const proc = spawn('shortcuts', ['run', SHORTCUT_NAME], { stdio: 'ignore' });
    proc.on('error', (err) => {
      logger.warn('dnd: shortcuts CLI failed', err);
      resolve(false);
    });
    proc.on('exit', (code) => {
      if (code === 0) {
        logger.info('dnd: toggled');
        resolve(true);
      } else {
        logger.warn('dnd: shortcut exit non-zero', { code });
        resolve(false);
      }
    });
  });
}
