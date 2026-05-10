export type CaptureMode = 'area' | 'window' | 'fullscreen';

export type CaptureFormat = 'png' | 'jpg';

/**
 * A rectangle in global DIPs (display-independent pixels), the same unit
 * `screencapture -R` accepts and `electron.screen.getAllDisplays()[i].bounds`
 * reports. Origin is top-left of the primary display.
 */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureOptions {
  mode: CaptureMode;
  format?: CaptureFormat;
  copyToClipboard?: boolean;
  saveToDisk?: boolean;
  /** Delay in milliseconds before capture is triggered. */
  delayMs?: number;
  /** Hide desktop icons during capture. */
  hideDesktopIcons?: boolean;
  /** Suppress the macOS shutter sound. Default true. Set to false to play it. */
  silent?: boolean;
  /**
   * Pre-resolved rectangle to capture. When set, bypasses `screencapture -i`
   * and uses `-R x,y,w,h` directly. Used by the homegrown selection overlay
   * (and by "Capture Previous Area" once that ships in PR2).
   */
  region?: SelectionRect;
}

export interface CaptureResult {
  /** Absolute path to the saved file, or null if save was disabled / cancelled. */
  filePath: string | null;
  /** ISO timestamp of capture. */
  capturedAt: string;
  width: number | null;
  height: number | null;
  /** True if the user cancelled the selection (e.g. pressed escape). */
  cancelled: boolean;
}

export type Permission = 'screen-recording' | 'microphone' | 'camera' | 'accessibility';

export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

export interface PermissionState {
  permission: Permission;
  status: PermissionStatus;
}

export interface AppPreferences {
  // ----- App lifecycle -----
  /** True once the user has completed (or skipped) the first-run wizard. */
  seenFirstRun: boolean;

  // ----- General -----
  /** Launch Snapora when the Mac boots. */
  launchAtLogin: boolean;
  /** Play the macOS shutter sound when a capture happens. */
  soundOnCapture: boolean;
  /** Hide the Dock icon (menu-bar-only mode). v0.1 default: true. */
  menuBarOnly: boolean;
  /** Folder where screenshots are saved. */
  saveDirectory: string;
  /** Default capture format. */
  defaultFormat: CaptureFormat;
  /** Copy to clipboard automatically after capture. */
  autoCopyToClipboard: boolean;
  /**
   * Persistent "always hide desktop icons" toggle (mirrors CleanShot's
   * menu-bar item). Lives across Snapora's lifetime; restored on quit.
   */
  hideDesktopIcons: boolean;
  /**
   * Auto-hide desktop icons just for the duration of each capture
   * (mirrors CleanShot's General → "Hide while capturing" checkbox).
   * No-op when `hideDesktopIcons` is already true.
   */
  hideDesktopIconsDuringCaptures: boolean;
  /**
   * Window-mode background. Snapora composites the captured window onto
   * this background instead of the original macOS desktop. Only applies
   * to `window` mode captures — `area` and `fullscreen` capture the real
   * desktop unchanged.
   *  - `system`        no compositing, capture the window as-is with macOS shadow
   *  - `customImage`   composite onto `customWallpaperImagePath`
   *  - `customColor`   composite onto a flat `customWallpaperColor` background
   */
  wallpaperMode: 'system' | 'customImage' | 'customColor';
  /** Absolute path to the user's chosen background image, or null. */
  customWallpaperImagePath: string | null;
  /** Hex color used by `customColor`, e.g. `#0f172a`. */
  customWallpaperColor: string;
  /** Padding (DIPs) between the captured window and the background edge. */
  windowBackgroundPaddingPx: number;
  /** Delay before a full-screen capture fires (gives you time to set up). 0 = no timer. */
  selfTimerSeconds: 0 | 3 | 5 | 10;

  // ----- Quick Access HUD -----
  /** Where on the screen the post-capture HUD docks. */
  hudPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /**
   * When true, the HUD shows on whichever display the cursor is currently on.
   * When false, it always shows on the primary display.
   */
  hudFollowActiveScreen: boolean;
  /** Card size in the HUD. Bigger = easier to read, more screen real estate. */
  hudSize: 'small' | 'medium' | 'large';
  /** Whether the HUD auto-hides after a delay. */
  hudAutoCloseEnabled: boolean;
  /** Seconds before auto-close fires when enabled. */
  hudAutoCloseSeconds: 3 | 6 | 10 | 30;
  /**
   * Route "Capture Area" through Snapora's homegrown selection overlay
   * (transparent fullscreen window per display) instead of `screencapture -i`.
   * Default true. Kept as a flag for one release as a safety valve in case
   * the overlay misbehaves on user setups we haven't tested. Slated for
   * removal in v0.3 once recording (v0.4) also uses the overlay.
   */
  useCustomSelectionOverlay: boolean;

  // ----- Recording -----
  /** Frame rate for new recordings. */
  recordingFramerate: 24 | 30 | 60;
  /** Quality bucket → ffmpeg `-b:v` (Standard 4M / High 8M / Best 16M). */
  recordingQuality: 'standard' | 'high' | 'best';
  /** Output container — only `mp4` for v0.4. */
  recordingFormat: 'mp4';
  /** Folder where recordings are saved (resolves to ~/Movies/Snapora at runtime). */
  recordingSaveDirectory: string;
  /** Default mode when the user clicks "Record Screen". */
  recordingDefaultMode: 'region' | 'display' | 'window';
  /** Hotkey to start a recording (or stop one in flight). */
  recordingHotkey: string;
  /** Auto-toggle Do Not Disturb at recording start. */
  recordingHideNotifications: boolean;
  /** Countdown (seconds) before recording starts. 0 = no countdown. */
  recordingCountdownSeconds: 0 | 3 | 5 | 10;

  /** Show the floating controls bar while recording (timer + stop / pause / restart / trash). */
  recordingShowControls: boolean;
  /** Dim the screen outside the recording region during a region recording. */
  recordingDimScreen: boolean;
  /** Persist the last region the user selected so the next region recording starts there. */
  recordingRememberLastSelection: boolean;
  /** Last-used region (DIPs) when `recordingRememberLastSelection` is on. */
  recordingLastRegion: SelectionRect | null;
  /** Preserve the cursor in the captured video. macOS captures it by default. */
  recordingShowCursor: boolean;
  /** Auto-open the editor for the saved recording on stop. */
  recordingOpenEditorAfter: boolean;

  /** Cap the recorded video's longest edge in pixels. `null` = original. */
  recordingMaxResolution: 720 | 1080 | 1440 | 2160 | null;
  /** Record audio in mono (smaller file, fine for most narration). */
  recordingAudioMono: boolean;

  /** Frame rate of the GIF post-process. */
  recordingGifFps: 10 | 15 | 24 | 30;
  /** Bayer dither scale: smaller = sharper but bigger file. 1–5. */
  recordingGifQuality: 1 | 2 | 3 | 4 | 5;
  /** Cap the GIF's longest edge in pixels. `null` = original. */
  recordingGifMaxWidth: 480 | 640 | 800 | 1280 | null;

  /** Capture from the system mic during the recording. */
  recordingMicrophone: boolean;
  /** Preferred mic device label (matches avfoundation enumeration). */
  recordingMicrophoneDevice: string;

  /** Show the floating webcam preview during recording (and bake it into the file). */
  recordingWebcamEnabled: boolean;
  /** Preferred camera device label. */
  recordingWebcamDevice: string;
  recordingWebcamPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  recordingWebcamSize: 'small' | 'medium' | 'large';
  recordingWebcamShape: 'rectangle' | 'rounded' | 'circle';
  recordingWebcamMirrored: boolean;
  recordingWebcamFullscreen: boolean;

  /** Highlight the cursor on click (drawn into the recorded video). */
  recordingCaptureClicks: boolean;
  recordingClickColor: string; // hex
  recordingClickSize: 'small' | 'medium' | 'large';
  recordingClickStyle: 'outline' | 'filled';
  recordingClickAnimated: boolean;

  /** Show the keys the user pressed (drawn into the recorded video). */
  recordingCaptureKeystrokes: boolean;
  recordingKeyPosition:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right';
  recordingKeySize: 'small' | 'medium' | 'large';
  recordingKeyStyle: 'dark' | 'light';
  /** When true, only show the pill while a modifier (⌘/⌥/⌃/⇧) is held. */
  recordingKeyOnlyCommandKeys: boolean;

  // ----- Shortcuts -----
  /** Global hotkey strings (Electron accelerator format) per capture mode. */
  hotkeys: Record<CaptureMode, string>;
}

/** Public types for the recording pipeline (consumed by IPC + renderer). */
export type RecordingMode = 'region' | 'display' | 'window';

export interface RecordingOptions {
  mode: RecordingMode;
  /** Pre-resolved region — when omitted in `region` mode, the selection overlay opens. */
  region?: SelectionRect;
  displayId?: number;

  /**
   * Output format. `mp4` saves directly. `gif` records mp4 then post-processes
   * via ffmpeg's palettegen/paletteuse to produce a GIF and discards the mp4.
   */
  output?: 'mp4' | 'gif';

  // Per-recording overrides; if omitted, the user's prefs are used.
  recordMicrophone?: boolean;
  recordWebcam?: boolean;
  captureClicks?: boolean;
  captureKeystrokes?: boolean;
  hideNotifications?: boolean;
  framerate?: AppPreferences['recordingFramerate'];
  quality?: AppPreferences['recordingQuality'];
}

export interface RecordingResult {
  filePath: string | null;
  cancelled: boolean;
  durationMs: number;
  startedAt: string;
  endedAt: string;
}

export type RecordingPhase =
  | 'idle'
  | 'countdown'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'finalizing'
  | 'failed';

export interface RecordingStateSnapshot {
  phase: RecordingPhase;
  sessionId: string | null;
  startedAt: number | null;
  durationMs: number;
  error?: string;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  seenFirstRun: false,
  launchAtLogin: false,
  soundOnCapture: false,
  menuBarOnly: true,
  saveDirectory: '', // resolved at runtime to ~/Pictures/Snapora
  defaultFormat: 'png',
  autoCopyToClipboard: true,
  hideDesktopIcons: false,
  hideDesktopIconsDuringCaptures: false,
  wallpaperMode: 'system',
  customWallpaperImagePath: null,
  customWallpaperColor: '#0f172a',
  windowBackgroundPaddingPx: 64,
  selfTimerSeconds: 0,
  hudPosition: 'bottom-right',
  hudFollowActiveScreen: true,
  hudSize: 'medium',
  hudAutoCloseEnabled: true,
  hudAutoCloseSeconds: 6,
  useCustomSelectionOverlay: true,

  recordingFramerate: 30,
  recordingQuality: 'high',
  recordingFormat: 'mp4',
  recordingSaveDirectory: '',
  recordingDefaultMode: 'region',
  recordingHotkey: 'CommandOrControl+Shift+5',
  recordingHideNotifications: false,
  recordingCountdownSeconds: 3,

  recordingShowControls: true,
  recordingDimScreen: true,
  recordingRememberLastSelection: false,
  recordingLastRegion: null,
  recordingShowCursor: true,
  recordingOpenEditorAfter: false,
  recordingMaxResolution: null,
  recordingAudioMono: false,
  recordingGifFps: 15,
  recordingGifQuality: 5,
  recordingGifMaxWidth: 800,

  recordingMicrophone: false,
  recordingMicrophoneDevice: '',

  recordingWebcamEnabled: false,
  recordingWebcamDevice: '',
  recordingWebcamPosition: 'bottom-right',
  recordingWebcamSize: 'medium',
  recordingWebcamShape: 'circle',
  recordingWebcamMirrored: true,
  recordingWebcamFullscreen: false,

  recordingCaptureClicks: false,
  recordingClickColor: '#3b82f6',
  recordingClickSize: 'medium',
  recordingClickStyle: 'outline',
  recordingClickAnimated: true,

  recordingCaptureKeystrokes: false,
  recordingKeyPosition: 'bottom-center',
  recordingKeySize: 'medium',
  recordingKeyStyle: 'dark',
  recordingKeyOnlyCommandKeys: true,

  hotkeys: {
    area: 'CommandOrControl+Shift+2',
    window: 'CommandOrControl+Shift+3',
    fullscreen: 'CommandOrControl+Shift+4',
  },
};
