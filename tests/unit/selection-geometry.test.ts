import { describe, expect, it } from 'vitest';
import {
  clampToDisplay,
  isRectMeaningful,
  localToGlobalDips,
  rectFromDrag,
  reconcileRegion,
  type DisplayLike,
} from '@main/selection/geometry';

const primary: DisplayLike = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1440, height: 900 },
  scaleFactor: 2,
};

const secondaryRight: DisplayLike = {
  id: 2,
  bounds: { x: 1440, y: 0, width: 1920, height: 1080 },
  scaleFactor: 1,
};

const secondaryAbove: DisplayLike = {
  id: 3,
  bounds: { x: 0, y: -1080, width: 1920, height: 1080 },
  scaleFactor: 1,
};

describe('rectFromDrag', () => {
  it('normalizes a left-to-right + top-to-bottom drag', () => {
    expect(rectFromDrag({ x: 10, y: 20 }, { x: 50, y: 80 })).toEqual({
      x: 10,
      y: 20,
      width: 40,
      height: 60,
    });
  });

  it('normalizes a right-to-left + bottom-to-top drag', () => {
    expect(rectFromDrag({ x: 100, y: 100 }, { x: 30, y: 40 })).toEqual({
      x: 30,
      y: 40,
      width: 70,
      height: 60,
    });
  });
});

describe('isRectMeaningful', () => {
  it('rejects zero-size rects', () => {
    expect(isRectMeaningful({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
  });

  it('rejects rects below the 4 DIP threshold', () => {
    expect(isRectMeaningful({ x: 0, y: 0, width: 3, height: 100 })).toBe(false);
  });

  it('accepts rects at or above the threshold', () => {
    expect(isRectMeaningful({ x: 0, y: 0, width: 4, height: 4 })).toBe(true);
  });
});

describe('localToGlobalDips', () => {
  it('passes through on the primary display (origin 0,0)', () => {
    const local = { x: 100, y: 50, width: 200, height: 150 };
    expect(localToGlobalDips(local, primary)).toEqual(local);
  });

  it('shifts by display.bounds.x for displays to the right', () => {
    const local = { x: 100, y: 50, width: 200, height: 150 };
    expect(localToGlobalDips(local, secondaryRight)).toEqual({
      x: 1540,
      y: 50,
      width: 200,
      height: 150,
    });
  });

  it('uses negative y for displays above the primary', () => {
    const local = { x: 0, y: 0, width: 100, height: 100 };
    expect(localToGlobalDips(local, secondaryAbove)).toEqual({
      x: 0,
      y: -1080,
      width: 100,
      height: 100,
    });
  });

  it('does not multiply by scaleFactor (Retina is handled by screencapture)', () => {
    const local = { x: 100, y: 100, width: 200, height: 200 };
    const result = localToGlobalDips(local, primary);
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });
});

describe('clampToDisplay', () => {
  it('returns the rect unchanged when fully inside the display', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 };
    expect(clampToDisplay(rect, primary)).toEqual(rect);
  });

  it('clamps a rect that overflows the right edge', () => {
    const rect = { x: 1300, y: 100, width: 500, height: 200 };
    expect(clampToDisplay(rect, primary)).toEqual({
      x: 1300,
      y: 100,
      width: 140,
      height: 200,
    });
  });

  it('returns null when the rect is fully outside the display', () => {
    const rect = { x: 5000, y: 5000, width: 100, height: 100 };
    expect(clampToDisplay(rect, primary)).toBeNull();
  });
});

describe('reconcileRegion', () => {
  it('returns null when there are no displays', () => {
    expect(reconcileRegion({ x: 0, y: 0, width: 100, height: 100 }, [])).toBeNull();
  });

  it('uses the original displayId when it still exists and the rect fits', () => {
    const region = { x: 100, y: 100, width: 200, height: 200, displayId: 1 };
    expect(reconcileRegion(region, [primary, secondaryRight])).toEqual({
      x: 100,
      y: 100,
      width: 200,
      height: 200,
    });
  });

  it('falls back to centroid containment when the original display is gone', () => {
    const region = { x: 1500, y: 200, width: 100, height: 100, displayId: 99 };
    // Centroid (1550, 250) is inside secondaryRight.
    expect(reconcileRegion(region, [primary, secondaryRight])).toEqual({
      x: 1500,
      y: 200,
      width: 100,
      height: 100,
    });
  });

  it('returns null when no display contains the centroid', () => {
    const region = { x: 5000, y: 5000, width: 100, height: 100 };
    expect(reconcileRegion(region, [primary])).toBeNull();
  });

  it('clamps a region whose original display shrank around it', () => {
    const region = { x: 1200, y: 100, width: 500, height: 200, displayId: 1 };
    expect(reconcileRegion(region, [primary])).toEqual({
      x: 1200,
      y: 100,
      width: 240,
      height: 200,
    });
  });
});
