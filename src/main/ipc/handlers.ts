import { app, ipcMain } from 'electron';
import logger from '@main/logger';
import { takeScreenshot } from '@main/capture/screenshot';
import { listPermissions, openSystemSettingsFor, requestPermission } from '@main/permissions/tcc';
import { getPreferences, setPreferences } from '@main/storage/prefs';
import { getCurrentEditorImageUrl } from '@main/windows/editor';
import { showHudWithImage } from '@main/windows/hud';
import { registerHudHandlers } from '@main/ipc/hudHandlers';
import { IPC } from '@shared/ipc';
import type { AppPreferences, CaptureOptions, Permission } from '@shared/types';

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.capture.start, async (_evt, options: CaptureOptions) => {
    const result = await takeScreenshot(options);
    if (!result.cancelled && result.filePath) {
      // Post-capture: show the Quick Access HUD instead of opening the editor.
      // The editor opens on demand from the HUD's "Edit" action.
      showHudWithImage(result.filePath);
    }
    return result;
  });

  ipcMain.handle(IPC.capture.cancel, async () => {
    // The OS owns the selection HUD; we can't directly cancel `screencapture`.
    // Future option: track the spawned PID and SIGINT it.
    logger.info('capture: cancel requested (no-op until we track child PID)');
  });

  ipcMain.handle(IPC.permissions.list, () => listPermissions());
  ipcMain.handle(IPC.permissions.request, (_evt, p: Permission) => requestPermission(p));
  ipcMain.handle(IPC.permissions.openSystemSettings, (_evt, p: Permission) =>
    openSystemSettingsFor(p),
  );

  ipcMain.handle(IPC.preferences.get, () => getPreferences());
  ipcMain.handle(IPC.preferences.set, (_evt, patch: Partial<AppPreferences>) =>
    setPreferences(patch),
  );

  ipcMain.handle(IPC.editor.requestCurrent, () => getCurrentEditorImageUrl());

  registerHudHandlers();

  ipcMain.handle(IPC.app.quit, () => app.quit());
  ipcMain.handle(IPC.app.version, () => app.getVersion());

  logger.info('ipc: handlers registered');
}
