import { KeyRecorder } from './KeyRecorder';
import { Row, Section } from './SettingsLayout';
import { usePreferences } from './usePreferences';

export function ShortcutsSettings() {
  const { prefs, update } = usePreferences();

  if (!prefs) return null;

  const setHotkey = (mode: 'area' | 'window' | 'fullscreen', accel: string) => {
    void update('hotkeys', { ...prefs.hotkeys, [mode]: accel });
  };

  return (
    <div className="space-y-6">
      <Section
        title="Capture shortcuts"
        description="Click a shortcut and press the key combo. Esc to cancel. Conflicts with other apps will fail silently — log shows which."
      >
        <Row
          label="Capture Area"
          control={
            <KeyRecorder
              value={prefs.hotkeys.area}
              onChange={(accel) => setHotkey('area', accel)}
            />
          }
        />
        <Row
          label="Capture Window"
          control={
            <KeyRecorder
              value={prefs.hotkeys.window}
              onChange={(accel) => setHotkey('window', accel)}
            />
          }
        />
        <Row
          label="Capture Full Screen"
          control={
            <KeyRecorder
              value={prefs.hotkeys.fullscreen}
              onChange={(accel) => setHotkey('fullscreen', accel)}
            />
          }
        />
      </Section>
    </div>
  );
}
