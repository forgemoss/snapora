import type {
  CaptureMode,
  CaptureOptions,
  CaptureResult,
  PermissionState,
  AppPreferences,
  SelectionRect,
} from './types';

/**
 * Per-overlay init payload. The main process sends one of these to each
 * selection overlay window so the renderer can map local CSS coords to
 * global DIPs without round-tripping for every mouse event.
 */
export interface SelectionInitPayload {
  displayId: number;
  /** Display bounds in DIPs (top-left origin = primary display top-left). */
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
}

export interface HistoryItem {
  id: number;
  filePath: string;
  capturedAt: string;
  mode: CaptureMode;
  width: number | null;
  height: number | null;
  exists: boolean;
  snapUrl: string;
}

/**
 * Centralized IPC channel names. Both sides import from here so a typo is a compile error.
 */
export const IPC = {
  capture: {
    start: 'capture:start',
    cancel: 'capture:cancel',
  },
  selection: {
    /** main → renderer (per-overlay): SelectionInitPayload */
    init: 'selection:init',
    /** renderer → main: re-request the init payload after `did-finish-load` */
    request: 'selection:request',
    /** renderer → main: { displayId, rect } — user committed a region */
    commit: 'selection:commit',
    /** renderer → main: ESC pressed or click without drag */
    cancel: 'selection:cancel',
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
  history: {
    list: 'history:list',
    openInEditor: 'history:open-in-editor',
    revealInFinder: 'history:reveal-in-finder',
    deleteEntry: 'history:delete',
    clearAll: 'history:clear-all',
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
  selection: {
    /** Subscribe to per-window init payload. Returns an unsubscribe fn. */
    onInit(handler: (init: SelectionInitPayload) => void): () => void;
    /** Pull the init payload synchronously after mount. */
    request(): Promise<SelectionInitPayload | null>;
    commit(displayId: number, rect: SelectionRect): Promise<void>;
    cancel(): Promise<void>;
  };
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
  history: {
    list(limit?: number): Promise<HistoryItem[]>;
    openInEditor(id: number): Promise<void>;
    revealInFinder(id: number): Promise<void>;
    deleteEntry(id: number, alsoFile: boolean): Promise<void>;
    clearAll(): Promise<void>;
  };
  app: {
    quit(): Promise<void>;
    version(): Promise<string>;
  };
}
