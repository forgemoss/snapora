import { describe, expect, it } from 'vitest';
import { cropFilter, rectToCropPx } from '@main/recording/cropArgs';

const retina = {
  bounds: { x: 0, y: 0, width: 1440, height: 900 },
  scaleFactor: 2,
};
const secondaryRight = {
  bounds: { x: 1440, y: 0, width: 1920, height: 1080 },
  scaleFactor: 1,
};

describe('rectToCropPx', () => {
  it('converts DIP rect → pixel rect on a Retina display', () => {
    expect(rectToCropPx({ x: 100, y: 50, width: 400, height: 300 }, retina)).toEqual({
      x: 200,
      y: 100,
      w: 800,
      h: 600,
    });
  });

  it('subtracts display origin so coords are display-local', () => {
    expect(rectToCropPx({ x: 1500, y: 50, width: 200, height: 100 }, secondaryRight)).toEqual({
      x: 60, // (1500 - 1440) * 1
      y: 50,
      w: 200,
      h: 100,
    });
  });

  it('rounds fractional inputs to integers (ffmpeg crop refuses decimals)', () => {
    expect(rectToCropPx({ x: 100.4, y: 50.5, width: 200.6, height: 100.49 }, retina)).toEqual({
      x: 201,
      y: 101,
      w: 401,
      h: 201,
    });
  });
});

describe('cropFilter', () => {
  it('formats as ffmpeg crop=W:H:X:Y', () => {
    expect(cropFilter({ x: 100, y: 50, w: 400, h: 300 })).toBe('crop=400:300:100:50');
  });
});
