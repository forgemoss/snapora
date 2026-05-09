import { Select } from '../ui/select';
import { Switch } from '../ui/switch';
import { Row, Section } from './SettingsLayout';
import { usePreferences } from './usePreferences';
import type { AppPreferences } from '@shared/types';

const POSITION_OPTIONS: { value: AppPreferences['hudPosition']; label: string }[] = [
  { value: 'top-left', label: 'Top-left' },
  { value: 'top-right', label: 'Top-right' },
  { value: 'bottom-left', label: 'Bottom-left' },
  { value: 'bottom-right', label: 'Bottom-right' },
];

const SIZE_OPTIONS: { value: AppPreferences['hudSize']; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const AUTO_CLOSE_OPTIONS: {
  value: '3' | '6' | '10' | '30';
  label: string;
}[] = [
  { value: '3', label: '3 seconds' },
  { value: '6', label: '6 seconds' },
  { value: '10', label: '10 seconds' },
  { value: '30', label: '30 seconds' },
];

export function QuickAccessSettings() {
  const { prefs, update } = usePreferences();

  if (!prefs) return null;

  return (
    <div className="space-y-6">
      <Section title="Position & size">
        <Row
          label="Position on screen"
          description="Where the post-capture HUD appears."
          control={
            <Select<AppPreferences['hudPosition']>
              value={prefs.hudPosition}
              onChange={(v) => void update('hudPosition', v)}
              options={POSITION_OPTIONS}
            />
          }
        />
        <Row
          label="Multi-display"
          description="Move the HUD to whichever display your cursor is on. Off = always show on the primary display."
          control={
            <Switch
              checked={prefs.hudFollowActiveScreen}
              onCheckedChange={(v) => void update('hudFollowActiveScreen', v)}
            />
          }
        />
        <Row
          label="Overlay size"
          control={
            <Select<AppPreferences['hudSize']>
              value={prefs.hudSize}
              onChange={(v) => void update('hudSize', v)}
              options={SIZE_OPTIONS}
            />
          }
        />
      </Section>

      <Section title="Auto-close">
        <Row
          label="Auto-close after a delay"
          description="Hide the HUD automatically when you don't interact with it. Hovering pauses the timer."
          control={
            <Switch
              checked={prefs.hudAutoCloseEnabled}
              onCheckedChange={(v) => void update('hudAutoCloseEnabled', v)}
            />
          }
        />
        {prefs.hudAutoCloseEnabled ? (
          <Row
            label="Interval"
            control={
              <Select<'3' | '6' | '10' | '30'>
                value={String(prefs.hudAutoCloseSeconds) as '3' | '6' | '10' | '30'}
                onChange={(v) => void update('hudAutoCloseSeconds', Number(v) as 3 | 6 | 10 | 30)}
                options={AUTO_CLOSE_OPTIONS}
              />
            }
          />
        ) : null}
      </Section>
    </div>
  );
}
