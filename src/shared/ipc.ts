import type { CaptureOptions, CaptureResult, PermissionState, AppPreferences } from './types';

/**
 * Centralized IPC channel names. Both sides import from here so a typo is a compile error.
 */
export const IPC = {
  capture: {
    start: 'capture:start',
    cancel: 'capture:cancel',
  },
  permissions: {
    list: 'permissions:list',
    request: 'permissions:request',
    openSystemSettings: 'permissions:open-settings',
  },
  preferences: {
    get: 'preferences:get',
    set: 'preferences:set',
    chooseSaveDirectory: 'preferences:choose-save-directory',
  },
  editor: {
    onImageReady: 'editor:image-ready',
    requestCurrent: 'editor:request-current',
  },
  hud: {
    onImageReady: 'hud:image-ready',
    requestCurrent: 'hud:request-current',
    dismiss: 'hud:dismiss',
    closeAndDelete: 'hud:close-and-delete',
    copy: 'hud:copy',
    saveAs: 'hud:save-as',
    openInEditor: 'hud:open-in-editor',
  },
  firstRun: {
    markDone: 'first-run:mark-done',
    relaunch: 'first-run:relaunch',
  },
  app: {
    quit: 'app:quit',
    version: 'app:version',
  },
} as const;

/**
 * The shape of the `window.snapora` API exposed by the preload layer.
 * Keep this aligned with src/preload/index.ts.
 */
export interface SnaporaApi {
  capture(options: CaptureOptions): Promise<CaptureResult>;
  cancelCapture(): Promise<void>;
  permissions: {
    list(): Promise<PermissionState[]>;
    request(permission: PermissionState['permission']): Promise<PermissionState>;
    openSystemSettings(permission: PermissionState['permission']): Promise<void>;
  };
  preferences: {
    get(): Promise<AppPreferences>;
    set(patch: Partial<AppPreferences>): Promise<AppPreferences>;
    chooseSaveDirectory(): Promise<string | null>;
  };
  editor: {
    onImageReady(handler: (snapUrl: string) => void): () => void;
    /** Returns the most recent image URL the main process has shown, or null. */
    requestCurrent(): Promise<string | null>;
  };
  hud: {
    onImageReady(handler: (snapUrl: string) => void): () => void;
    requestCurrent(): Promise<string | null>;
    dismiss(): Promise<void>;
    /** Discard the capture: deletes the file from disk and dismisses the HUD. */
    closeAndDelete(): Promise<void>;
    copy(): Promise<void>;
    saveAs(): Promise<{ saved: boolean; path: string | null }>;
    openInEditor(): Promise<void>;
  };
  firstRun: {
    markDone(): Promise<void>;
    relaunch(): Promise<void>;
  };
  app: {
    quit(): Promise<void>;
    version(): Promise<string>;
  };
}
