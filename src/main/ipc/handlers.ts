import { app, ipcMain } from 'electron';
import logger from '@main/logger';
import { takeScreenshot } from '@main/capture/screenshot';
import { listPermissions, openSystemSettingsFor, requestPermission } from '@main/permissions/tcc';
import { syncLoginItem } from '@main/storage/loginItem';
import { getPreferences, setPreferences } from '@main/storage/prefs';
import { setDesktopIconsHidden } from '@main/system/desktopIcons';
import {
  composeEditorImage,
  getCurrentEditorImageUrl,
  openFileInEditor,
} from '@main/windows/editor';
import { showHudWithImage } from '@main/windows/hud';
import { markFirstRunDone, relaunchApp } from '@main/windows/firstRun';
import { chooseSaveDirectory, chooseWallpaperImage } from '@main/windows/settings';
import { registerHistoryHandlers } from '@main/ipc/historyHandlers';
import { registerSelectionHandlers } from '@main/selection/overlay';
import { registerGlobalShortcuts } from '@main/shortcuts/index';
import { registerHudHandlers } from '@main/ipc/hudHandlers';
import { IPC, type EditorBackgroundConfig } from '@shared/ipc';
import type { AppPreferences, CaptureOptions, Permission } from '@shared/types';

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.capture.start, async (_evt, options: CaptureOptions) => {
    const prefs = getPreferences();
    const result = await takeScreenshot({
      silent: !prefs.soundOnCapture,
      ...options,
    });
    if (!result.cancelled && result.filePath) {
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

  ipcMain.handle(IPC.preferences.chooseSaveDirectory, () => chooseSaveDirectory());
  ipcMain.handle(IPC.wallpaper.chooseImage, () => chooseWallpaperImage());
  ipcMain.handle(IPC.preferences.get, () => getPreferences());
  ipcMain.handle(IPC.preferences.set, async (_evt, patch: Partial<AppPreferences>) => {
    const next = setPreferences(patch);
    // React to side-effecting prefs.
    if ('launchAtLogin' in patch) syncLoginItem(next.launchAtLogin);
    if ('hotkeys' in patch) registerGlobalShortcuts();
    if ('hideDesktopIcons' in patch) {
      await setDesktopIconsHidden(next.hideDesktopIcons).catch(() => {
        /* logged inside */
      });
    }
    return next;
  });

  ipcMain.handle(IPC.editor.requestCurrent, () => getCurrentEditorImageUrl());
  ipcMain.handle(IPC.editor.compose, (_evt, config: EditorBackgroundConfig) =>
    composeEditorImage(config),
  );
  ipcMain.handle(IPC.editor.openFile, () => openFileInEditor());

  registerHudHandlers();
  registerHistoryHandlers();
  registerSelectionHandlers();

  ipcMain.handle(IPC.firstRun.markDone, () => markFirstRunDone());
  ipcMain.handle(IPC.firstRun.relaunch, () => relaunchApp());

  ipcMain.handle(IPC.app.quit, () => app.quit());
  ipcMain.handle(IPC.app.version, () => app.getVersion());

  logger.info('ipc: handlers registered');
}
