import { Construction } from 'lucide-react';

export function StubSection({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center">
      <Construction className="mb-3 h-8 w-8 text-white/30" />
      <h3 className="text-sm font-semibold text-white/80">
        {title} — coming in {milestone}
      </h3>
      <p className="mt-1 max-w-md text-xs text-white/45">
        This panel is reserved. The roadmap targets it in {milestone}; tracked in{' '}
        <span className="font-mono">ROADMAP.md</span>.
      </p>
    </div>
  );
}
