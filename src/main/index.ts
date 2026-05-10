import { app, BrowserWindow } from 'electron';
import logger from '@main/logger';
import { createTray } from '@main/tray';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from '@main/shortcuts/index';
import { registerIpcHandlers } from '@main/ipc/handlers';
import { maybeShowFirstRunWizard } from '@main/windows/firstRun';
import { installContentSecurityPolicy } from '@main/security/csp';
// Importing this registers `snap://` as a privileged scheme.
// The import must happen before app.whenReady — keep it at module top.
import { registerSnapProtocol } from '@main/security/protocol';
import { syncLoginItem } from '@main/storage/loginItem';
import { getPreferences } from '@main/storage/prefs';
import { restoreDesktopIconsOnQuit, setDesktopIconsHidden } from '@main/system/desktopIcons';

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Hide from Dock on macOS — Snapora is a menu-bar app.
if (process.platform === 'darwin') {
  app.dock?.hide();
}

/*
 * Keep Snapora alive when all BrowserWindows are gone.
 *
 * Electron's default behavior — even on macOS — is to quit when the last
 * window closes. The `LSUIElement: true` Info.plist key only applies to
 * packaged builds, not `npm run dev`. Without this handler, the app silently
 * quits whenever the selection overlay closes before the HUD opens (the
 * "first capture is area" crash). Snapora is a menu-bar app — the tray
 * keeps it running; BrowserWindow count is allowed to drop to zero.
 */
app.on('window-all-closed', () => {
  // No-op on macOS — keep running. Future Windows/Linux ports will likely
  // want `app.quit()` here.
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', (event) => {
  unregisterGlobalShortcuts();
  // If we hid desktop icons during this session, put them back. We delay
  // quit briefly so the Finder restart finishes before the process dies.
  if (getPreferences().hideDesktopIcons) {
    event.preventDefault();
    void restoreDesktopIconsOnQuit().finally(() => app.exit(0));
  }
});

app.whenReady().then(() => {
  const prefs = getPreferences();
  logger.info('app: ready', { version: app.getVersion(), platform: process.platform });
  installContentSecurityPolicy();
  registerSnapProtocol();
  registerIpcHandlers();
  syncLoginItem(prefs.launchAtLogin);
  // Apply the hide-desktop-icons pref on launch so the user's saved state
  // is reflected. Failure is non-fatal — startup proceeds either way.
  if (prefs.hideDesktopIcons) void setDesktopIconsHidden(true);
  createTray();
  registerGlobalShortcuts();
  maybeShowFirstRunWizard();

  app.on('activate', () => {
    // No-op for menu-bar app — clicking the dock icon (if visible) does nothing
    // unless we choose to show the editor with the most recent capture.
    if (BrowserWindow.getAllWindows().length === 0) {
      // Reserved for future "open last capture" behavior.
    }
  });
});
