import type { CaptureMode, SelectionRect } from '@shared/types';

/**
 * Build the argv for /usr/sbin/screencapture.
 *
 * Pure function — kept in its own module so the unit tests don't have to
 * import `electron` (which screenshot.ts does for clipboard/nativeImage).
 *
 * Reference: `man screencapture`. Flags we use:
 *   -i  interactive (mouse selection)
 *   -W  start in window-selection mode (only with -i)
 *   -R  rect x,y,w,h in pixels (skips -i; we drove our own selection)
 *   -t  format (png|jpg|...)
 *   -o  do not include window shadow when in window mode
 *   -x  do not play sound
 *   -T  delay in seconds before capture (full-screen only)
 */
export function buildArgs(
  mode: CaptureMode,
  format: 'png' | 'jpg',
  delaySeconds: number,
  outFile: string,
  silent: boolean,
  region?: SelectionRect,
): string[] {
  // -x silences the shutter sound; omit it when the user wants the sound.
  const args: string[] = silent ? ['-x', '-t', format] : ['-t', format];

  // When we already know the rect (from our overlay or "previous area"),
  // -R replaces the interactive HUD entirely.
  // NOTE: `screencapture -R` requires integer pixel values. Passing decimals
  // (e.g. CSS-pixel coords from a Retina overlay drag) makes the command
  // silently fall back to a full-screen capture on macOS 14+.
  if (region) {
    const x = Math.round(region.x);
    const y = Math.round(region.y);
    const w = Math.round(region.width);
    const h = Math.round(region.height);
    args.push('-R', `${x},${y},${w},${h}`);
    args.push(outFile);
    return args;
  }

  switch (mode) {
    case 'area':
      args.push('-i');
      break;
    case 'window':
      args.push('-i', '-W', '-o');
      break;
    case 'fullscreen':
      if (delaySeconds > 0) args.push('-T', String(delaySeconds));
      break;
  }

  args.push(outFile);
  return args;
}
