import type {
  CaptureMode,
  CaptureOptions,
  CaptureResult,
  PermissionState,
  AppPreferences,
  SelectionRect,
  RecordingOptions,
  RecordingResult,
  RecordingStateSnapshot,
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
  /** Path to the actual file the user captured (image OR video). */
  filePath: string;
  /**
   * snap:// URL the renderer paints. For screenshots this is `filePath`;
   * for recordings this is a generated still-frame thumbnail PNG sitting
   * next to the .mp4, so the HUD doesn't have to play the video.
   */
  snapUrl: string;
  width: number | null;
  height: number | null;
  capturedAt: string;
  /** 'screenshot' (default) or 'recording'. */
  kind?: 'screenshot' | 'recording';
  /** Total duration of the recording in ms (recordings only). */
  durationMs?: number | null;
}

export type EditorAlignment =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Background config for the editor's "Background tool". Maps onto the
 * shared `compositeWindowOnBackground` helper.
 */
export interface EditorBackgroundConfig {
  /** `none` skips compositing — file stays as-is. */
  type: 'none' | 'color' | 'image' | 'gradient';
  /**
   * - `color`: hex like `#0f172a`
   * - `image`: absolute path
   * - `gradient`: any valid CSS background-image (e.g. `linear-gradient(...)`)
   */
  value?: string;
  /** DIPs of background visible around the captured image. */
  paddingPx: number;
  /** Drop-shadow strength in DIPs. 0 = no shadow. Default 30. */
  shadowPx?: number;
  /** Border-radius in DIPs on the captured image. 0 = use natural alpha shape. */
  cornersPx?: number;
  /** Where the captured image sits within the canvas. Default `center`. */
  alignment?: EditorAlignment;
}

export interface EditorComposeResult {
  /** Updated snap:// URL (cache-busted with `?v=`) for the renderer to reload. */
  snapUrl: string;
}

export interface WindowPickerSource {
  id: string;
  name: string;
  appIcon: string | null;
  thumbnail: string;
  /** Display id this window is on (matches `screen.getAllDisplays()`); may be empty. */
  displayId: string;
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
    /**
     * Re-composite the current image with a new background config.
     * Replaces the file in place and returns the new snap:// URL (with a
     * cache-busting suffix) so the renderer can refresh its <img>.
     */
    compose: 'editor:compose',
    /** Open a file dialog and load the picked image into the editor. */
    openFile: 'editor:open-file',
    /** Pull the kind ('image' / 'video' / 'gif') of the current media. */
    requestKind: 'editor:request-kind',
    /** Trim the loaded video to [startSeconds, endSeconds] and replace in place. */
    trimVideo: 'editor:trim-video',
    /** Export the loaded video as a GIF next to the original. */
    exportGif: 'editor:export-gif',
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
  recording: {
    /** renderer → main: start a recording. */
    start: 'recording:start',
    /** renderer → main: graceful stop. */
    stop: 'recording:stop',
    /** renderer → main: discard mid-recording. */
    cancel: 'recording:cancel',
    /** renderer → main: pause the active recording (segment saved). */
    pause: 'recording:pause',
    /** renderer → main: resume from paused state. */
    resume: 'recording:resume',
    /** renderer → main: discard segments and start over from t=0. */
    restart: 'recording:restart',
    /** renderer → main: pull the current state snapshot. */
    state: 'recording:state',
    /** main → renderer: state-machine transition. */
    onState: 'recording:on-state',
    /** main → controls renderer: timer tick (every 1s). */
    onTick: 'recording:on-tick',
    /** main → effects renderer: push the user's per-effect prefs. */
    onEffectsConfig: 'recording:on-effects-config',
    /** main → effects renderer: a global mouse-down landed. */
    onClickEvent: 'recording:on-click',
    /** main → effects renderer: a global keydown landed. */
    onKeyEvent: 'recording:on-key',
    /** main → webcam renderer: webcam config push. */
    onWebcamPrefs: 'recording:on-webcam-prefs',
    /** renderer → main: list available cameras / mics for Settings. */
    listDevices: 'recording:list-devices',
    /** main → stage renderer: pass region + initial settings on mount. */
    onStageInit: 'recording:on-stage-init',
    /** stage renderer → main: pull the pending stage init (avoids ready-to-show race). */
    stageGetInit: 'recording:stage-get-init',
    /** stage renderer → main: user clicked Record GIF / Record Video. */
    stageCommit: 'recording:stage-commit',
    /** stage renderer → main: user closed the stage without recording. */
    stageCancel: 'recording:stage-cancel',
    /** window-picker renderer → main: list available capturable windows. */
    windowPickerList: 'recording:window-picker-list',
    /** window-picker renderer → main: user clicked a window thumbnail. */
    windowPickerPick: 'recording:window-picker-pick',
    /** window-picker renderer → main: user dismissed the picker. */
    windowPickerCancel: 'recording:window-picker-cancel',
    /** stage renderer → main: open the mic device-picker native menu. */
    stageMicMenu: 'recording:stage-mic-menu',
    /** stage renderer → main: open the camera device-picker native menu. */
    stageCameraMenu: 'recording:stage-camera-menu',
    /** stage renderer → main: show the small webcam preview overlay. */
    stageWebcamPreviewShow: 'recording:stage-webcam-preview-show',
    /** stage renderer → main: hide the webcam preview overlay. */
    stageWebcamPreviewHide: 'recording:stage-webcam-preview-hide',
    /** stage renderer → main: cancel current stage AND open Settings. */
    stageOpenSettings: 'recording:stage-open-settings',
    /** stage renderer → main: cancel current stage AND start a different mode. */
    stageSwitchMode: 'recording:stage-switch-mode',
    /** stage renderer → main: show the click+keystroke preview overlay. */
    stageEffectsPreviewShow: 'recording:stage-effects-preview-show',
    /** stage renderer → main: hide the click+keystroke preview overlay. */
    stageEffectsPreviewHide: 'recording:stage-effects-preview-hide',
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
    /** Re-composite the current image and replace it on disk. */
    compose(config: EditorBackgroundConfig): Promise<EditorComposeResult>;
    /**
     * Open a file dialog and load the picked image into the editor.
     * Returns the new snap:// URL, or null if the user cancelled.
     */
    openFile(): Promise<string | null>;
    /** Pull the kind of the current media (image / video / gif). */
    requestKind(): Promise<'image' | 'video' | 'gif' | null>;
    /** Trim the loaded video. */
    trimVideo(args: {
      startSeconds: number;
      endSeconds: number;
    }): Promise<{ snapUrl: string; filePath: string }>;
    /** Export the loaded video as a GIF next to the original. */
    exportGif(): Promise<{ filePath: string; snapUrl: string }>;
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
  recording: {
    start(opts: RecordingOptions): Promise<{ sessionId: string } | null>;
    stop(): Promise<RecordingResult>;
    cancel(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    restart(): Promise<void>;
    state(): Promise<RecordingStateSnapshot>;
    onState(handler: (snap: RecordingStateSnapshot) => void): () => void;
    onTick(handler: (payload: { durationMs: number }) => void): () => void;
    onEffectsConfig(handler: (cfg: unknown) => void): () => void;
    onClickEvent(handler: (e: { x: number; y: number }) => void): () => void;
    onKeyEvent(handler: (e: unknown) => void): () => void;
    onWebcamPrefs(handler: (prefs: unknown) => void): () => void;
    listDevices(): Promise<{ cameras: string[]; mics: string[] }>;
    onStageInit(handler: (init: unknown) => void): () => void;
    stageGetInit(): Promise<unknown>;
    stageCommit(result: {
      output: 'mp4' | 'gif';
      recordMicrophone: boolean;
      recordWebcam: boolean;
      captureClicks: boolean;
      captureKeystrokes: boolean;
    }): void;
    stageCancel(): void;
    windowPickerList(): Promise<WindowPickerSource[]>;
    windowPickerPick(sourceId: string): void;
    windowPickerCancel(): void;
    /**
     * Pop the native mic device menu next to the stage toolbar's mic icon.
     * Returns: `string` = picked device label (renderer should activate),
     * `undefined` = user dismissed the menu. Toggle on/off is handled by
     * the toggle icon click, not the menu.
     */
    stageMicMenu(currentLabel: string | null): Promise<string | undefined>;
    stageCameraMenu(currentLabel: string | null): Promise<string | undefined>;
    stageWebcamPreviewShow(regionBounds: {
      x: number;
      y: number;
      width: number;
      height: number;
    }): void;
    stageWebcamPreviewHide(): void;
    stageOpenSettings(): Promise<void>;
    stageSwitchMode(mode: 'region' | 'display' | 'window'): Promise<void>;
    stageEffectsPreviewShow(args: { wantClicks: boolean; wantKeys: boolean }): void;
    stageEffectsPreviewHide(): void;
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
