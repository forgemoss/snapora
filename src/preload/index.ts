import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc';
import type {
  AppPreferences,
  CaptureOptions,
  CaptureResult,
  Permission,
  PermissionState,
  SelectionRect,
} from '@shared/types';
import type { HudCard, SelectionInitPayload, SnaporaApi } from '@shared/ipc';

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
