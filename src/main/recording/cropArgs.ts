import type { SelectionRect } from '@shared/types';

/**
 * Pure-math helper that converts a user-space DIP rect (from the selection
 * overlay) into the pixel-space ffmpeg `crop` filter arguments.
 *
 * `screencapture -R` accepts DIPs and resolves Retina internally, but
 * `ffmpeg -f avfoundation` captures at the display's *native* (physical)
 * resolution — so we must multiply by `scaleFactor` to crop the right region.
 *
 * Kept in its own module (no Electron imports) so the unit tests don't have
 * to load the renderer/main runtime.
 */
export interface DisplayLikeForCrop {
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
}

export interface CropPx {
  /** ffmpeg crop filter: `crop=W:H:X:Y` */
  w: number;
  h: number;
  x: number;
  y: number;
}

/**
 * Convert a *global-DIP* rect to pixel-space coords *relative to the
 * display* (because ffmpeg captures one whole display at a time, then crops
 * within it).
 *
 * The rect must already be clamped to a single display.
 */
export function rectToCropPx(rect: SelectionRect, display: DisplayLikeForCrop): CropPx {
  const localX = rect.x - display.bounds.x;
  const localY = rect.y - display.bounds.y;
  const sx = display.scaleFactor;
  // Round so ffmpeg gets integer pixels (decimals make crop spit warnings or
  // skip the filter entirely depending on version).
  return {
    x: Math.round(localX * sx),
    y: Math.round(localY * sx),
    w: Math.round(rect.width * sx),
    h: Math.round(rect.height * sx),
  };
}

/** Stringify into the ffmpeg `crop=W:H:X:Y` argument. */
export function cropFilter(c: CropPx): string {
  return `crop=${c.w}:${c.h}:${c.x}:${c.y}`;
}
