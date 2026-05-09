import { FolderOpen, ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Row, Section } from './SettingsLayout';
import { usePreferences } from './usePreferences';
import type { AppPreferences } from '@shared/types';

const WALLPAPER_OPTIONS: { value: AppPreferences['wallpaperMode']; label: string }[] = [
  { value: 'system', label: 'No background (raw window)' },
  { value: 'customImage', label: 'Custom image' },
  { value: 'customColor', label: 'Solid color' },
];

const PADDING_MIN = 0;
const PADDING_MAX = 200;

function basename(p: string | null): string {
  if (!p) return '';
  const i = p.lastIndexOf('/');
  return i === -1 ? p : p.slice(i + 1);
}

export function WallpaperSettings() {
  const { prefs, update } = usePreferences();

  if (!prefs) return null;

  const pickImage = async () => {
    const path = await window.snapora.wallpaper.chooseImage();
    if (path) await update('customWallpaperImagePath', path);
  };

  const clearImage = () => void update('customWallpaperImagePath', null);

  const showsBackground = prefs.wallpaperMode !== 'system';

  return (
    <div className="space-y-6">
      <Section
        title="Window-mode background"
        description="When you capture a window, Snapora composites it onto this background — like CleanShot's wallpaper feature. Area and full-screen captures are unaffected."
      >
        <Row
          label="Background"
          control={
            <Select<AppPreferences['wallpaperMode']>
              value={prefs.wallpaperMode}
              onChange={(v) => void update('wallpaperMode', v)}
              options={WALLPAPER_OPTIONS}
            />
          }
        />
        {showsBackground ? (
          <Row
            label="Padding around the window"
            description={`${prefs.windowBackgroundPaddingPx} px of background visible on each side.`}
            control={
              <input
                type="range"
                min={PADDING_MIN}
                max={PADDING_MAX}
                value={prefs.windowBackgroundPaddingPx}
                onChange={(e) => void update('windowBackgroundPaddingPx', Number(e.target.value))}
                className="w-40 accent-amber-400"
              />
            }
          />
        ) : null}
      </Section>

      {prefs.wallpaperMode === 'customImage' ? (
        <Section title="Custom image">
          <Row
            label="Image"
            description={
              prefs.customWallpaperImagePath
                ? basename(prefs.customWallpaperImagePath)
                : 'No image chosen — captures will fall back to the raw window.'
            }
            control={
              <div className="flex items-center gap-2">
                {prefs.customWallpaperImagePath ? (
                  <Button variant="ghost" size="sm" onClick={clearImage}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" onClick={pickImage}>
                  <FolderOpen className="h-3.5 w-3.5" />
                  Choose…
                </Button>
              </div>
            }
          />
          <Row
            label="Preview"
            description="Cropped to fit the canvas around the window."
            control={
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.04]">
                {prefs.customWallpaperImagePath ? (
                  <img
                    src={`file://${prefs.customWallpaperImagePath}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-white/30" />
                )}
              </div>
            }
          />
        </Section>
      ) : null}

      {prefs.wallpaperMode === 'customColor' ? (
        <Section title="Solid color">
          <Row
            label="Color"
            description="The whole canvas around the window is filled with this color."
            control={
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={prefs.customWallpaperColor}
                  onChange={(e) => void update('customWallpaperColor', e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                />
                <input
                  type="text"
                  value={prefs.customWallpaperColor}
                  onChange={(e) => void update('customWallpaperColor', e.target.value)}
                  spellCheck={false}
                  className="h-8 w-24 rounded-md border border-white/10 bg-white/[0.04] px-2 font-mono text-sm text-white/95 outline-none focus:border-amber-400/50"
                />
              </div>
            }
          />
        </Section>
      ) : null}
    </div>
  );
}
