import { cropFilter } from '@main/recording/cropArgs';

/**
 * Pure ffmpeg argv builder for `recording/session.ts`. Lives in its own
 * module so vitest can import it without dragging in Electron.
 */

export interface BuildArgsInput {
  ffmpegPath: string; // included for symmetry; the spawn call uses it as argv[0]
  screenIdx: number;
  micIdx: number | null;
  framerate: number;
  bitrate: string; // e.g. "8M"
  cropPx: { x: number; y: number; w: number; h: number } | null;
  outFile: string;
}

export function buildRecordingArgs(args: BuildArgsInput): string[] {
  // -use_wallclock_as_timestamps 1 stamps both inputs with the same clock so
  // audio/video stay aligned. -thread_queue_size 1024 prevents avfoundation
  // from dropping samples when one input briefly stalls (drift compounds).
  const av: string[] = [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-fflags',
    '+genpts',
    '-f',
    'avfoundation',
    '-thread_queue_size',
    '1024',
    '-use_wallclock_as_timestamps',
    '1',
    '-capture_cursor',
    '1',
    '-framerate',
    String(args.framerate),
    '-i',
    `${args.screenIdx}:none`,
  ];
  if (args.micIdx != null) {
    av.push(
      '-f',
      'avfoundation',
      '-thread_queue_size',
      '1024',
      '-use_wallclock_as_timestamps',
      '1',
      '-i',
      `:${args.micIdx}`,
    );
  }

  if (args.cropPx) {
    av.push('-filter_complex', `[0:v]${cropFilter(args.cropPx)}[v]`);
    av.push('-map', '[v]');
  } else {
    av.push('-map', '0:v');
  }
  if (args.micIdx != null) {
    av.push('-map', '1:a');
  }

  av.push(
    '-c:v',
    'h264_videotoolbox',
    '-b:v',
    args.bitrate,
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
  );
  if (args.micIdx != null) {
    // -async 1 nudges audio samples to keep PTS aligned with video. Without
    // it, the screen and mic streams drift over a multi-minute recording.
    av.push('-c:a', 'aac', '-b:a', '128k', '-async', '1');
  }

  av.push('-y', args.outFile);
  return av;
}
