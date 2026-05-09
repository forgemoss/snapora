import { Settings as SettingsIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { WindowChrome, WindowShell } from './Layout';

/**
 * Settings window placeholder. Real wiring lands in feat/settings (next milestone after first-run).
 */
export function Settings() {
  return (
    <WindowShell>
      <WindowChrome title="Settings" />
      <main className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Card>
            <CardHeader>
              <SettingsIcon className="mt-0.5 h-5 w-5 text-white/50" />
              <div>
                <CardTitle>Settings — coming in v0.1</CardTitle>
                <CardDescription>
                  Hotkeys, save folder, default format, and capture behavior live here once the
                  first-run flow lands.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-white/40">See ROADMAP.md → v0.1 for the build order.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </WindowShell>
  );
}
