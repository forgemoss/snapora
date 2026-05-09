import { ShieldCheck } from 'lucide-react';
import { WindowShell } from './Layout';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

/**
 * First-run permission wizard placeholder. The real flow (Screen Recording, Mic, Camera
 * permission cards with status polling and System Settings deeplinks) lands in
 * feat/first-run-wizard — see ROADMAP.md → v0.1.
 */
export function FirstRun() {
  return (
    <WindowShell>
      <main className="flex flex-1 items-center justify-center p-12">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-amber-500/10 p-3 ring-1 ring-amber-500/30">
              <ShieldCheck className="h-7 w-7 text-amber-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white/95">Welcome to Snapora</h1>
            <p className="text-sm text-white/60">
              Snapora needs Screen Recording permission to capture your display. We&rsquo;ll guide
              you through it.
            </p>
          </div>
          <Card className="text-left">
            <CardHeader>
              <div className="flex-1">
                <CardTitle>First-run wizard — coming in v0.1</CardTitle>
                <CardDescription>
                  Permission cards, System Settings deeplinks, and the &ldquo;quit and
                  relaunch&rdquo; prompt land in the next PR.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="primary" disabled className="w-full">
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </WindowShell>
  );
}
