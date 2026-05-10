import { useEffect, useState } from 'react';
import { Select } from '../ui/select';
import { Switch } from '../ui/switch';
import { Row, Section } from './SettingsLayout';
import { usePreferences } from './usePreferences';
import { cn } from '@renderer/lib/cn';
import type { AppPreferences } from '@shared/types';

type Tab = 'general' | 'video' | 'gif';

const FRAMERATE_OPTS: { value: '24' | '30' | '60'; label: string }[] = [
  { value: '24', label: '24 fps' },
  { value: '30', label: '30 fps' },
  { value: '60', label: '60 fps' },
];

const QUALITY_OPTS: { value: AppPreferences['recordingQuality']; label: string }[] = [
  { value: 'standard', label: 'Standard (4 Mbps)' },
  { value: 'high', label: 'High (8 Mbps)' },
  { value: 'best', label: 'Best (16 Mbps)' },
];

const MODE_OPTS: { value: AppPreferences['recordingDefaultMode']; label: string }[] = [
  { value: 'region', label: 'Region' },
  { value: 'display', label: 'Display' },
  { value: 'window', label: 'Window' },
];

const COUNTDOWN_OPTS: { value: '0' | '3' | '5' | '10'; label: string }[] = [
  { value: '0', label: 'Off' },
  { value: '3', label: '3 seconds' },
  { value: '5', label: '5 seconds' },
  { value: '10', label: '10 seconds' },
];

const POSITION_OPTS: { value: AppPreferences['recordingWebcamPosition']; label: string }[] = [
  { value: 'top-left', label: 'Top-left' },
  { value: 'top-right', label: 'Top-right' },
  { value: 'bottom-left', label: 'Bottom-left' },
  { value: 'bottom-right', label: 'Bottom-right' },
];

const SIZE_OPTS: { value: 'small' | 'medium' | 'large'; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const SHAPE_OPTS: { value: AppPreferences['recordingWebcamShape']; label: string }[] = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
];

const CLICK_STYLE_OPTS: { value: AppPreferences['recordingClickStyle']; label: string }[] = [
  { value: 'outline', label: 'Outline' },
  { value: 'filled', label: 'Filled' },
];

const KEY_POSITION_OPTS: { value: AppPreferences['recordingKeyPosition']; label: string }[] = [
  { value: 'top-left', label: 'Top-left' },
  { value: 'top-center', label: 'Top-center' },
  { value: 'top-right', label: 'Top-right' },
  { value: 'bottom-left', label: 'Bottom-left' },
  { value: 'bottom-center', label: 'Bottom-center' },
  { value: 'bottom-right', label: 'Bottom-right' },
];

const KEY_STYLE_OPTS: { value: AppPreferences['recordingKeyStyle']; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
];

const MAX_RES_OPTS: { value: '0' | '720' | '1080' | '1440' | '2160'; label: string }[] = [
  { value: '0', label: 'Original' },
  { value: '720', label: '720p' },
  { value: '1080', label: '1080p' },
  { value: '1440', label: '1440p' },
  { value: '2160', label: '4K (2160p)' },
];

const GIF_FPS_OPTS: { value: '10' | '15' | '24' | '30'; label: string }[] = [
  { value: '10', label: '10 fps' },
  { value: '15', label: '15 fps' },
  { value: '24', label: '24 fps' },
  { value: '30', label: '30 fps' },
];

const GIF_WIDTH_OPTS: { value: '0' | '480' | '640' | '800' | '1280'; label: string }[] = [
  { value: '0', label: 'Original' },
  { value: '480', label: '480 px' },
  { value: '640', label: '640 px' },
  { value: '800', label: '800 px (default)' },
  { value: '1280', label: '1280 px' },
];

export function RecordingSettings() {
  const { prefs, update } = usePreferences();
  const [tab, setTab] = useState<Tab>('general');
  const [devices, setDevices] = useState<{ cameras: string[]; mics: string[] }>({
    cameras: [],
    mics: [],
  });

  useEffect(() => {
    void window.snapora.recording.listDevices().then(setDevices);
  }, []);

  if (!prefs) return null;

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg bg-white/[0.06] p-0.5 ring-1 ring-white/5">
          {(['general', 'video', 'gif'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md px-4 py-1 text-sm transition',
                tab === t
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-white/70 hover:bg-white/5 hover:text-white/95',
              )}
            >
              {t === 'general' ? 'General' : t === 'video' ? 'Video' : 'GIF'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'general' ? (
        <>
          <Section title="Capture">
            <Row
              label="Default mode"
              description="What clicking Record Screen starts with."
              control={
                <Select<AppPreferences['recordingDefaultMode']>
                  value={prefs.recordingDefaultMode}
                  onChange={(v) => void update('recordingDefaultMode', v)}
                  options={MODE_OPTS}
                />
              }
            />
            <Row
              label="Show controls while recording"
              description="The floating Stop/Pause/Restart bar."
              control={
                <Switch
                  checked={prefs.recordingShowControls}
                  onCheckedChange={(v) => void update('recordingShowControls', v)}
                />
              }
            />
            <Row
              label="Show countdown"
              control={
                <Select<'0' | '3' | '5' | '10'>
                  value={String(prefs.recordingCountdownSeconds) as '0' | '3' | '5' | '10'}
                  onChange={(v) =>
                    void update('recordingCountdownSeconds', Number(v) as 0 | 3 | 5 | 10)
                  }
                  options={COUNTDOWN_OPTS}
                />
              }
            />
            <Row
              label="Dim screen while recording"
              control={
                <Switch
                  checked={prefs.recordingDimScreen}
                  onCheckedChange={(v) => void update('recordingDimScreen', v)}
                />
              }
            />
            <Row
              label="Remember last selection"
              description="Skip the region picker next time and reuse the last rect."
              control={
                <Switch
                  checked={prefs.recordingRememberLastSelection}
                  onCheckedChange={(v) => void update('recordingRememberLastSelection', v)}
                />
              }
            />
            <Row
              label='"Do Not Disturb" while recording'
              description="Toggles macOS DnD via the Shortcuts CLI."
              control={
                <Switch
                  checked={prefs.recordingHideNotifications}
                  onCheckedChange={(v) => void update('recordingHideNotifications', v)}
                />
              }
            />
          </Section>

          <Section title="Cursor & input">
            <Row
              label="Show cursor"
              control={
                <Switch
                  checked={prefs.recordingShowCursor}
                  onCheckedChange={(v) => void update('recordingShowCursor', v)}
                />
              }
            />
            <Row
              label="Highlight mouse clicks"
              control={
                <Switch
                  checked={prefs.recordingCaptureClicks}
                  onCheckedChange={(v) => void update('recordingCaptureClicks', v)}
                />
              }
            />
            {prefs.recordingCaptureClicks ? (
              <>
                <Row
                  label="Click color"
                  control={
                    <input
                      type="color"
                      value={prefs.recordingClickColor}
                      onChange={(e) => void update('recordingClickColor', e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                    />
                  }
                />
                <Row
                  label="Click size"
                  control={
                    <Select<'small' | 'medium' | 'large'>
                      value={prefs.recordingClickSize}
                      onChange={(v) => void update('recordingClickSize', v)}
                      options={SIZE_OPTS}
                    />
                  }
                />
                <Row
                  label="Click style"
                  control={
                    <Select<AppPreferences['recordingClickStyle']>
                      value={prefs.recordingClickStyle}
                      onChange={(v) => void update('recordingClickStyle', v)}
                      options={CLICK_STYLE_OPTS}
                    />
                  }
                />
                <Row
                  label="Animate"
                  control={
                    <Switch
                      checked={prefs.recordingClickAnimated}
                      onCheckedChange={(v) => void update('recordingClickAnimated', v)}
                    />
                  }
                />
              </>
            ) : null}
            <Row
              label="Show keystrokes"
              control={
                <Switch
                  checked={prefs.recordingCaptureKeystrokes}
                  onCheckedChange={(v) => void update('recordingCaptureKeystrokes', v)}
                />
              }
            />
            {prefs.recordingCaptureKeystrokes ? (
              <>
                <Row
                  label="Keystroke position"
                  control={
                    <Select<AppPreferences['recordingKeyPosition']>
                      value={prefs.recordingKeyPosition}
                      onChange={(v) => void update('recordingKeyPosition', v)}
                      options={KEY_POSITION_OPTS}
                    />
                  }
                />
                <Row
                  label="Keystroke size"
                  control={
                    <Select<'small' | 'medium' | 'large'>
                      value={prefs.recordingKeySize}
                      onChange={(v) => void update('recordingKeySize', v)}
                      options={SIZE_OPTS}
                    />
                  }
                />
                <Row
                  label="Keystroke style"
                  control={
                    <Select<AppPreferences['recordingKeyStyle']>
                      value={prefs.recordingKeyStyle}
                      onChange={(v) => void update('recordingKeyStyle', v)}
                      options={KEY_STYLE_OPTS}
                    />
                  }
                />
                <Row
                  label="Show all keys"
                  description="When off, only show the pill while a modifier (⌘/⌥/⌃) is held."
                  control={
                    <Switch
                      checked={!prefs.recordingKeyOnlyCommandKeys}
                      onCheckedChange={(v) => void update('recordingKeyOnlyCommandKeys', !v)}
                    />
                  }
                />
              </>
            ) : null}
          </Section>

          <Section title="Webcam">
            <Row
              label="Show webcam during recording"
              control={
                <Switch
                  checked={prefs.recordingWebcamEnabled}
                  onCheckedChange={(v) => void update('recordingWebcamEnabled', v)}
                />
              }
            />
            {prefs.recordingWebcamEnabled ? (
              <>
                <Row
                  label="Camera"
                  control={
                    <Select<string>
                      value={prefs.recordingWebcamDevice || (devices.cameras[0] ?? '')}
                      onChange={(v) => void update('recordingWebcamDevice', v)}
                      options={(devices.cameras.length > 0 ? devices.cameras : ['(none)']).map(
                        (c) => ({ value: c, label: c }),
                      )}
                    />
                  }
                />
                <Row
                  label="Position"
                  control={
                    <Select<AppPreferences['recordingWebcamPosition']>
                      value={prefs.recordingWebcamPosition}
                      onChange={(v) => void update('recordingWebcamPosition', v)}
                      options={POSITION_OPTS}
                    />
                  }
                />
                <Row
                  label="Size"
                  control={
                    <Select<'small' | 'medium' | 'large'>
                      value={prefs.recordingWebcamSize}
                      onChange={(v) => void update('recordingWebcamSize', v)}
                      options={SIZE_OPTS}
                    />
                  }
                />
                <Row
                  label="Shape"
                  control={
                    <Select<AppPreferences['recordingWebcamShape']>
                      value={prefs.recordingWebcamShape}
                      onChange={(v) => void update('recordingWebcamShape', v)}
                      options={SHAPE_OPTS}
                    />
                  }
                />
                <Row
                  label="Mirror"
                  control={
                    <Switch
                      checked={prefs.recordingWebcamMirrored}
                      onCheckedChange={(v) => void update('recordingWebcamMirrored', v)}
                    />
                  }
                />
                <Row
                  label="Fullscreen mode"
                  description="Webcam fills the entire recording (talking-head style)."
                  control={
                    <Switch
                      checked={prefs.recordingWebcamFullscreen}
                      onCheckedChange={(v) => void update('recordingWebcamFullscreen', v)}
                    />
                  }
                />
              </>
            ) : null}
          </Section>
        </>
      ) : null}

      {tab === 'video' ? (
        <>
          <Section title="Quality">
            <Row
              label="Max resolution"
              description="Cap the longest edge in pixels — smaller files."
              control={
                <Select<'0' | '720' | '1080' | '1440' | '2160'>
                  value={
                    String(prefs.recordingMaxResolution ?? 0) as
                      | '0'
                      | '720'
                      | '1080'
                      | '1440'
                      | '2160'
                  }
                  onChange={(v) => {
                    const n = Number(v);
                    void update(
                      'recordingMaxResolution',
                      n === 0 ? null : (n as 720 | 1080 | 1440 | 2160),
                    );
                  }}
                  options={MAX_RES_OPTS}
                />
              }
            />
            <Row
              label="Frame rate"
              control={
                <Select<'24' | '30' | '60'>
                  value={String(prefs.recordingFramerate) as '24' | '30' | '60'}
                  onChange={(v) => void update('recordingFramerate', Number(v) as 24 | 30 | 60)}
                  options={FRAMERATE_OPTS}
                />
              }
            />
            <Row
              label="Quality"
              control={
                <Select<AppPreferences['recordingQuality']>
                  value={prefs.recordingQuality}
                  onChange={(v) => void update('recordingQuality', v)}
                  options={QUALITY_OPTS}
                />
              }
            />
          </Section>

          <Section title="Audio">
            <Row
              label="Capture microphone"
              control={
                <Switch
                  checked={prefs.recordingMicrophone}
                  onCheckedChange={(v) => void update('recordingMicrophone', v)}
                />
              }
            />
            {prefs.recordingMicrophone ? (
              <Row
                label="Microphone device"
                control={
                  <Select<string>
                    value={prefs.recordingMicrophoneDevice || (devices.mics[0] ?? '')}
                    onChange={(v) => void update('recordingMicrophoneDevice', v)}
                    options={(devices.mics.length > 0 ? devices.mics : ['(none)']).map((m) => ({
                      value: m,
                      label: m,
                    }))}
                  />
                }
              />
            ) : null}
            <Row
              label="Record audio in mono"
              description="Smaller file size, fine for narration."
              control={
                <Switch
                  checked={prefs.recordingAudioMono}
                  onCheckedChange={(v) => void update('recordingAudioMono', v)}
                />
              }
            />
            <Row
              label="System audio"
              description="Coming via the BlackHole virtual audio device — install separately."
              control={<Switch checked={false} onCheckedChange={() => {}} disabled />}
            />
          </Section>

          <Section title="Workflow">
            <Row
              label="Open Video Editor after recording"
              description="Auto-open the editor on stop so you can trim or export immediately."
              control={
                <Switch
                  checked={prefs.recordingOpenEditorAfter}
                  onCheckedChange={(v) => void update('recordingOpenEditorAfter', v)}
                />
              }
            />
          </Section>
        </>
      ) : null}

      {tab === 'gif' ? (
        <Section title="GIF">
          <Row
            label="GIF FPS"
            control={
              <Select<'10' | '15' | '24' | '30'>
                value={String(prefs.recordingGifFps) as '10' | '15' | '24' | '30'}
                onChange={(v) => void update('recordingGifFps', Number(v) as 10 | 15 | 24 | 30)}
                options={GIF_FPS_OPTS}
              />
            }
          />
          <Row
            label="GIF quality"
            description="Higher = sharper but bigger files."
            control={
              <input
                type="range"
                min={1}
                max={5}
                value={prefs.recordingGifQuality}
                onChange={(e) =>
                  void update('recordingGifQuality', Number(e.target.value) as 1 | 2 | 3 | 4 | 5)
                }
                className="w-32 accent-amber-400"
              />
            }
          />
          <Row
            label="GIF max width"
            description="Cap the longest edge — smaller files."
            control={
              <Select<'0' | '480' | '640' | '800' | '1280'>
                value={
                  String(prefs.recordingGifMaxWidth ?? 0) as '0' | '480' | '640' | '800' | '1280'
                }
                onChange={(v) => {
                  const n = Number(v);
                  void update(
                    'recordingGifMaxWidth',
                    n === 0 ? null : (n as 480 | 640 | 800 | 1280),
                  );
                }}
                options={GIF_WIDTH_OPTS}
              />
            }
          />
        </Section>
      ) : null}
    </div>
  );
}
