import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc';
import type {
  AppPreferences,
  CaptureOptions,
  CaptureResult,
  Permission,
  PermissionState,
} from '@shared/types';
import type { SnaporaApi } from '@shared/ipc';

const api: SnaporaApi = {
  capture: (options: CaptureOptions): Promise<CaptureResult> =>
    ipcRenderer.invoke(IPC.capture.start, options),
  cancelCapture: (): Promise<void> => ipcRenderer.invoke(IPC.capture.cancel),
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
  editor: {
    onImageReady: (handler: (snapUrl: string) => void) => {
      const listener = (_evt: unknown, snapUrl: string): void => handler(snapUrl);
      ipcRenderer.on(IPC.editor.onImageReady, listener);
      return () => ipcRenderer.removeListener(IPC.editor.onImageReady, listener);
    },
    requestCurrent: (): Promise<string | null> => ipcRenderer.invoke(IPC.editor.requestCurrent),
  },
  hud: {
    onImageReady: (handler: (snapUrl: string) => void) => {
      const listener = (_evt: unknown, snapUrl: string): void => handler(snapUrl);
      ipcRenderer.on(IPC.hud.onImageReady, listener);
      return () => ipcRenderer.removeListener(IPC.hud.onImageReady, listener);
    },
    requestCurrent: (): Promise<string | null> => ipcRenderer.invoke(IPC.hud.requestCurrent),
    dismiss: (): Promise<void> => ipcRenderer.invoke(IPC.hud.dismiss),
    closeAndDelete: (): Promise<void> => ipcRenderer.invoke(IPC.hud.closeAndDelete),
    copy: (): Promise<void> => ipcRenderer.invoke(IPC.hud.copy),
    saveAs: (): Promise<{ saved: boolean; path: string | null }> =>
      ipcRenderer.invoke(IPC.hud.saveAs),
    openInEditor: (): Promise<void> => ipcRenderer.invoke(IPC.hud.openInEditor),
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
