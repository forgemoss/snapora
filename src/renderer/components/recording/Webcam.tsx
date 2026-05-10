import { useEffect, useRef, useState } from 'react';
import { cn } from '@renderer/lib/cn';

interface WebcamPrefs {
  deviceLabel: string;
  shape: 'rectangle' | 'rounded' | 'circle';
  mirrored: boolean;
  fullscreen: boolean;
}

const DRAG = { WebkitAppRegion: 'drag' } as unknown as React.CSSProperties;

export function Webcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prefs, setPrefs] = useState<WebcamPrefs>({
    deviceLabel: '',
    shape: 'circle',
    mirrored: true,
    fullscreen: false,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const off = window.snapora.recording.onWebcamPrefs((next) => {
      setPrefs(next as WebcamPrefs);
    });
    return off;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const startCam = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === 'videoinput');
        const wanted = prefs.deviceLabel
          ? (cameras.find((c) => c.label === prefs.deviceLabel) ?? cameras[0])
          : cameras[0];
        const constraints: MediaStreamConstraints = {
          video: wanted ? { deviceId: { exact: wanted.deviceId } } : true,
          audio: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        console.error('[webcam] getUserMedia failed', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    void startCam();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [prefs.deviceLabel]);

  const radius = prefs.fullscreen
    ? 0
    : prefs.shape === 'circle'
      ? 9999
      : prefs.shape === 'rounded'
        ? 16
        : 0;

  // We disable the native window shadow in main (because it follows the
  // rectangular bounds, not our circle), then paint a CSS drop-shadow here
  // that follows the alpha — so circles stay perfectly round.
  const dropShadow = prefs.fullscreen ? undefined : 'drop-shadow(0 8px 24px rgba(0,0,0,0.45))';

  return (
    <div
      className="flex h-full w-full items-center justify-center text-white"
      style={{ ...DRAG, filter: dropShadow }}
    >
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-black/95',
          prefs.shape === 'rectangle' && !prefs.fullscreen && 'ring-1 ring-white/10',
        )}
        style={{ borderRadius: radius, overflow: 'hidden' }}
      >
        {error ? (
          <div className="px-3 text-center text-xs text-red-300">{error}</div>
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full"
            style={{
              objectFit: 'cover',
              transform: prefs.mirrored ? 'scaleX(-1)' : undefined,
            }}
          />
        )}
      </div>
    </div>
  );
}
