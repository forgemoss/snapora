import { Code2, ExternalLink, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';

export function AboutSettings() {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    void window.snapora.app.version().then(setVersion);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.025] p-5">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/30 text-amber-300">
          <span className="text-base font-semibold">S</span>
        </div>
        <div>
          <div className="text-base font-semibold text-white/95">Snapora</div>
          <div className="text-xs text-white/55">Version {version || '—'} · pre-alpha</div>
          <div className="mt-1 text-xs text-white/55">MIT licensed · part of forgemoss</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant="secondary" asChild className="justify-start">
          <a href="https://github.com/forgemoss/Snapora" target="_blank" rel="noreferrer">
            <Code2 className="h-4 w-4" />
            View on GitHub
            <ExternalLink className="ml-auto h-3 w-3 text-white/40" />
          </a>
        </Button>
        <Button variant="secondary" asChild className="justify-start">
          <a
            href="https://github.com/forgemoss/Snapora/issues/new/choose"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Report an issue
          </a>
        </Button>
        <Button variant="secondary" asChild className="justify-start">
          <a href="https://forgemoss.com" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            forgemoss.com
          </a>
        </Button>
        <Button variant="primary" asChild className="justify-start">
          <a href="https://github.com/sponsors/forgemoss" target="_blank" rel="noreferrer">
            <Heart className="h-4 w-4" />
            Support the project
          </a>
        </Button>
      </div>

      <p className="text-xs text-white/40 leading-relaxed">
        Snapora is a community-built, open-source alternative to commercial screenshot tools. No
        telemetry, no account required, no subscription. Bring your own cloud.
      </p>
    </div>
  );
}
