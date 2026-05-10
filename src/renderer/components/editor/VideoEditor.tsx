import { FileImage, Loader2, Pause, Play, Scissors } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WindowChrome, WindowShell } from '../Layout';
import { Button } from '../ui/button';
import { cn } from '@renderer/lib/cn';

interface Props {
  srcUrl: string;
  kind: 'video' | 'gif';
}

function format(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Video / GIF editor — replaces the Background tool for non-image media.
 * MVP: <video> element with native controls, drag-the-trim-handles below
 * a timeline, plus "Trim" + "Export GIF" buttons.
 */
export function VideoEditor({ srcUrl, kind }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [working, setWorking] = useState<'trim' | 'gif' | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Cache-bust the src after a trim so the <video> reloads.
  const [src, setSrc] = useState(srcUrl);

  useEffect(() => setSrc(srcUrl), [srcUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoadedMeta = (): void => {
      setDuration(v.duration || 0);
      setTrimEnd(v.duration || 0);
    };
    const onTime = (): void => setCurrentTime(v.currentTime);
    const onPlay = (): void => setPlaying(true);
    const onPause = (): void => setPlaying(false);
    v.addEventListener('loadedmetadata', onLoadedMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('loadedmetadata', onLoadedMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [src]);

  const togglePlay = (): void => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  const seek = (s: number): void => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, s));
  };

  const onTrim = useCallback(async () => {
    if (working || trimEnd <= trimStart) return;
    setWorking('trim');
    try {
      const result = await window.snapora.editor.trimVideo({
        startSeconds: trimStart,
        endSeconds: trimEnd,
      });
      setSrc(result.snapUrl);
      setTrimStart(0);
      setCurrentTime(0);
      setToast('Trimmed');
      setTimeout(() => setToast(null), 1200);
    } catch (err) {
      console.error('[editor] trim failed', err);
      setToast('Trim failed');
      setTimeout(() => setToast(null), 1500);
    } finally {
      setWorking(null);
    }
  }, [trimStart, trimEnd, working]);

  const onExportGif = useCallback(async () => {
    if (working || kind !== 'video') return;
    setWorking('gif');
    try {
      await window.snapora.editor.exportGif();
      setToast('GIF exported');
      setTimeout(() => setToast(null), 1500);
    } catch (err) {
      console.error('[editor] gif export failed', err);
      setToast('Export failed');
      setTimeout(() => setToast(null), 1500);
    } finally {
      setWorking(null);
    }
  }, [working, kind]);

  return (
    <WindowShell>
      <WindowChrome
        title={kind === 'gif' ? 'GIF editor' : 'Video editor'}
        right={
          <div className="flex items-center gap-2">
            {kind === 'video' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onExportGif()}
                disabled={working !== null}
                title="Export as GIF (saved next to the video)"
              >
                {working === 'gif' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileImage className="h-3.5 w-3.5" />
                )}
                Export GIF
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onTrim()}
              disabled={working !== null || trimEnd <= trimStart + 0.05}
              title="Trim to the selected range and overwrite"
            >
              {working === 'trim' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Scissors className="h-3.5 w-3.5" />
              )}
              Trim
            </Button>
          </div>
        }
      />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-[#1a1a1a]">
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">
          <video
            ref={videoRef}
            src={src}
            controls={false}
            className="max-h-full max-w-full rounded-md shadow-2xl ring-1 ring-white/10"
            onClick={togglePlay}
            playsInline
            // GIFs don't have an audio track + browsers expect them to autoplay/loop.
            loop={kind === 'gif'}
            autoPlay={kind === 'gif'}
            muted={kind === 'gif'}
          />
        </div>

        {/* Timeline + trim handles */}
        <div className="border-t border-white/5 bg-white/[0.025] px-6 py-4">
          <div className="mb-2 flex items-center gap-3 text-xs text-white/70">
            <button
              type="button"
              onClick={togglePlay}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white/95 transition hover:bg-white/15"
              aria-label={playing ? 'Pause' : 'Play'}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <span className="font-mono tabular-nums">{format(currentTime)}</span>
            <span className="opacity-50">/</span>
            <span className="font-mono tabular-nums">{format(duration)}</span>
            <div className="flex-1" />
            <span className="font-mono tabular-nums opacity-70">
              Trim {format(trimStart)} → {format(trimEnd)} (
              {format(Math.max(0, trimEnd - trimStart))})
            </span>
          </div>

          <div className="relative h-9">
            {/* Base track */}
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/[0.06]" />
            {/* Selected range fill */}
            {duration > 0 ? (
              <div
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-amber-400/85"
                style={{
                  left: `${(trimStart / duration) * 100}%`,
                  width: `${((trimEnd - trimStart) / duration) * 100}%`,
                }}
              />
            ) : null}
            {/* Playhead */}
            {duration > 0 ? (
              <div
                className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-white/90"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            ) : null}
            {/* Native range inputs stacked — leftmost wins for the start handle, rightmost for end. */}
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.01}
              value={trimStart}
              onChange={(e) => {
                const v = Math.min(trimEnd - 0.05, Number(e.target.value));
                setTrimStart(v);
                seek(v);
              }}
              className={cn('absolute inset-0 z-10 h-full w-full appearance-none bg-transparent')}
              style={{ pointerEvents: 'auto' }}
            />
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.01}
              value={trimEnd}
              onChange={(e) => {
                const v = Math.max(trimStart + 0.05, Number(e.target.value));
                setTrimEnd(v);
                seek(v);
              }}
              className={cn('absolute inset-0 z-10 h-full w-full appearance-none bg-transparent')}
              style={{ pointerEvents: 'auto' }}
            />
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-white/40">
            <span>Drag the slider handles to set start and end. Click Trim to save.</span>
          </div>
        </div>

        {toast ? (
          <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500/90 px-4 py-1.5 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        ) : null}
      </main>
    </WindowShell>
  );
}
