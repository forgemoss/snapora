/**
 * Pure parser for `ffmpeg -f avfoundation -list_devices true -i ""` stderr.
 * No Electron / `node:fs` imports → easy to unit-test in vitest.
 */

export interface AvfDevice {
  index: number;
  label: string;
}

export interface AvfDevices {
  videoCameras: AvfDevice[];
  videoScreens: AvfDevice[];
  audioInputs: AvfDevice[];
}

const DEVICE_LINE = /^\s*\[AVFoundation indev[^\]]*\]\s*\[(\d+)\]\s*(.+?)\s*$/;
const VIDEO_HEADER = /AVFoundation video devices:/i;
const AUDIO_HEADER = /AVFoundation audio devices:/i;

export function parseDevices(stderr: string): AvfDevices {
  const lines = stderr.split('\n');
  const videoCameras: AvfDevice[] = [];
  const videoScreens: AvfDevice[] = [];
  const audioInputs: AvfDevice[] = [];

  let mode: 'video' | 'audio' | null = null;
  for (const line of lines) {
    if (VIDEO_HEADER.test(line)) {
      mode = 'video';
      continue;
    }
    if (AUDIO_HEADER.test(line)) {
      mode = 'audio';
      continue;
    }
    const m = line.match(DEVICE_LINE);
    if (!m) continue;
    const indexStr = m[1];
    const label = m[2];
    if (!indexStr || !label) continue;
    const index = Number(indexStr);
    const dev: AvfDevice = { index, label };
    if (mode === 'video') {
      if (/^Capture (screen|display)/i.test(label)) {
        videoScreens.push(dev);
      } else {
        videoCameras.push(dev);
      }
    } else if (mode === 'audio') {
      audioInputs.push(dev);
    }
  }
  return { videoCameras, videoScreens, audioInputs };
}

/**
 * Best-effort map from an Electron `Display.id` to an avfoundation screen
 * index. Macs enumerate screens in `screen.getAllDisplays()` order matching
 * avfoundation's `Capture screen N` ordering on macOS 13+ (empirically
 * stable; not formally documented).
 */
export function avfScreenIndexForDisplay(
  displayId: number,
  displays: { id: number }[],
  screens: AvfDevice[],
): number | null {
  const i = displays.findIndex((d) => d.id === displayId);
  if (i < 0 || i >= screens.length) return null;
  return screens[i]?.index ?? null;
}
