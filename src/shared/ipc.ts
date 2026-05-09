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
 * One card in the Quick Access HUD stack. The HUD shows a vertical pile of
 * these — newest at the top, capped at `HUD_MAX_STACK` (in src/main/windows/hud.ts).
 * `id` is a monotonic counter assigned when the card is pushed.
 */
export interface HudCard {
  id: number;
  filePath: string;
  /** snap:// URL the renderer can load directly. */
  snapUrl: string;
  width: number | null;
  height: number | null;
  capturedAt: string;
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
  wallpaper: {
    /** Open a file dialog → returns the chosen image's absolute path or null. */
    chooseImage: 'wallpaper:choose-image',
  },
  editor: {
    onImageReady: 'editor:image-ready',
    requestCurrent: 'editor:request-current',
  },
  hud: {
    /** main → renderer: a fresh card just landed; full stack is sent. */
    onStack: 'hud:on-stack',
    /** renderer → main: pull the current stack on mount. */
    requestStack: 'hud:request-stack',
    /** renderer → main: dismiss the HUD entirely (clears the stack from view). */
    dismiss: 'hud:dismiss',
    /** renderer → main: drop one card by id (does NOT delete the file). */
    dismissCard: 'hud:dismiss-card',
    /** renderer → main: drop one card AND delete its file from disk. */
    discardCard: 'hud:discard-card',
    /** renderer → main: copy one card's image to the clipboard. */
    copyCard: 'hud:copy-card',
    /** renderer → main: open Save As dialog for one card. */
    saveCard: 'hud:save-card',
    /** renderer → main: open one card in the editor. */
    openCardInEditor: 'hud:open-card-in-editor',
    /**
     * renderer → main (one-way `send`): the user started dragging a card's
     * image. Main calls `webContents.startDrag` so the file becomes a real
     * drag-and-drop into other apps (Slack, Mail, Finder, …).
     */
    beginDrag: 'hud:begin-drag',
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
  wallpaper: {
    chooseImage(): Promise<string | null>;
  };
  editor: {
    onImageReady(handler: (snapUrl: string) => void): () => void;
    /** Returns the most recent image URL the main process has shown, or null. */
    requestCurrent(): Promise<string | null>;
  };
  hud: {
    /** Subscribe to stack pushes. Handler receives the full updated stack. */
    onStack(handler: (cards: HudCard[]) => void): () => void;
    /** Pull the current stack synchronously (e.g. on renderer mount). */
    requestStack(): Promise<HudCard[]>;
    /** Hide the HUD without touching files. */
    dismiss(): Promise<void>;
    /** Drop one card from the stack. File on disk is preserved. */
    dismissCard(id: number): Promise<void>;
    /** Drop one card AND delete its file from disk. */
    discardCard(id: number): Promise<void>;
    /** Copy one card's image to the clipboard. */
    copyCard(id: number): Promise<void>;
    /** Open Save As dialog for one card. */
    saveCard(id: number): Promise<{ saved: boolean; path: string | null }>;
    /** Open one card in the editor. */
    openCardInEditor(id: number): Promise<void>;
    /**
     * Tell main to start an OS drag for this card's file. Must be called
     * synchronously from a `dragstart` event so the OS picks it up.
     */
    beginDrag(id: number): void;
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
