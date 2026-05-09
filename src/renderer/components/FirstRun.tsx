import { Camera, Check, ChevronRight, ExternalLink, Mic, Monitor, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@renderer/lib/cn';
import type { Permission, PermissionStatus } from '@shared/types';
import { WindowChrome, WindowShell } from './Layout';
import { Button } from './ui/button';

type Step = 'welcome' | 'permissions' | 'relaunch' | 'done';

const PERMISSION_INFO: Record<
  Permission,
  { title: string; description: string; required: boolean; icon: React.ReactNode }
> = {
  'screen-recording': {
    title: 'Screen Recording',
    description:
      'Required for any screenshot or recording. macOS won’t let Snapora work without it.',
    required: true,
    icon: <Monitor className="h-5 w-5" />,
  },
  microphone: {
    title: 'Microphone',
    description: 'Optional — only needed if you record narration with your screen.',
    required: false,
    icon: <Mic className="h-5 w-5" />,
  },
  camera: {
    title: 'Camera',
    description: 'Optional — only needed for the webcam overlay during screen recording.',
    required: false,
    icon: <Camera className="h-5 w-5" />,
  },
  accessibility: {
    title: 'Accessibility',
    description: '',
    required: false,
    icon: <Monitor className="h-5 w-5" />,
  },
};

const SHOWN_PERMISSIONS: Permission[] = ['screen-recording', 'microphone', 'camera'];

export function FirstRun() {
  const [step, setStep] = useState<Step>('welcome');
  const [permissions, setPermissions] = useState<Record<Permission, PermissionStatus>>({
    'screen-recording': 'not-determined',
    microphone: 'not-determined',
    camera: 'not-determined',
    accessibility: 'not-determined',
  });

  const refreshPermissions = useCallback(async () => {
    const list = await window.snapora.permissions.list();
    const next: Record<Permission, PermissionStatus> = {
      'screen-recording': 'not-determined',
      microphone: 'not-determined',
      camera: 'not-determined',
      accessibility: 'not-determined',
    };
    for (const p of list) next[p.permission] = p.status;
    setPermissions(next);
  }, []);

  // Poll every second while on the permissions step so toggling System
  // Settings updates the cards in near-real-time.
  useEffect(() => {
    if (step !== 'permissions') return;
    void refreshPermissions();
    const id = setInterval(() => {
      void refreshPermissions();
    }, 1000);
    return () => clearInterval(id);
  }, [step, refreshPermissions]);

  const screenGranted = permissions['screen-recording'] === 'granted';

  const handleRequest = async (permission: Permission) => {
    const result = await window.snapora.permissions.request(permission);
    setPermissions((prev) => ({ ...prev, [permission]: result.status }));
  };

  const handleOpenSettings = async (permission: Permission) => {
    await window.snapora.permissions.openSystemSettings(permission);
  };

  return (
    <WindowShell>
      <WindowChrome trafficLightOffset />
      <main className="flex-1 overflow-y-auto px-10 pb-10">
        {step === 'welcome' && <WelcomeStep onContinue={() => setStep('permissions')} />}
        {step === 'permissions' && (
          <PermissionsStep
            permissions={permissions}
            onRequest={handleRequest}
            onOpenSettings={handleOpenSettings}
            onContinue={() => setStep(screenGranted ? 'done' : 'relaunch')}
          />
        )}
        {step === 'relaunch' && (
          <RelaunchStep
            onRelaunch={() => void window.snapora.firstRun.relaunch()}
            onSkip={() => setStep('done')}
          />
        )}
        {step === 'done' && <DoneStep onClose={() => void window.snapora.firstRun.markDone()} />}
      </main>
    </WindowShell>
  );
}

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-amber-500/15 ring-1 ring-amber-400/30">
        <span className="text-3xl font-semibold text-amber-300">S</span>
      </div>
      <h1 className="text-2xl font-semibold text-white/95">Welcome to Snapora</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
        A free, open-source screenshot and screen-recording app for macOS. Set up takes about a
        minute — Snapora needs a few macOS permissions to capture your screen.
      </p>
      <div className="mt-8 flex flex-col gap-2">
        <Button variant="primary" size="lg" onClick={onContinue}>
          Get started
          <ChevronRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-white/40">You can change these later in Settings.</p>
      </div>
    </div>
  );
}

function PermissionsStep({
  permissions,
  onRequest,
  onOpenSettings,
  onContinue,
}: {
  permissions: Record<Permission, PermissionStatus>;
  onRequest: (p: Permission) => void;
  onOpenSettings: (p: Permission) => void;
  onContinue: () => void;
}) {
  const screenGranted = permissions['screen-recording'] === 'granted';

  return (
    <div className="space-y-6 pt-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-white/95">Grant permissions</h2>
        <p className="text-sm text-white/60">
          Snapora needs Screen Recording. Microphone and camera are optional and only used when you
          record.
        </p>
      </div>
      <div className="space-y-2.5">
        {SHOWN_PERMISSIONS.map((p) => (
          <PermissionCard
            key={p}
            permission={p}
            status={permissions[p]}
            onRequest={() => onRequest(p)}
            onOpenSettings={() => onOpenSettings(p)}
          />
        ))}
      </div>
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-white/40">
          {screenGranted
            ? 'Screen Recording is granted — you’re ready to go.'
            : 'Screen Recording is required.'}
        </p>
        <Button variant="primary" onClick={onContinue}>
          Continue
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function PermissionCard({
  permission,
  status,
  onRequest,
  onOpenSettings,
}: {
  permission: Permission;
  status: PermissionStatus;
  onRequest: () => void;
  onOpenSettings: () => void;
}) {
  const info = PERMISSION_INFO[permission];
  const granted = status === 'granted';

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-xl border p-4 transition',
        granted ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-white/5 bg-white/[0.025]',
      )}
    >
      <div
        className={cn(
          'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg',
          granted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-white/65',
        )}
      >
        {info.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/95">{info.title}</span>
          {info.required ? (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
              Required
            </span>
          ) : null}
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 text-xs leading-relaxed text-white/55">{info.description}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        {granted ? (
          <Button variant="ghost" size="sm" disabled>
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            Granted
          </Button>
        ) : permission === 'screen-recording' ? (
          <Button variant="primary" size="sm" onClick={onOpenSettings}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open Settings
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onRequest}>
            Allow
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PermissionStatus }) {
  const map: Record<PermissionStatus, { label: string; className: string }> = {
    granted: { label: 'Granted', className: 'bg-emerald-500/15 text-emerald-300' },
    denied: { label: 'Denied', className: 'bg-red-500/15 text-red-300' },
    'not-determined': { label: 'Not asked', className: 'bg-white/5 text-white/55' },
    restricted: { label: 'Restricted', className: 'bg-red-500/15 text-red-300' },
    unknown: { label: 'Unknown', className: 'bg-white/5 text-white/55' },
  };
  const meta = map[status];
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

function RelaunchStep({ onRelaunch, onSkip }: { onRelaunch: () => void; onSkip: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-amber-500/15 ring-1 ring-amber-400/30">
        <RotateCw className="h-7 w-7 text-amber-300" />
      </div>
      <h2 className="text-xl font-semibold text-white/95">Relaunch to apply</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
        macOS only applies new Screen Recording grants after the app restarts. You can quit and
        relaunch now, or do it later — Snapora will start working as soon as you restart it.
      </p>
      <div className="mt-8 flex gap-2">
        <Button variant="ghost" onClick={onSkip}>
          Later
        </Button>
        <Button variant="primary" onClick={onRelaunch}>
          <RotateCw className="h-4 w-4" />
          Quit and relaunch
        </Button>
      </div>
    </div>
  );
}

function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/15 ring-1 ring-emerald-400/30">
        <Check className="h-7 w-7 text-emerald-300" />
      </div>
      <h2 className="text-xl font-semibold text-white/95">You’re all set</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
        Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">⌘⇧2</kbd> from anywhere to
        capture an area. Find more options in the menu bar.
      </p>
      <div className="mt-8">
        <Button variant="primary" size="lg" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
