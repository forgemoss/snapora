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

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

// Hide from Dock on macOS — Snapora is a menu-bar app.
if (process.platform === 'darwin') {
  app.dock?.hide();
}

// Menu-bar app stays running even when no windows are open. On macOS, that's
// the default behavior already — we only need to handle this for Windows/Linux later.

app.on('will-quit', () => {
  unregisterGlobalShortcuts();
});

app.whenReady().then(() => {
  logger.info('app: ready', { version: app.getVersion(), platform: process.platform });
  installContentSecurityPolicy();
  registerSnapProtocol();
  registerIpcHandlers();
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
