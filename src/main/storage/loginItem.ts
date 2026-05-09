import { app } from 'electron';
import logger from '@main/logger';

/**
 * Sync the macOS login-item state with the user's preference.
 * Called on app start and whenever the launchAtLogin pref changes.
 */
export function syncLoginItem(launchAtLogin: boolean): void {
  if (process.platform !== 'darwin') return;
  app.setLoginItemSettings({
    openAtLogin: launchAtLogin,
    openAsHidden: true, // start hidden (menu-bar-only behavior)
  });
  logger.info('loginItem: synced', { launchAtLogin });
}
