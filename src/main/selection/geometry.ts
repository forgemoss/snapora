import type { SelectionRect } from '@shared/types';

/**
 * Subset of `Electron.Display` we care about. Spelled out so this module can
 * be unit-tested without importing `electron`.
 */
export interface DisplayLike {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
}

/** A rect plus the displayId it was captured on, for staleness checks. */
export interface StoredRegion extends SelectionRect {
  displayId?: number;
}

/**
 * Convert a CSS-pixel rect inside an overlay window (which covers a single
 * display) to a global DIP rect that `screencapture -R` can consume.
 *
 * Both sides use DIPs (not raw pixels) — Retina scaling is handled by
 * `screencapture` itself, so we never multiply by scaleFactor.
 */
export function localToGlobalDips(
  local: SelectionRect,
  origin: { bounds: { x: number; y: number } },
): SelectionRect {
  return {
    x: origin.bounds.x + local.x,
    y: origin.bounds.y + local.y,
    width: local.width,
    height: local.height,
  };
}

/** True if rect has positive area >= the minimum drag threshold. */
export function isRectMeaningful(rect: SelectionRect, minDip = 4): boolean {
  return rect.width >= minDip && rect.height >= minDip;
}

/**
 * Normalize a drag from anchor → current pointer into a positive-width rect,
 * regardless of which direction the user dragged.
 */
export function rectFromDrag(
  anchor: { x: number; y: number },
  current: { x: number; y: number },
): SelectionRect {
  const x = Math.min(anchor.x, current.x);
  const y = Math.min(anchor.y, current.y);
  const width = Math.abs(current.x - anchor.x);
  const height = Math.abs(current.y - anchor.y);
  return { x, y, width, height };
}

/** Clamp a rect into a single display's bounds. Returns null if no overlap. */
export function clampToDisplay(rect: SelectionRect, display: DisplayLike): SelectionRect | null {
  const dx1 = display.bounds.x;
  const dy1 = display.bounds.y;
  const dx2 = display.bounds.x + display.bounds.width;
  const dy2 = display.bounds.y + display.bounds.height;
  const rx1 = Math.max(rect.x, dx1);
  const ry1 = Math.max(rect.y, dy1);
  const rx2 = Math.min(rect.x + rect.width, dx2);
  const ry2 = Math.min(rect.y + rect.height, dy2);
  if (rx2 <= rx1 || ry2 <= ry1) return null;
  return { x: rx1, y: ry1, width: rx2 - rx1, height: ry2 - ry1 };
}

/**
 * Decide whether a previously-stored region is still valid against the
 * current set of displays. Used to enable/disable "Capture Previous Area".
 *
 * Strategy:
 *   1. Try to find the original `displayId` — if it still exists and the
 *      region fits inside it, we're good (no clamp needed).
 *   2. Otherwise look for any display whose bounds overlap the region's
 *      centroid; clamp into that display.
 *   3. If nothing overlaps, the region is stale — return null.
 */
export function reconcileRegion(
  region: StoredRegion,
  displays: DisplayLike[],
): SelectionRect | null {
  if (displays.length === 0) return null;

  if (region.displayId != null) {
    const exact = displays.find((d) => d.id === region.displayId);
    if (exact) {
      const clamped = clampToDisplay(region, exact);
      if (clamped && isRectMeaningful(clamped)) return clamped;
    }
  }

  const cx = region.x + region.width / 2;
  const cy = region.y + region.height / 2;
  const containing = displays.find(
    (d) =>
      cx >= d.bounds.x &&
      cx < d.bounds.x + d.bounds.width &&
      cy >= d.bounds.y &&
      cy < d.bounds.y + d.bounds.height,
  );
  if (!containing) return null;
  const clamped = clampToDisplay(region, containing);
  return clamped && isRectMeaningful(clamped) ? clamped : null;
}
