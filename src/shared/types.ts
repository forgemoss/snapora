export type CaptureMode = 'area' | 'window' | 'fullscreen';

export type CaptureFormat = 'png' | 'jpg';

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
  /** Hide the desktop icons (system-wide). Restored when Snapora quits. */
  hideDesktopIcons: boolean;
  /** Delay before a full-screen capture fires (gives you time to set up). 0 = no timer. */
  selfTimerSeconds: 0 | 3 | 5 | 10;

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
  selfTimerSeconds: 0,
  hotkeys: {
    area: 'CommandOrControl+Shift+2',
    window: 'CommandOrControl+Shift+3',
    fullscreen: 'CommandOrControl+Shift+4',
  },
};
