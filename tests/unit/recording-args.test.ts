import { describe, expect, it } from 'vitest';
import { buildRecordingArgs } from '@main/recording/recordingArgs';

describe('buildRecordingArgs', () => {
  it('emits a screen-only invocation when no mic / no crop', () => {
    const args = buildRecordingArgs({
      ffmpegPath: '/x/ffmpeg',
      screenIdx: 2,
      micIdx: null,
      framerate: 30,
      bitrate: '8M',
      cropPx: null,
      outFile: '/tmp/out.mp4',
    });
    expect(args).toContain('-f');
    expect(args).toContain('avfoundation');
    expect(args).toContain('2:none');
    expect(args).not.toContain('-filter_complex');
    expect(args).toContain('-map');
    expect(args).toContain('0:v');
    expect(args).not.toContain('-c:a');
    expect(args).toContain('-c:v');
    expect(args).toContain('h264_videotoolbox');
  });

  it('adds a crop filter when cropPx is set', () => {
    const args = buildRecordingArgs({
      ffmpegPath: '/x/ffmpeg',
      screenIdx: 2,
      micIdx: null,
      framerate: 60,
      bitrate: '16M',
      cropPx: { x: 100, y: 50, w: 800, h: 600 },
      outFile: '/tmp/out.mp4',
    });
    const i = args.indexOf('-filter_complex');
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe('[0:v]crop=800:600:100:50[v]');
    expect(args).toContain('[v]');
  });

  it('adds a second avfoundation input + audio mapping when micIdx is set', () => {
    const args = buildRecordingArgs({
      ffmpegPath: '/x/ffmpeg',
      screenIdx: 2,
      micIdx: 0,
      framerate: 30,
      bitrate: '4M',
      cropPx: null,
      outFile: '/tmp/out.mp4',
    });
    // Two `-f avfoundation` blocks (one for screen, one for mic).
    const fCount = args.filter((a) => a === '-f').length;
    expect(fCount).toBe(2);
    expect(args).toContain(':0'); // mic-only avfoundation device spec
    expect(args).toContain('1:a'); // mapped audio
    expect(args).toContain('-c:a');
    expect(args).toContain('aac');
  });
});
