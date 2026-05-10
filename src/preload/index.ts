import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc';
import type {
  AppPreferences,
  CaptureOptions,
  CaptureResult,
  Permission,
  PermissionState,
  RecordingOptions,
  RecordingResult,
  RecordingStateSnapshot,
  SelectionRect,
} from '@shared/types';
import type {
  EditorBackgroundConfig,
  EditorComposeResult,
  HudCard,
  SelectionInitPayload,
  SnaporaApi,
} from '@shared/ipc';

const api: SnaporaApi = {
  capture: (options: CaptureOptions): Promise<CaptureResult> =>
    ipcRenderer.invoke(IPC.capture.start, options),
  cancelCapture: (): Promise<void> => ipcRenderer.invoke(IPC.capture.cancel),
  selection: {
    onInit: (handler: (init: SelectionInitPayload) => void) => {
      const listener = (_evt: unknown, init: SelectionInitPayload): void => handler(init);
      ipcRenderer.on(IPC.selection.init, listener);
      return () => ipcRenderer.removeListener(IPC.selection.init, listener);
    },
    request: (): Promise<SelectionInitPayload | null> => ipcRenderer.invoke(IPC.selection.request),
    commit: (displayId: number, rect: SelectionRect): Promise<void> => {
      ipcRenderer.send(IPC.selection.commit, { displayId, rect });
      return Promise.resolve();
    },
    cancel: (): Promise<void> => {
      ipcRenderer.send(IPC.selection.cancel);
      return Promise.resolve();
    },
  },
  permissions: {
    list: (): Promise<PermissionState[]> => ipcRenderer.invoke(IPC.permissions.list),
    request: (p: Permission): Promise<PermissionState> =>
      ipcRenderer.invoke(IPC.permissions.request, p),
    openSystemSettings: (p: Permission): Promise<void> =>
      ipcRenderer.invoke(IPC.permissions.openSystemSettings, p),
  },
  preferences: {
    get: (): Promise<AppPreferences> => ipcRenderer.invoke(IPC.preferences.get),
    set: (patch: Partial<AppPreferences>): Promise<AppPreferences> =>
      ipcRenderer.invoke(IPC.preferences.set, patch),
    chooseSaveDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC.preferences.chooseSaveDirectory),
  },
  wallpaper: {
    chooseImage: (): Promise<string | null> => ipcRenderer.invoke(IPC.wallpaper.chooseImage),
  },
  editor: {
    onImageReady: (handler: (snapUrl: string) => void) => {
      const listener = (_evt: unknown, snapUrl: string): void => handler(snapUrl);
      ipcRenderer.on(IPC.editor.onImageReady, listener);
      return () => ipcRenderer.removeListener(IPC.editor.onImageReady, listener);
    },
    requestCurrent: (): Promise<string | null> => ipcRenderer.invoke(IPC.editor.requestCurrent),
    compose: (config: EditorBackgroundConfig): Promise<EditorComposeResult> =>
      ipcRenderer.invoke(IPC.editor.compose, config),
    openFile: (): Promise<string | null> => ipcRenderer.invoke(IPC.editor.openFile),
    requestKind: (): Promise<'image' | 'video' | 'gif' | null> =>
      ipcRenderer.invoke(IPC.editor.requestKind),
    trimVideo: (args: { startSeconds: number; endSeconds: number }) =>
      ipcRenderer.invoke(IPC.editor.trimVideo, args),
    exportGif: () => ipcRenderer.invoke(IPC.editor.exportGif),
  },
  hud: {
    onStack: (handler: (cards: HudCard[]) => void) => {
      const listener = (_evt: unknown, cards: HudCard[]): void => handler(cards);
      ipcRenderer.on(IPC.hud.onStack, listener);
      return () => ipcRenderer.removeListener(IPC.hud.onStack, listener);
    },
    requestStack: (): Promise<HudCard[]> => ipcRenderer.invoke(IPC.hud.requestStack),
    dismiss: (): Promise<void> => ipcRenderer.invoke(IPC.hud.dismiss),
    dismissCard: (id: number): Promise<void> => ipcRenderer.invoke(IPC.hud.dismissCard, id),
    discardCard: (id: number): Promise<void> => ipcRenderer.invoke(IPC.hud.discardCard, id),
    copyCard: (id: number): Promise<void> => ipcRenderer.invoke(IPC.hud.copyCard, id),
    saveCard: (id: number): Promise<{ saved: boolean; path: string | null }> =>
      ipcRenderer.invoke(IPC.hud.saveCard, id),
    openCardInEditor: (id: number): Promise<void> =>
      ipcRenderer.invoke(IPC.hud.openCardInEditor, id),
    beginDrag: (id: number): void => {
      ipcRenderer.send(IPC.hud.beginDrag, id);
    },
  },
  recording: {
    start: (opts: RecordingOptions): Promise<{ sessionId: string } | null> =>
      ipcRenderer.invoke(IPC.recording.start, opts),
    stop: (): Promise<RecordingResult> => ipcRenderer.invoke(IPC.recording.stop),
    cancel: (): Promise<void> => ipcRenderer.invoke(IPC.recording.cancel),
    pause: (): Promise<void> => ipcRenderer.invoke(IPC.recording.pause),
    resume: (): Promise<void> => ipcRenderer.invoke(IPC.recording.resume),
    restart: (): Promise<void> => ipcRenderer.invoke(IPC.recording.restart),
    state: (): Promise<RecordingStateSnapshot> => ipcRenderer.invoke(IPC.recording.state),
    onState: (handler: (snap: RecordingStateSnapshot) => void) => {
      const listener = (_evt: unknown, snap: RecordingStateSnapshot): void => handler(snap);
      ipcRenderer.on(IPC.recording.onState, listener);
      return () => ipcRenderer.removeListener(IPC.recording.onState, listener);
    },
    onTick: (handler: (payload: { durationMs: number }) => void) => {
      const listener = (_evt: unknown, payload: { durationMs: number }): void => handler(payload);
      ipcRenderer.on(IPC.recording.onTick, listener);
      return () => ipcRenderer.removeListener(IPC.recording.onTick, listener);
    },
    onEffectsConfig: (handler: (cfg: unknown) => void) => {
      const listener = (_evt: unknown, cfg: unknown): void => handler(cfg);
      ipcRenderer.on(IPC.recording.onEffectsConfig, listener);
      return () => ipcRenderer.removeListener(IPC.recording.onEffectsConfig, listener);
    },
    onClickEvent: (handler: (e: { x: number; y: number }) => void) => {
      const listener = (_evt: unknown, e: { x: number; y: number }): void => handler(e);
      ipcRenderer.on(IPC.recording.onClickEvent, listener);
      return () => ipcRenderer.removeListener(IPC.recording.onClickEvent, listener);
    },
    onKeyEvent: (handler: (e: unknown) => void) => {
      const listener = (_evt: unknown, e: unknown): void => handler(e);
      ipcRenderer.on(IPC.recording.onKeyEvent, listener);
      return () => ipcRenderer.removeListener(IPC.recording.onKeyEvent, listener);
    },
    onWebcamPrefs: (handler: (prefs: unknown) => void) => {
      const listener = (_evt: unknown, prefs: unknown): void => handler(prefs);
      ipcRenderer.on(IPC.recording.onWebcamPrefs, listener);
      return () => ipcRenderer.removeListener(IPC.recording.onWebcamPrefs, listener);
    },
    listDevices: (): Promise<{ cameras: string[]; mics: string[] }> =>
      ipcRenderer.invoke(IPC.recording.listDevices),
    onStageInit: (handler: (init: unknown) => void) => {
      const listener = (_evt: unknown, init: unknown): void => handler(init);
      ipcRenderer.on(IPC.recording.onStageInit, listener);
      return () => ipcRenderer.removeListener(IPC.recording.onStageInit, listener);
    },
    stageGetInit: (): Promise<unknown> => ipcRenderer.invoke(IPC.recording.stageGetInit),
    stageCommit: (result: {
      output: 'mp4' | 'gif';
      recordMicrophone: boolean;
      recordWebcam: boolean;
      captureClicks: boolean;
      captureKeystrokes: boolean;
    }): void => {
      ipcRenderer.send(IPC.recording.stageCommit, result);
    },
    stageCancel: (): void => {
      ipcRenderer.send(IPC.recording.stageCancel);
    },
    windowPickerList: () => ipcRenderer.invoke(IPC.recording.windowPickerList),
    windowPickerPick: (sourceId: string): void => {
      ipcRenderer.send(IPC.recording.windowPickerPick, sourceId);
    },
    windowPickerCancel: (): void => {
      ipcRenderer.send(IPC.recording.windowPickerCancel);
    },
    stageMicMenu: (currentLabel: string | null) =>
      ipcRenderer.invoke(IPC.recording.stageMicMenu, currentLabel),
    stageCameraMenu: (currentLabel: string | null) =>
      ipcRenderer.invoke(IPC.recording.stageCameraMenu, currentLabel),
    stageWebcamPreviewShow: (bounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    }): void => {
      ipcRenderer.send(IPC.recording.stageWebcamPreviewShow, bounds);
    },
    stageWebcamPreviewHide: (): void => {
      ipcRenderer.send(IPC.recording.stageWebcamPreviewHide);
    },
    stageOpenSettings: () => ipcRenderer.invoke(IPC.recording.stageOpenSettings),
    stageSwitchMode: (mode: 'region' | 'display' | 'window') =>
      ipcRenderer.invoke(IPC.recording.stageSwitchMode, mode),
    stageEffectsPreviewShow: (args: { wantClicks: boolean; wantKeys: boolean }): void => {
      ipcRenderer.send(IPC.recording.stageEffectsPreviewShow, args);
    },
    stageEffectsPreviewHide: (): void => {
      ipcRenderer.send(IPC.recording.stageEffectsPreviewHide);
    },
  },
  firstRun: {
    markDone: (): Promise<void> => ipcRenderer.invoke(IPC.firstRun.markDone),
    relaunch: (): Promise<void> => ipcRenderer.invoke(IPC.firstRun.relaunch),
  },
  history: {
    list: (limit?: number) => ipcRenderer.invoke(IPC.history.list, limit),
    openInEditor: (id: number) => ipcRenderer.invoke(IPC.history.openInEditor, id),
    revealInFinder: (id: number) => ipcRenderer.invoke(IPC.history.revealInFinder, id),
    deleteEntry: (id: number, alsoFile: boolean) =>
      ipcRenderer.invoke(IPC.history.deleteEntry, id, alsoFile),
    clearAll: () => ipcRenderer.invoke(IPC.history.clearAll),
  },
  app: {
    quit: (): Promise<void> => ipcRenderer.invoke(IPC.app.quit),
    version: (): Promise<string> => ipcRenderer.invoke(IPC.app.version),
  },
};

contextBridge.exposeInMainWorld('snapora', api);
