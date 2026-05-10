import { describe, expect, it } from 'vitest';
import { buildArgs } from '@main/capture/screenshotArgs';
import { DEFAULT_PREFERENCES } from '@shared/types';

describe('capture preferences shape', () => {
  it('has a string accelerator for the area mode hotkey', () => {
    expect(typeof DEFAULT_PREFERENCES.hotkeys.area).toBe('string');
    expect(DEFAULT_PREFERENCES.hotkeys.area.length).toBeGreaterThan(0);
  });

  it('uses CommandOrControl prefix so accelerators work cross-platform', () => {
    for (const accel of Object.values(DEFAULT_PREFERENCES.hotkeys)) {
      expect(accel).toMatch(/^CommandOrControl/);
    }
  });
});

describe('buildArgs without a region', () => {
  it('uses -i for area mode', () => {
    const args = buildArgs('area', 'png', 0, '/tmp/out.png', true);
    expect(args).toContain('-i');
    expect(args).not.toContain('-R');
  });

  it('uses -i -W -o for window mode', () => {
    const args = buildArgs('window', 'png', 0, '/tmp/out.png', true);
    expect(args).toContain('-i');
    expect(args).toContain('-W');
    expect(args).toContain('-o');
  });

  it('adds -T for fullscreen with delay > 0', () => {
    const args = buildArgs('fullscreen', 'png', 5, '/tmp/out.png', true);
    expect(args).toContain('-T');
    expect(args).toContain('5');
  });

  it('omits -x when not silent', () => {
    const args = buildArgs('area', 'png', 0, '/tmp/out.png', false);
    expect(args).not.toContain('-x');
  });
});

describe('buildArgs with a region — the -R-decimal regression', () => {
  it('rounds fractional rect values to integers (decimals make screencapture silently fall back to fullscreen)', () => {
    const args = buildArgs('area', 'png', 0, '/tmp/out.png', true, {
      x: 806.2109375,
      y: 61.35546875,
      width: 486.203125,
      height: 536.04296875,
    });
    const rIndex = args.indexOf('-R');
    expect(rIndex).toBeGreaterThan(-1);
    const rect = args[rIndex + 1];
    expect(rect).toBe('806,61,486,536');
  });

  it('emits -R and skips the interactive flags when a region is set', () => {
    const args = buildArgs('area', 'png', 0, '/tmp/out.png', true, {
      x: 100,
      y: 100,
      width: 400,
      height: 300,
    });
    expect(args).toContain('-R');
    expect(args).toContain('100,100,400,300');
    expect(args).not.toContain('-i');
  });

  it('rounds half-up consistently', () => {
    const args = buildArgs('area', 'png', 0, '/tmp/out.png', true, {
      x: 0.4,
      y: 0.5,
      width: 100.6,
      height: 100.49,
    });
    const rIndex = args.indexOf('-R');
    // Math.round(0.4)=0, Math.round(0.5)=1, Math.round(100.6)=101, Math.round(100.49)=100
    expect(args[rIndex + 1]).toBe('0,1,101,100');
  });
});
