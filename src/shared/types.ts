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

  // ----- Shortcuts -----
  /** Global hotkey strings (Electron accelerator format) per capture mode. */
  hotkeys: Record<CaptureMode, string>;
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
  hotkeys: {
    area: 'CommandOrControl+Shift+2',
    window: 'CommandOrControl+Shift+3',
    fullscreen: 'CommandOrControl+Shift+4',
  },
};
