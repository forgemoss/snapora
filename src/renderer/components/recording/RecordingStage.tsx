import {
  ChevronDown,
  Command,
  CornerDownLeft,
  Crop,
  FileImage,
  Maximize2,
  Mic,
  MousePointerClick,
  SlidersHorizontal,
  Speaker,
  Video,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@renderer/lib/cn';

interface StageInit {
  region: { x: number; y: number; width: number; height: number };
  displayId: number;
}

const DRAG = { WebkitAppRegion: 'drag' } as unknown as React.CSSProperties;
const NO_DRAG = { WebkitAppRegion: 'no-drag' } as unknown as React.CSSProperties;

export function RecordingStage() {
  const [init, setInit] = useState<StageInit | null>(null);
  const [mic, setMic] = useState(false);
  const [micDevice, setMicDevice] = useState<string | null>(null);
  const [systemAudio, setSystemAudio] = useState(false);
  const [webcam, setWebcam] = useState(false);
  const [webcamDevice, setWebcamDevice] = useState<string | null>(null);
  const [clicks, setClicks] = useState(false);
  const [keys, setKeys] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const off = window.snapora.recording.onStageInit((p) => {
      if (!cancelled) setInit(p as StageInit);
    });
    void Promise.all([
      window.snapora.preferences.get(),
      window.snapora.recording.stageGetInit(),
    ]).then(([prefs, p]) => {
      if (cancelled) return;
      if (p) setInit(p as StageInit);
      setMic(prefs.recordingMicrophone);
      setMicDevice(prefs.recordingMicrophoneDevice || null);
      setWebcam(prefs.recordingWebcamEnabled);
      setWebcamDevice(prefs.recordingWebcamDevice || null);
      setClicks(prefs.recordingCaptureClicks);
      setKeys(prefs.recordingCaptureKeystrokes);
      // Auto-open the preview if the user already had webcam on, so the
      // toggle state matches what they see on screen.
      if (prefs.recordingWebcamEnabled && p) {
        window.snapora.recording.stageWebcamPreviewShow((p as StageInit).region);
      }
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  // Live preview of click + keystroke overlays whenever either toggle is on,
  // so the user sees exactly what would land in the recording. The same
  // overlay window that runs during real recording.
  useEffect(() => {
    if (!init) return;
    if (clicks || keys) {
      window.snapora.recording.stageEffectsPreviewShow({ wantClicks: clicks, wantKeys: keys });
    } else {
      window.snapora.recording.stageEffectsPreviewHide();
    }
  }, [clicks, keys, init]);

  // ESC cancels; Enter starts video; ⌥⏎ starts GIF.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.snapora.recording.stageCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const output: 'mp4' | 'gif' = e.altKey ? 'gif' : 'mp4';
        window.snapora.recording.stageCommit({
          output,
          recordMicrophone: mic,
          recordWebcam: webcam,
          captureClicks: clicks,
          captureKeystrokes: keys,
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mic, webcam, clicks, keys]);

  const openSettings = (): void => {
    void window.snapora.recording.stageOpenSettings();
  };

  // Icon click = toggle on/off. Chevron click = pick device (also activates).
  const toggleMic = (): void => setMic((v) => !v);

  const pickMicDevice = async (): Promise<void> => {
    const result = await window.snapora.recording.stageMicMenu(mic ? micDevice : null);
    if (!result) return; // dismissed
    setMic(true);
    setMicDevice(result);
    void window.snapora.preferences.set({ recordingMicrophoneDevice: result });
  };

  const toggleCamera = (): void => {
    if (webcam) {
      setWebcam(false);
      window.snapora.recording.stageWebcamPreviewHide();
    } else {
      setWebcam(true);
      if (init) window.snapora.recording.stageWebcamPreviewShow(init.region);
    }
  };

  const pickCameraDevice = async (): Promise<void> => {
    const result = await window.snapora.recording.stageCameraMenu(webcam ? webcamDevice : null);
    if (!result) return;
    const wasOff = !webcam;
    setWebcam(true);
    setWebcamDevice(result);
    void window.snapora.preferences.set({ recordingWebcamDevice: result });
    if (init && wasOff) window.snapora.recording.stageWebcamPreviewShow(init.region);
  };

  const commit = (output: 'mp4' | 'gif'): void => {
    window.snapora.recording.stageCommit({
      output,
      recordMicrophone: mic,
      recordWebcam: webcam,
      captureClicks: clicks,
      captureKeystrokes: keys,
    });
  };

  if (!init) {
    return (
      <div
        className="grid h-full w-full place-items-center rounded-2xl bg-neutral-900/95 text-white/60 text-xs ring-1 ring-white/10 backdrop-blur"
        style={DRAG}
      >
        Setting up…
      </div>
    );
  }

  const w = Math.round(init.region.width);
  const h = Math.round(init.region.height);

  return (
    <div className="flex h-full w-full flex-col gap-1.5 p-0" style={DRAG}>
      {/* Top panel — controls + toggles */}
      <div
        className="flex flex-col gap-1.5 rounded-2xl bg-neutral-900/95 px-2 py-2 ring-1 ring-white/10 backdrop-blur"
        style={DRAG}
      >
        {/* Row 1 — settings / size / fullscreen / crop */}
        <div className="flex items-center gap-1" style={NO_DRAG}>
          <IconButton
            title="Recording settings"
            onClick={openSettings}
            icon={<SlidersHorizontal className="h-4 w-4" />}
          />
          <div className="flex flex-1 items-center justify-center gap-1" style={DRAG}>
            <span className="select-none rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[12px] tabular-nums text-white/95">
              {w}
            </span>
            <span className="text-white/45 text-xs">×</span>
            <span className="select-none rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[12px] tabular-nums text-white/95">
              {h}
            </span>
          </div>
          <IconButton
            title="Record full screen"
            onClick={() => void window.snapora.recording.stageSwitchMode('display')}
            icon={<Maximize2 className="h-4 w-4" />}
          />
          <IconButton
            title="Crop / re-select region"
            onClick={() => void window.snapora.recording.stageSwitchMode('region')}
            icon={<Crop className="h-4 w-4" />}
          />
        </div>

        {/* Row 2 — 5 toggles. Mic + Camera are split-buttons: icon zone
            toggles on/off, chevron zone opens the device picker. */}
        <div className="flex items-center justify-between gap-1" style={NO_DRAG}>
          <SplitToggle
            active={mic}
            onToggle={toggleMic}
            onPickDevice={pickMicDevice}
            toggleTitle={mic ? `Microphone — ${micDevice ?? 'On'}` : 'Microphone — Off'}
            pickTitle="Choose microphone"
            icon={<Mic className="h-4 w-4" />}
          />
          <ToolbarToggle
            active={systemAudio}
            disabled
            onClick={() => setSystemAudio((v) => !v)}
            title="System audio (coming via BlackHole)"
            icon={<Speaker className="h-4 w-4" />}
          />
          <SplitToggle
            active={webcam}
            onToggle={toggleCamera}
            onPickDevice={pickCameraDevice}
            toggleTitle={webcam ? `Camera — ${webcamDevice ?? 'On'}` : 'Camera — Off'}
            pickTitle="Choose camera"
            icon={<Video className="h-4 w-4" />}
          />
          <ToolbarToggle
            active={clicks}
            onClick={() => setClicks((v) => !v)}
            title={clicks ? 'Highlight clicks — On' : 'Highlight clicks — Off'}
            icon={<MousePointerClick className="h-[18px] w-[18px]" strokeWidth={2.25} />}
          />
          <ToolbarToggle
            active={keys}
            onClick={() => setKeys((v) => !v)}
            title={keys ? 'Show keystrokes — On' : 'Show keystrokes — Off'}
            icon={<Command className="h-[18px] w-[18px]" strokeWidth={2.25} />}
          />
        </div>
      </div>

      {/* Bottom panel — Record GIF / Record Video stacked */}
      <div
        className="flex flex-col overflow-hidden rounded-2xl bg-neutral-900/95 ring-1 ring-white/10 backdrop-blur"
        style={NO_DRAG}
      >
        <button
          type="button"
          onClick={() => commit('gif')}
          className="flex h-10 items-center gap-2.5 px-3.5 text-sm text-white/90 transition hover:bg-white/[0.06] active:bg-white/[0.10]"
        >
          <FileImage className="h-4 w-4 flex-shrink-0 text-white/85" />
          <span className="flex-1 text-left font-medium">Record GIF</span>
          <span className="inline-flex items-center gap-0.5 rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-white/65">
            ⌥<CornerDownLeft className="h-2.5 w-2.5" />
          </span>
        </button>
        <div className="h-px bg-white/[0.06]" />
        <button
          type="button"
          onClick={() => commit('mp4')}
          className="flex h-10 items-center gap-2.5 px-3.5 text-sm text-white/95 transition hover:bg-white/[0.06] active:bg-white/[0.10]"
        >
          <Video className="h-4 w-4 flex-shrink-0 text-white/85" />
          <span className="flex-1 text-left font-medium">Record Video</span>
          <span className="inline-flex items-center gap-0.5 rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-white/65">
            <CornerDownLeft className="h-2.5 w-2.5" />
          </span>
        </button>
      </div>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  icon,
}: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md text-white/65 transition hover:bg-white/[0.08] hover:text-white/95"
    >
      {icon}
    </button>
  );
}

function ToolbarToggle({
  active,
  disabled,
  onClick,
  title,
  icon,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'grid h-9 flex-1 place-items-center rounded-lg text-white/75 transition',
        active && !disabled
          ? 'bg-amber-400/95 text-neutral-900 shadow-sm shadow-amber-500/25 hover:bg-amber-400'
          : 'bg-white/[0.05] ring-1 ring-white/[0.06] hover:bg-white/[0.09] hover:text-white/95',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {icon}
    </button>
  );
}

/**
 * Split-button used for mic + camera toggles. Two clickable zones share one
 * pill-shaped container: the wide left zone (icon) toggles on/off, the
 * narrow right zone (chevron) opens the device picker. Picking a device
 * implies "switch to this device and activate".
 */
function SplitToggle({
  active,
  onToggle,
  onPickDevice,
  toggleTitle,
  pickTitle,
  icon,
}: {
  active: boolean;
  onToggle: () => void;
  onPickDevice: () => void;
  toggleTitle: string;
  pickTitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex h-9 flex-1 overflow-hidden rounded-lg ring-1 transition',
        active
          ? 'bg-amber-400/95 ring-amber-500/40 shadow-sm shadow-amber-500/25'
          : 'bg-white/[0.05] ring-white/[0.06]',
      )}
    >
      <button
        type="button"
        title={toggleTitle}
        aria-label={toggleTitle}
        aria-pressed={active}
        onClick={onToggle}
        className={cn(
          'flex flex-1 items-center justify-center transition',
          active
            ? 'text-neutral-900 hover:bg-amber-400'
            : 'text-white/75 hover:bg-white/[0.06] hover:text-white/95',
        )}
      >
        {icon}
      </button>
      <button
        type="button"
        title={pickTitle}
        aria-label={pickTitle}
        onClick={onPickDevice}
        className={cn(
          'grid w-4 place-items-center border-l transition',
          active
            ? 'border-neutral-900/15 text-neutral-800 hover:bg-amber-400'
            : 'border-white/10 text-white/55 hover:bg-white/[0.08] hover:text-white/90',
        )}
      >
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
