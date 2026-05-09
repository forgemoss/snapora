import { Image, Info, Keyboard, Layers, SlidersHorizontal, Video, Wallpaper } from 'lucide-react';
import { useState } from 'react';
import { WindowChrome, WindowShell } from './Layout';
import { cn } from '@renderer/lib/cn';
import { AboutSettings } from './settings/About';
import { GeneralSettings } from './settings/General';
import { QuickAccessSettings } from './settings/QuickAccess';
import { ShortcutsSettings } from './settings/Shortcuts';
import { StubSection } from './settings/Stub';
import { WallpaperSettings } from './settings/Wallpaper';

type SectionKey =
  | 'general'
  | 'shortcuts'
  | 'quickAccess'
  | 'screenshot'
  | 'recording'
  | 'wallpaper'
  | 'about';

interface NavItem {
  key: SectionKey;
  label: string;
  icon: React.ReactNode;
  /** When set, the panel is a placeholder for that milestone. */
  milestone?: string;
}

const NAV: NavItem[] = [
  { key: 'general', label: 'General', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { key: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="h-4 w-4" /> },
  { key: 'quickAccess', label: 'Quick Access', icon: <Layers className="h-4 w-4" /> },
  {
    key: 'screenshot',
    label: 'Screenshot',
    icon: <Image className="h-4 w-4" />,
    milestone: 'v0.2',
  },
  { key: 'recording', label: 'Recording', icon: <Video className="h-4 w-4" />, milestone: 'v0.4' },
  {
    key: 'wallpaper',
    label: 'Wallpaper',
    icon: <Wallpaper className="h-4 w-4" />,
  },
  { key: 'about', label: 'About', icon: <Info className="h-4 w-4" /> },
];

export function Settings() {
  const [active, setActive] = useState<SectionKey>('general');
  const activeItem = NAV.find((n) => n.key === active);

  return (
    <WindowShell>
      <WindowChrome title="Settings" />
      <div className="flex flex-1 overflow-hidden">
        <nav className="w-44 shrink-0 border-r border-white/5 bg-white/[0.015] p-2">
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition',
                active === item.key
                  ? 'bg-white/10 text-white/95'
                  : 'text-white/65 hover:bg-white/5 hover:text-white/90',
              )}
            >
              <span className="text-white/70">{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {item.milestone ? (
                <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/40">
                  {item.milestone}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <main className="flex-1 overflow-y-auto p-6">
          {active === 'general' && <GeneralSettings />}
          {active === 'shortcuts' && <ShortcutsSettings />}
          {active === 'quickAccess' && <QuickAccessSettings />}
          {active === 'wallpaper' && <WallpaperSettings />}
          {active === 'about' && <AboutSettings />}
          {activeItem?.milestone && (active === 'screenshot' || active === 'recording') && (
            <StubSection title={activeItem.label} milestone={activeItem.milestone} />
          )}
        </main>
      </div>
    </WindowShell>
  );
}
