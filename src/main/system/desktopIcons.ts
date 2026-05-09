import { spawn } from 'node:child_process';
import logger from '@main/logger';

/**
 * Hide / show macOS desktop icons by toggling the Finder's CreateDesktop
 * defaults key and killing Finder so the change takes effect.
 *
 * This is the standard macOS approach used by every screenshot/clean-screen
 * tool. The Finder restart is briefly visible (~0.5s flash) but unavoidable.
 */

let currentlyHidden = false;

export function areDesktopIconsHidden(): boolean {
  return currentlyHidden;
}

export async function setDesktopIconsHidden(hidden: boolean): Promise<void> {
  if (hidden === currentlyHidden) return;
  try {
    await runCommand('defaults', [
      'write',
      'com.apple.finder',
      'CreateDesktop',
      '-bool',
      hidden ? 'false' : 'true',
    ]);
    await runCommand('killall', ['Finder']);
    currentlyHidden = hidden;
    logger.info(`desktop-icons: ${hidden ? 'hidden' : 'shown'}`);
  } catch (err) {
    logger.error('desktop-icons: failed to toggle', err);
    throw err;
  }
}

/**
 * Best-effort restore on app quit: if Snapora hid the icons, show them back
 * so we don't leave the user with a desktop they can't restore without us.
 */
export async function restoreDesktopIconsOnQuit(): Promise<void> {
  if (!currentlyHidden) return;
  try {
    await setDesktopIconsHidden(false);
  } catch {
    // already logged in setDesktopIconsHidden
  }
}

function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('error', reject);
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)),
    );
  });
}
