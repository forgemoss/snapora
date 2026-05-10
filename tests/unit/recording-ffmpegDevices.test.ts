import { describe, expect, it } from 'vitest';
import { avfScreenIndexForDisplay, parseDevices } from '@main/recording/ffmpegDevicesParse';

const STDERR_FIXTURE = `
ffmpeg version 7.1-tessus  https://evermeet.cx/ffmpeg/  Copyright (c) 2000-2024 the FFmpeg developers
[AVFoundation indev @ 0x149604380] AVFoundation video devices:
[AVFoundation indev @ 0x149604380] [0] FaceTime HD Camera
[AVFoundation indev @ 0x149604380] [1] OBS Virtual Camera
[AVFoundation indev @ 0x149604380] [2] Capture screen 0
[AVFoundation indev @ 0x149604380] [3] Capture screen 1
[AVFoundation indev @ 0x149604380] AVFoundation audio devices:
[AVFoundation indev @ 0x149604380] [0] MacBook Pro Microphone
[AVFoundation indev @ 0x149604380] [1] BlackHole 2ch
: Input/output error
`;

describe('parseDevices', () => {
  it('separates cameras, screens, and audio devices', () => {
    const result = parseDevices(STDERR_FIXTURE);
    expect(result.videoCameras.map((c) => c.label)).toEqual([
      'FaceTime HD Camera',
      'OBS Virtual Camera',
    ]);
    expect(result.videoScreens.map((s) => s.label)).toEqual([
      'Capture screen 0',
      'Capture screen 1',
    ]);
    expect(result.audioInputs.map((a) => a.label)).toEqual([
      'MacBook Pro Microphone',
      'BlackHole 2ch',
    ]);
  });

  it('preserves the original avfoundation indices', () => {
    const result = parseDevices(STDERR_FIXTURE);
    expect(result.videoScreens.map((s) => s.index)).toEqual([2, 3]);
    expect(result.audioInputs.map((a) => a.index)).toEqual([0, 1]);
  });

  it('returns empty arrays on empty input', () => {
    expect(parseDevices('')).toEqual({
      videoCameras: [],
      videoScreens: [],
      audioInputs: [],
    });
  });
});

describe('avfScreenIndexForDisplay', () => {
  const screens = [
    { index: 2, label: 'Capture screen 0' },
    { index: 3, label: 'Capture screen 1' },
  ];

  it('maps the first display to the first screen device by ordering', () => {
    const displays = [{ id: 100 }, { id: 200 }];
    expect(avfScreenIndexForDisplay(100, displays, screens)).toBe(2);
    expect(avfScreenIndexForDisplay(200, displays, screens)).toBe(3);
  });

  it('returns null when the display id is unknown', () => {
    expect(avfScreenIndexForDisplay(999, [{ id: 100 }], screens)).toBeNull();
  });

  it('returns null when there are fewer screens than displays', () => {
    expect(
      avfScreenIndexForDisplay(
        200,
        [{ id: 100 }, { id: 200 }],
        [{ index: 2, label: 'Capture screen 0' }],
      ),
    ).toBeNull();
  });
});
