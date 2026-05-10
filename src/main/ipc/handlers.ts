import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron';
import logger from '@main/logger';
import { takeScreenshot } from '@main/capture/screenshot';
import { listPermissions, openSystemSettingsFor, requestPermission } from '@main/permissions/tcc';
import { syncLoginItem } from '@main/storage/loginItem';
import { getPreferences, setPreferences } from '@main/storage/prefs';
import { setDesktopIconsHidden } from '@main/system/desktopIcons';
import {
  composeEditorImage,
  exportEditorAsGif,
  getCurrentEditorImageUrl,
  getCurrentEditorKind,
  openFileInEditor,
  trimEditorVideo,
} from '@main/windows/editor';
import { showHudWithImage } from '@main/windows/hud';
import { markFirstRunDone, relaunchApp } from '@main/windows/firstRun';
import {
  chooseSaveDirectory,
  chooseWallpaperImage,
  openSettingsWindow,
} from '@main/windows/settings';
import { registerHistoryHandlers } from '@main/ipc/historyHandlers';
import { registerSelectionHandlers } from '@main/selection/overlay';
import { registerGlobalShortcuts } from '@main/shortcuts/index';
import { registerHudHandlers } from '@main/ipc/hudHandlers';
import {
  cancelRecording,
  getRecordingState,
  pauseRecording,
  recordingEvents,
  restartRecording,
  resumeRecording,
  startRecording,
  stopRecording,
} from '@main/recording/session';
import { listAvfDevices } from '@main/recording/ffmpegDevices';
import {
  cancelStage,
  commitStage,
  getPendingStageInit,
  getStageWindow,
} from '@main/recording/stageWindow';
import { cancelPick, commitPick, listCapturableWindows } from '@main/recording/windowPicker';
import { closeWebcamWindow, showWebcamPreview } from '@main/recording/webcamWindow';
import { closeEffectsWindow, showEffectsWindow } from '@main/recording/effectsWindow';
import { IPC, type EditorBackgroundConfig } from '@shared/ipc';
import type {
  AppPreferences,
  CaptureOptions,
  Permission,
  RecordingOptions,
  RecordingStateSnapshot,
} from '@shared/types';

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
  ipcMain.handle(IPC.editor.requestKind, () => getCurrentEditorKind());
  ipcMain.handle(IPC.editor.trimVideo, (_evt, args: { startSeconds: number; endSeconds: number }) =>
    trimEditorVideo(args),
  );
  ipcMain.handle(IPC.editor.exportGif, () => exportEditorAsGif());

  registerHudHandlers();
  registerHistoryHandlers();
  registerSelectionHandlers();

  // ---- Recording ----------------------------------------------------------
  ipcMain.handle(IPC.recording.start, (_evt, opts: RecordingOptions) => startRecording(opts));
  ipcMain.handle(IPC.recording.stop, () => stopRecording());
  ipcMain.handle(IPC.recording.cancel, () => cancelRecording());
  ipcMain.handle(IPC.recording.pause, () => pauseRecording());
  ipcMain.handle(IPC.recording.resume, () => resumeRecording());
  ipcMain.handle(IPC.recording.restart, () => restartRecording());
  ipcMain.handle(IPC.recording.state, () => getRecordingState());
  ipcMain.handle(IPC.recording.listDevices, async () => {
    const d = await listAvfDevices();
    return {
      cameras: d.videoCameras.map((c) => c.label),
      mics: d.audioInputs.map((m) => m.label),
    };
  });
  // Fan state-change events out to every webContents (any subscribed renderer:
  // controls overlay, settings panel, tray badge in renderer if any).
  recordingEvents.on('state', (snap: RecordingStateSnapshot) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.recording.onState, snap);
    }
  });
  ipcMain.on(
    IPC.recording.stageCommit,
    (
      _evt,
      result: {
        output: 'mp4' | 'gif';
        recordMicrophone: boolean;
        recordWebcam: boolean;
        captureClicks: boolean;
        captureKeystrokes: boolean;
      },
    ) => commitStage(result),
  );
  ipcMain.on(IPC.recording.stageCancel, () => cancelStage());
  ipcMain.handle(IPC.recording.stageGetInit, () => getPendingStageInit());
  ipcMain.handle(IPC.recording.windowPickerList, () => listCapturableWindows());
  ipcMain.on(IPC.recording.windowPickerPick, (_evt, sourceId: string) => {
    void commitPick(sourceId);
  });
  ipcMain.on(IPC.recording.windowPickerCancel, () => cancelPick());

  // Native popup menus for stage device pickers. Renderer awaits the result:
  //   undefined = dismissed without picking
  //   string    = picked device label (also persisted to prefs by the renderer)
  // No "Off" entry — the toggle icon handles activate/deactivate. Picking a
  // device implies "switch to / activate with this device".
  const popupDeviceMenu = (
    devices: { label: string }[],
    currentLabel: string | null,
  ): Promise<string | undefined> => {
    const stageWin = getStageWindow();
    return new Promise((resolve) => {
      let resolved = false;
      const finish = (v: string | undefined): void => {
        if (resolved) return;
        resolved = true;
        resolve(v);
      };
      const items =
        devices.length > 0
          ? devices.map((d) => ({
              label: d.label,
              type: 'radio' as const,
              checked: currentLabel === d.label,
              click: () => finish(d.label),
            }))
          : [{ label: 'No devices found', enabled: false }];
      const menu = Menu.buildFromTemplate(items);
      const opts = stageWin ? { window: stageWin } : {};
      menu.popup({ ...opts, callback: () => finish(undefined) });
    });
  };

  ipcMain.handle(IPC.recording.stageMicMenu, async (_evt, currentLabel: string | null) => {
    const d = await listAvfDevices();
    return popupDeviceMenu(d.audioInputs, currentLabel);
  });
  ipcMain.handle(IPC.recording.stageCameraMenu, async (_evt, currentLabel: string | null) => {
    const d = await listAvfDevices();
    return popupDeviceMenu(d.videoCameras, currentLabel);
  });

  ipcMain.on(
    IPC.recording.stageWebcamPreviewShow,
    (_evt, bounds: { x: number; y: number; width: number; height: number }) => {
      showWebcamPreview(bounds);
    },
  );
  ipcMain.on(IPC.recording.stageWebcamPreviewHide, () => closeWebcamWindow());

  ipcMain.on(
    IPC.recording.stageEffectsPreviewShow,
    (_evt, args: { wantClicks: boolean; wantKeys: boolean }) => {
      // Preview on the user's current display so they see clicks/keystroke
      // pills as they happen — same overlay that runs during real recording.
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      showEffectsWindow({
        wantClicks: args.wantClicks,
        wantKeys: args.wantKeys,
        recordingDisplay: display,
      });
    },
  );
  ipcMain.on(IPC.recording.stageEffectsPreviewHide, () => closeEffectsWindow());

  // Stage → Settings: cancel the stage atomically and open the Settings
  // window so the user lands on the Recording tab.
  ipcMain.handle(IPC.recording.stageOpenSettings, () => {
    cancelStage();
    openSettingsWindow();
  });

  // Stage → mode switch (Maximize / Crop): cancel current stage, yield once
  // so session.ts's awaiting code transitions phase back to 'idle', THEN
  // start the new mode. Without the yield, startRecording's `phase !== 'idle'`
  // guard fires and the new recording is silently skipped.
  ipcMain.handle(
    IPC.recording.stageSwitchMode,
    async (_evt, mode: 'region' | 'display' | 'window') => {
      cancelStage();
      await new Promise<void>((resolve) => setImmediate(resolve));
      await startRecording({ mode });
    },
  );

  ipcMain.handle(IPC.firstRun.markDone, () => markFirstRunDone());
  ipcMain.handle(IPC.firstRun.relaunch, () => relaunchApp());

  ipcMain.handle(IPC.app.quit, () => app.quit());
  ipcMain.handle(IPC.app.version, () => app.getVersion());

  logger.info('ipc: handlers registered');
}
