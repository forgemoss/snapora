import { FolderOpen } from 'lucide-react';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Switch } from '../ui/switch';
import { Row, Section } from './SettingsLayout';
import { usePreferences } from './usePreferences';

export function GeneralSettings() {
  const { prefs, update } = usePreferences();

  if (!prefs) return null;

  const pickFolder = async () => {
    const path = await window.snapora.preferences.chooseSaveDirectory();
    if (path) await update('saveDirectory', path);
  };

  return (
    <div className="space-y-6">
      <Section title="Startup">
        <Row
          label="Launch at login"
          description="Open Snapora automatically when you sign in to your Mac."
          control={
            <Switch
              checked={prefs.launchAtLogin}
              onCheckedChange={(v) => void update('launchAtLogin', v)}
            />
          }
        />
        <Row
          label="Hide Dock icon (menu-bar only)"
          description="Snapora lives in the menu bar. Disable to also show a Dock icon."
          control={
            <Switch
              checked={prefs.menuBarOnly}
              onCheckedChange={(v) => void update('menuBarOnly', v)}
            />
          }
        />
      </Section>

      <Section title="Capture">
        <Row
          label="Play shutter sound on capture"
          control={
            <Switch
              checked={prefs.soundOnCapture}
              onCheckedChange={(v) => void update('soundOnCapture', v)}
            />
          }
        />
        <Row
          label="Copy to clipboard automatically"
          control={
            <Switch
              checked={prefs.autoCopyToClipboard}
              onCheckedChange={(v) => void update('autoCopyToClipboard', v)}
            />
          }
        />
        <Row
          label="Hide desktop icons during full-screen capture"
          description="Coming in v0.2 — slider lives here once implemented."
          control={
            <Switch
              checked={prefs.hideDesktopIcons}
              onCheckedChange={(v) => void update('hideDesktopIcons', v)}
              disabled
            />
          }
        />
      </Section>

      <Section title="Files">
        <Row
          label="Default file format"
          control={
            <Select
              value={prefs.defaultFormat}
              onChange={(v) => void update('defaultFormat', v)}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
              ]}
            />
          }
        />
        <Row
          label="Save folder"
          description={prefs.saveDirectory || '~/Pictures/Snapora'}
          control={
            <Button variant="secondary" size="sm" onClick={pickFolder}>
              <FolderOpen className="h-3.5 w-3.5" />
              Choose…
            </Button>
          }
        />
      </Section>
    </div>
  );
}
