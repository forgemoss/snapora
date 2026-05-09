import { globalShortcut } from 'electron';
import logger from '@main/logger';
import { takeScreenshot } from '@main/capture/screenshot';
import { showHudWithImage } from '@main/windows/hud';
import { getPreferences } from '@main/storage/prefs';
import type { CaptureMode } from '@shared/types';

/**
 * Registers global hotkeys per the user's preferences.
 * If a hotkey can't be registered (already bound by another app), we log
 * a warning rather than crashing — settings UI will surface conflicts.
 */
export function registerGlobalShortcuts(): void {
  globalShortcut.unregisterAll();

  const prefs = getPreferences();
  const modes: CaptureMode[] = ['area', 'window', 'fullscreen'];

  for (const mode of modes) {
    const accelerator = prefs.hotkeys[mode];
    if (!accelerator) continue;

    const ok = globalShortcut.register(accelerator, () => {
      void runCapture(mode);
    });
    if (!ok) {
      logger.warn(`hotkey: failed to register ${mode} → ${accelerator} (likely conflict)`);
    } else {
      logger.info(`hotkey: registered ${mode} → ${accelerator}`);
    }
  }
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}

async function runCapture(mode: CaptureMode): Promise<void> {
  const prefs = getPreferences();
  try {
    const result = await takeScreenshot({
      mode,
      format: prefs.defaultFormat,
      copyToClipboard: prefs.autoCopyToClipboard,
      saveToDisk: true,
      silent: !prefs.soundOnCapture,
    });
    if (!result.cancelled && result.filePath) {
      showHudWithImage(result.filePath);
    }
  } catch (err) {
    logger.error('hotkey: capture failed', err);
  }
}
