import { globalShortcut } from 'electron';
import logger from '@main/logger';
import { takeScreenshot } from '@main/capture/screenshot';
import { isRecording, startRecording, stopRecording } from '@main/recording/session';
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

  // Recording hotkey toggles: start if idle, stop if a session is live. This
  // is the user's escape hatch when no floating controls bar is shown
  // (single-display + display/window mode — the bar would land in the
  // recording, so we don't show it).
  if (prefs.recordingHotkey) {
    const ok = globalShortcut.register(prefs.recordingHotkey, () => {
      if (isRecording()) {
        void stopRecording();
      } else {
        void startRecording({ mode: prefs.recordingDefaultMode });
      }
    });
    if (!ok) {
      logger.warn(
        `hotkey: failed to register recording → ${prefs.recordingHotkey} (likely conflict)`,
      );
    } else {
      logger.info(`hotkey: registered recording → ${prefs.recordingHotkey} (toggles start/stop)`);
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
      delayMs: mode === 'fullscreen' ? prefs.selfTimerSeconds * 1000 : 0,
    });
    if (!result.cancelled && result.filePath) {
      showHudWithImage(result.filePath);
    }
  } catch (err) {
    logger.error('hotkey: capture failed', err);
  }
}
