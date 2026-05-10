import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable, Writable } from 'node:stream';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { app, Notification, screen } from 'electron';
import logger from '@main/logger';
import { ensureFfmpegAvailable } from '@main/capture/binaries';
import { pickRegion } from '@main/selection/overlay';
import { getPreferences, setPreferences } from '@main/storage/prefs';
import { insertCapture } from '@main/storage/db';
import { showHudWithVideo } from '@main/windows/hud';
import { showEditorWithImage } from '@main/windows/editor';
import {
  closeRecordingControls,
  showRecordingControls,
  updateRecordingControls,
} from '@main/recording/controlsWindow';
import { closeWebcamWindow, showWebcamWindow } from '@main/recording/webcamWindow';
import { closeEffectsWindow, showEffectsWindow } from '@main/recording/effectsWindow';
import { showRecordingStage } from '@main/recording/stageWindow';
import { pickWindow } from '@main/recording/windowPicker';
import { setDoNotDisturb } from '@main/system/doNotDisturb';
import {
  avfScreenIndexForDisplay,
  invalidateAvfDevicesCache,
  listAvfDevices,
} from '@main/recording/ffmpegDevices';
import { rectToCropPx } from '@main/recording/cropArgs';
import { buildRecordingArgs } from '@main/recording/recordingArgs';
export { buildRecordingArgs } from '@main/recording/recordingArgs';
import type {
  RecordingMode,
  RecordingOptions,
  RecordingPhase,
  RecordingResult,
  RecordingStateSnapshot,
  SelectionRect,
} from '@shared/types';

/**
 * Module-level recording singleton — only one recording at a time.
 *
 * Pause/resume is implemented by stopping ffmpeg gracefully (`q` to stdin),
 * recording the temp file as a segment, and on resume spawning a fresh
 * ffmpeg into a new temp. On final stop, all segments are concatenated via
 * `ffmpeg -f concat -c copy` so the user gets a single seamless mp4.
 */

type FfmpegProc = ChildProcessByStdio<Writable, null, Readable>;
type ExitReason = 'pause' | 'stop' | 'restart' | null;

interface ActiveRecording {
  sessionId: string;
  mode: RecordingMode;
  region?: SelectionRect;
  displayId: number;
  outFile: string; // final user-visible destination
  segments: string[]; // completed segment paths (all .mp4)
  currentTempFile: string; // file ffmpeg is writing to right now (or just finished)
  proc: FfmpegProc | null; // null while paused
  startedAt: number; // Date.now() when the user first hit Record
  segmentStartedAt: number; // Date.now() when the current segment started
  accumulatedMs: number; // total recorded time across completed segments
  stderrTail: string;
  options: RecordingOptions;
  spawnArgsFactory: (targetTempFile: string) => string[];
  ffmpegPath: string;
  pendingExitReason: ExitReason; // why ffmpeg is being asked to stop
}

let phase: RecordingPhase = 'idle';
let active: ActiveRecording | null = null;
let lastError: string | undefined;
let dndWasEnabledByUs = false;
let tickInterval: ReturnType<typeof setInterval> | null = null;

export const recordingEvents = new EventEmitter();

function elapsedMs(): number {
  if (!active) return 0;
  if (phase === 'paused') return active.accumulatedMs;
  return active.accumulatedMs + (Date.now() - active.segmentStartedAt);
}

function emitState(): void {
  const snap: RecordingStateSnapshot = {
    phase,
    sessionId: active?.sessionId ?? null,
    startedAt: active?.startedAt ?? null,
    durationMs: elapsedMs(),
    error: lastError,
  };
  recordingEvents.emit('state', snap);
}

export function getRecordingState(): RecordingStateSnapshot {
  return {
    phase,
    sessionId: active?.sessionId ?? null,
    startedAt: active?.startedAt ?? null,
    durationMs: elapsedMs(),
    error: lastError,
  };
}

function defaultSaveDir(): string {
  // `videos` maps to ~/Movies on macOS (Apple's directory naming).
  return join(app.getPath('videos'), 'Snapora');
}

function timestampedFilename(ext: 'mp4' | 'gif' = 'mp4'): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp =
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
  return `Snapora ${stamp}.${ext}`;
}

function newSessionId(): string {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function transition(next: RecordingPhase, opts: { error?: string } = {}): void {
  phase = next;
  lastError = opts.error;
  emitState();
}

function startTickInterval(): void {
  if (tickInterval) clearInterval(tickInterval);
  let lastTraySec = -1;
  tickInterval = setInterval(() => {
    if (!active || (phase !== 'recording' && phase !== 'paused')) {
      stopTickInterval();
      return;
    }
    const ms = elapsedMs();
    updateRecordingControls({ durationMs: ms });
    // Also fan out to the tray so its `🔴 0:12` title ticks live without
    // bouncing every IPC broadcast through every BrowserWindow.
    const sec = Math.floor(ms / 1000);
    if (sec !== lastTraySec) {
      lastTraySec = sec;
      recordingEvents.emit('tick', { durationMs: ms });
    }
  }, 250);
}

function stopTickInterval(): void {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = null;
}

/**
 * Concat N mp4 segments into a single mp4 using `ffmpeg -f concat -c copy`.
 * All segments must share the same codec/parameters — guaranteed because
 * we generate them all with the same `spawnArgsFactory`.
 */
async function concatSegments(
  ffmpegPath: string,
  segments: string[],
  outPath: string,
): Promise<boolean> {
  if (segments.length === 0) return false;
  if (segments.length === 1) {
    await rename(segments[0]!, outPath).catch(() => {});
    return true;
  }
  const listPath = join(tmpdir(), `snapora-concat-${Date.now()}.txt`);
  const body = segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n');
  await writeFile(listPath, body, 'utf8');
  const ok = await new Promise<boolean>((resolve) => {
    const proc = spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listPath,
        '-c',
        'copy',
        '-y',
        outPath,
      ],
      { stdio: 'ignore' },
    );
    proc.on('error', () => resolve(false));
    proc.on('exit', (code) => resolve(code === 0));
  });
  void unlink(listPath).catch(() => {});
  return ok;
}

/** Post-process an mp4 → gif using ffmpeg's two-pass palette method. */
async function mp4ToGif(
  ffmpegPath: string,
  mp4Path: string,
  gifPath: string,
  opts: { fps: number; quality: number; maxWidth: number | null },
): Promise<boolean> {
  const palettePath = join(tmpdir(), `snapora-rec-palette-${Date.now()}.png`);
  const scaleFilter = opts.maxWidth ? `scale=${opts.maxWidth}:-1:flags=lanczos` : 'scale=iw:ih';
  const filters = `fps=${opts.fps},${scaleFilter}`;
  const dither =
    opts.quality >= 5 ? 'paletteuse' : `paletteuse=dither=bayer:bayer_scale=${opts.quality}`;
  const stages: { args: string[]; label: string }[] = [
    {
      args: [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        mp4Path,
        '-vf',
        `${filters},palettegen=stats_mode=diff`,
        '-y',
        palettePath,
      ],
      label: 'palettegen',
    },
    {
      args: [
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        mp4Path,
        '-i',
        palettePath,
        '-filter_complex',
        `${filters}[x];[x][1:v]${dither}`,
        '-y',
        gifPath,
      ],
      label: 'paletteuse',
    },
  ];
  for (const stage of stages) {
    const ok = await new Promise<boolean>((resolve) => {
      const proc = spawn(ffmpegPath, stage.args, { stdio: 'ignore' });
      proc.on('error', () => resolve(false));
      proc.on('exit', (code) => resolve(code === 0));
    });
    if (!ok) {
      logger.warn(`recording: gif ${stage.label} stage failed`);
      void unlink(palettePath).catch(() => {});
      return false;
    }
  }
  void unlink(palettePath).catch(() => {});
  return true;
}

async function applyEffectsWindowsForRecording(
  options: RecordingOptions,
  recordingDisplay: Electron.Display,
): Promise<void> {
  const prefs = getPreferences();
  if (options.recordWebcam ?? prefs.recordingWebcamEnabled) {
    showWebcamWindow({ recordingDisplayBounds: recordingDisplay.bounds });
  }
  const wantClicks = options.captureClicks ?? prefs.recordingCaptureClicks;
  const wantKeys = options.captureKeystrokes ?? prefs.recordingCaptureKeystrokes;
  if (wantClicks || wantKeys) {
    showEffectsWindow({ wantClicks, wantKeys, recordingDisplay });
  }
  if (options.hideNotifications ?? prefs.recordingHideNotifications) {
    const ok = await setDoNotDisturb(true);
    dndWasEnabledByUs = ok;
  }
}

async function teardownEffectsWindows(): Promise<void> {
  closeWebcamWindow();
  closeEffectsWindow();
  if (dndWasEnabledByUs) {
    await setDoNotDisturb(false);
    dndWasEnabledByUs = false;
  }
}

interface ResolvedTarget {
  region: SelectionRect | null;
  displayId: number;
  display: Electron.Display;
}

async function resolveTarget(options: RecordingOptions): Promise<ResolvedTarget | null> {
  if (options.mode === 'region') {
    if (options.region && options.displayId != null) {
      const display = screen.getAllDisplays().find((d) => d.id === options.displayId);
      if (!display) return null;
      return { region: options.region, displayId: display.id, display };
    }
    // Honor "remember last selection" if it's enabled and the rect is still on a display.
    const prefs = getPreferences();
    if (prefs.recordingRememberLastSelection && prefs.recordingLastRegion) {
      const r = prefs.recordingLastRegion;
      const display =
        screen
          .getAllDisplays()
          .find(
            (d) =>
              r.x >= d.bounds.x &&
              r.y >= d.bounds.y &&
              r.x + r.width <= d.bounds.x + d.bounds.width &&
              r.y + r.height <= d.bounds.y + d.bounds.height,
          ) ?? null;
      if (display) {
        return { region: r, displayId: display.id, display };
      }
    }
    const result = await pickRegion();
    if (result.cancelled || !result.rect || result.displayId == null) return null;
    const display = screen.getAllDisplays().find((d) => d.id === result.displayId);
    if (!display) return null;
    if (prefs.recordingRememberLastSelection) {
      setPreferences({ recordingLastRegion: result.rect });
    }
    return { region: result.rect, displayId: display.id, display };
  }
  if (options.mode === 'window') {
    const pick = await pickWindow();
    if (pick.cancelled || pick.displayId == null) return null;
    const display = screen.getAllDisplays().find((d) => d.id === pick.displayId);
    if (!display) return null;
    // If we resolved bounds via System Events, treat window mode like a
    // pre-baked region: ffmpeg crops the display capture to JUST the
    // window's rect — no menu bar, no other apps, no controls bar. When
    // bounds aren't resolvable (no Accessibility, weird title), fall back
    // to recording the whole display so we don't fail entirely.
    return { region: pick.rect, displayId: display.id, display };
  }
  const display =
    options.displayId != null
      ? (screen.getAllDisplays().find((d) => d.id === options.displayId) ??
        screen.getPrimaryDisplay())
      : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  return { region: null, displayId: display.id, display };
}

function spawnSegment(rec: ActiveRecording): void {
  const args = rec.spawnArgsFactory(rec.currentTempFile);
  logger.info('recording: spawning ffmpeg segment', {
    sessionId: rec.sessionId,
    file: rec.currentTempFile,
    segmentIndex: rec.segments.length,
  });
  const proc = spawn(rec.ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  rec.proc = proc;
  rec.segmentStartedAt = Date.now();
  proc.stderr.on('data', (chunk: Buffer) => {
    rec.stderrTail = (rec.stderrTail + chunk.toString('utf8')).slice(-4096);
  });
  proc.on('error', (err) => {
    logger.error('recording: ffmpeg spawn error', err);
    void onFfmpegExit(-1, err.message);
  });
  proc.on('exit', (code, signal) => {
    logger.info('recording: ffmpeg exit', {
      code,
      signal,
      reason: rec.pendingExitReason,
      segments: rec.segments.length,
    });
    void onFfmpegExit(code ?? -1);
  });
}

async function onFfmpegExit(_code: number, errMsg?: string): Promise<void> {
  if (!active) return;
  const rec = active;
  const reason: ExitReason = rec.pendingExitReason;
  rec.pendingExitReason = null;
  rec.proc = null;

  if (errMsg) {
    return finalize(rec, { fail: errMsg });
  }

  // Always commit the just-finished segment to disk + into the segments array.
  try {
    await stat(rec.currentTempFile);
    rec.segments.push(rec.currentTempFile);
    rec.accumulatedMs += Date.now() - rec.segmentStartedAt;
  } catch {
    logger.warn('recording: ffmpeg exited without writing a segment file');
  }

  if (reason === 'pause') {
    transition('paused');
    return;
  }
  if (reason === 'restart') {
    // Discard everything and start over.
    for (const seg of rec.segments) void unlink(seg).catch(() => {});
    rec.segments = [];
    rec.accumulatedMs = 0;
    rec.startedAt = Date.now();
    rec.currentTempFile = join(tmpdir(), `snapora-rec-${rec.sessionId}-${rec.segments.length}.mp4`);
    spawnSegment(rec);
    transition('recording');
    return;
  }
  // Default: stop → finalize.
  return finalize(rec, {});
}

async function finalize(rec: ActiveRecording, opts: { fail?: string }): Promise<void> {
  const failMsg = opts.fail;
  if (failMsg) {
    transition('failed', { error: failMsg });
  } else {
    transition('finalizing');
  }
  closeRecordingControls();
  await teardownEffectsWindows();
  stopTickInterval();

  const wantGif = (rec.options.output ?? 'mp4') === 'gif';

  let finalPath: string | null = null;
  try {
    if (rec.segments.length === 0) {
      throw new Error('no segments');
    }
    // Concat all segments to a single temp mp4.
    const concatTarget = join(tmpdir(), `snapora-rec-final-${rec.sessionId}.mp4`);
    const ok = await concatSegments(rec.ffmpegPath, rec.segments, concatTarget);
    if (!ok) throw new Error('concat failed');

    if (wantGif) {
      const prefs = getPreferences();
      const gifOk = await mp4ToGif(rec.ffmpegPath, concatTarget, rec.outFile, {
        fps: prefs.recordingGifFps,
        quality: prefs.recordingGifQuality,
        maxWidth: prefs.recordingGifMaxWidth,
      });
      if (gifOk) {
        finalPath = rec.outFile;
      } else {
        logger.warn('recording: gif post-process failed; saving mp4 fallback');
        const fallback = rec.outFile.replace(/\.gif$/, '.mp4');
        await rename(concatTarget, fallback);
        finalPath = fallback;
      }
      void unlink(concatTarget).catch(() => {});
    } else {
      await rename(concatTarget, rec.outFile);
      finalPath = rec.outFile;
    }

    // Clean up the per-segment files now that the merged file is in place.
    for (const seg of rec.segments) void unlink(seg).catch(() => {});
  } catch (err) {
    logger.warn('recording: finalize failed', err);
    if (rec.stderrTail) logger.warn('recording: ffmpeg stderr tail', rec.stderrTail);
  }

  if (finalPath) {
    const totalMs = rec.accumulatedMs;
    try {
      insertCapture({
        filePath: finalPath,
        capturedAt: new Date(rec.startedAt).toISOString(),
        mode: rec.mode === 'region' ? 'area' : rec.mode === 'display' ? 'fullscreen' : 'window',
        width: null,
        height: null,
        kind: 'recording',
        durationMs: totalMs,
      });
    } catch (err) {
      logger.warn('recording: history insert failed', err);
    }
    // Stagger the window ops — opening HUD + editor in the same tick (right
    // after closing 3 recording windows) reliably triggered an AppKit
    // NSRangeException ("objectAtIndex:1 beyond bounds [0..0]") inside
    // _setFrameCommon:display:fromServer: on certain macOS configurations.
    // Letting AppKit settle between mutations avoids the native crash.
    void showHudWithVideo(finalPath, totalMs);
    if (getPreferences().recordingOpenEditorAfter) {
      const path = finalPath;
      setTimeout(() => showEditorWithImage(path), 80);
    }
  } else {
    for (const seg of rec.segments) void unlink(seg).catch(() => {});
  }

  active = null;
  invalidateAvfDevicesCache();
  transition('idle');
}

export async function startRecording(
  options: RecordingOptions,
): Promise<{ sessionId: string } | null> {
  if (phase !== 'idle') {
    logger.warn('recording: start while not idle', { phase });
    return null;
  }
  const ffmpegPath = ensureFfmpegAvailable();
  transition('countdown');

  const target = await resolveTarget(options);
  if (!target) {
    transition('idle');
    return null;
  }

  // Stage toolbar — shown for every mode so the user gets the same
  // confirm-and-tweak panel before recording starts. For window / display
  // modes we feed it the bounds of what will be recorded (the picked
  // display) so the stage's size pill is meaningful.
  {
    const stageRegion = target.region ?? {
      x: target.display.bounds.x,
      y: target.display.bounds.y,
      width: target.display.bounds.width,
      height: target.display.bounds.height,
    };
    const staged = await showRecordingStage({
      region: stageRegion,
      displayId: target.displayId,
    });
    if (staged.cancelled) {
      transition('idle');
      return null;
    }
    options = {
      ...options,
      output: staged.output,
      recordMicrophone: staged.recordMicrophone,
      recordWebcam: staged.recordWebcam,
      captureClicks: staged.captureClicks,
      captureKeystrokes: staged.captureKeystrokes,
    };
  }

  const devices = await listAvfDevices();
  const screenIdx = avfScreenIndexForDisplay(
    target.displayId,
    screen.getAllDisplays(),
    devices.videoScreens,
  );
  if (screenIdx == null) {
    transition('failed', { error: 'No avfoundation screen device found' });
    return null;
  }

  let micIdx: number | null = null;
  const wantMic = options.recordMicrophone ?? getPreferences().recordingMicrophone;
  if (wantMic) {
    const prefDeviceLabel = getPreferences().recordingMicrophoneDevice;
    const dev =
      devices.audioInputs.find((d) => d.label === prefDeviceLabel) ?? devices.audioInputs[0];
    if (dev) micIdx = dev.index;
  }

  const quality = options.quality ?? getPreferences().recordingQuality;
  const bitrate = quality === 'standard' ? '4M' : quality === 'best' ? '16M' : '8M';
  const framerate = options.framerate ?? getPreferences().recordingFramerate;
  const cropPx = target.region ? rectToCropPx(target.region, target.display) : null;

  const sessionId = newSessionId();
  const wantGif = (options.output ?? 'mp4') === 'gif';
  const outFile = join(defaultSaveDir(), timestampedFilename(wantGif ? 'gif' : 'mp4'));
  await mkdir(defaultSaveDir(), { recursive: true });

  // Factory so each segment uses identical args (essential for `-c copy` concat).
  const spawnArgsFactory = (target: string): string[] =>
    buildRecordingArgs({
      ffmpegPath,
      screenIdx,
      micIdx,
      framerate,
      bitrate,
      cropPx,
      outFile: target,
    });

  await applyEffectsWindowsForRecording(options, target.display);

  const tempFile = join(tmpdir(), `snapora-rec-${sessionId}-0.mp4`);

  const rec: ActiveRecording = {
    sessionId,
    mode: options.mode,
    region: target.region ?? undefined,
    displayId: target.displayId,
    outFile,
    segments: [],
    currentTempFile: tempFile,
    proc: null,
    startedAt: Date.now(),
    segmentStartedAt: Date.now(),
    accumulatedMs: 0,
    stderrTail: '',
    options,
    spawnArgsFactory,
    ffmpegPath,
    pendingExitReason: null,
  };
  active = rec;

  spawnSegment(rec);
  transition('recording');

  if (getPreferences().recordingShowControls) {
    // The floating bar is only safe to show when we can keep it OUT of the
    // recording. The crop filter excludes anything outside `target.region`,
    // so the bar must fit ABOVE or BELOW the region (or on another display).
    // For a near-fullscreen window/region with no room, we have to skip —
    // ffmpeg will record the bar otherwise. setContentProtection /
    // NSPanel / etc. don't reliably exclude from AVCaptureScreenInput;
    // ScreenCaptureKit + SCContentFilter is the proper fix (separate PR).
    const displays = screen.getAllDisplays();
    const hasOtherDisplay = displays.some((d) => d.id !== target.display.id);
    const avoidRect = target.region ?? target.display.bounds;
    // The bar is 320×56 + a small margin. Need ~70px of free space above
    // or below the avoidRect within the display work area.
    const BAR_NEEDED = 70;
    const wa = target.display.workArea;
    const roomAbove = avoidRect.y - wa.y;
    const roomBelow = wa.y + wa.height - (avoidRect.y + avoidRect.height);
    const fitsOnSameDisplay = roomAbove >= BAR_NEEDED || roomBelow >= BAR_NEEDED;
    if (hasOtherDisplay || fitsOnSameDisplay) {
      showRecordingControls({
        onStop: () => void stopRecording(),
        onCancel: () => void cancelRecording(),
        avoidRect,
      });
    } else {
      logger.info(
        'recording: skipping floating controls — single display + display/window mode (use tray or Cmd+Shift+5)',
      );
      // Compensate for the missing visual feedback with a system
      // notification that tells the user how to stop. Auto-dismisses; the
      // tray title (`● REC`) keeps the long-term indicator.
      const hotkey = getPreferences().recordingHotkey || 'tray menu';
      const notif = new Notification({
        title: 'Recording…',
        body: `Press ${hotkey} or use the tray menu to stop.`,
        silent: true,
      });
      notif.show();
      // macOS auto-dismisses banners after ~5s; nothing else to wire.
    }
  }

  startTickInterval();
  return { sessionId };
}

/** Graceful pause: stop ffmpeg but keep all segments around for resume. */
export async function pauseRecording(): Promise<void> {
  if (!active || phase !== 'recording' || !active.proc) return;
  active.pendingExitReason = 'pause';
  try {
    active.proc.stdin.write('q\n');
    active.proc.stdin.end();
  } catch {
    active.proc.kill('SIGINT');
  }
}

/** Resume from a paused state by spawning a fresh ffmpeg into a new segment. */
export async function resumeRecording(): Promise<void> {
  if (!active || phase !== 'paused') return;
  const rec = active;
  rec.currentTempFile = join(tmpdir(), `snapora-rec-${rec.sessionId}-${rec.segments.length}.mp4`);
  spawnSegment(rec);
  transition('recording');
}

/** Throw away whatever's been recorded and start over from t=0. */
export async function restartRecording(): Promise<void> {
  if (!active) return;
  if (active.proc) {
    active.pendingExitReason = 'restart';
    try {
      active.proc.stdin.write('q\n');
      active.proc.stdin.end();
    } catch {
      active.proc.kill('SIGINT');
    }
  } else if (phase === 'paused') {
    // No ffmpeg running — clear segments inline and re-spawn.
    for (const seg of active.segments) void unlink(seg).catch(() => {});
    active.segments = [];
    active.accumulatedMs = 0;
    active.startedAt = Date.now();
    active.currentTempFile = join(tmpdir(), `snapora-rec-${active.sessionId}-0.mp4`);
    spawnSegment(active);
    transition('recording');
  }
}

/**
 * Graceful stop: ask ffmpeg to flush and finalize, then concat all segments
 * into the final output file.
 */
export async function stopRecording(): Promise<RecordingResult> {
  if (!active || (phase !== 'recording' && phase !== 'paused')) {
    return {
      filePath: null,
      cancelled: true,
      durationMs: 0,
      startedAt: '',
      endedAt: new Date().toISOString(),
    };
  }
  const session = active;
  const outFile = session.outFile;

  if (phase === 'paused' || !session.proc) {
    // No ffmpeg running — go straight to finalize using existing segments.
    transition('stopping');
    await finalize(session, {});
  } else {
    transition('stopping');
    session.pendingExitReason = 'stop';
    try {
      session.proc.stdin.write('q\n');
      session.proc.stdin.end();
    } catch {
      session.proc.kill('SIGINT');
    }
    // Wait up to 5s for graceful exit.
    const exited = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 5000);
      session.proc?.once('exit', () => {
        clearTimeout(t);
        resolve(true);
      });
    });
    if (!exited && session.proc) {
      session.proc.kill('SIGINT');
      await new Promise((r) => setTimeout(r, 2000));
      if (session.proc.exitCode == null) session.proc.kill('SIGKILL');
    }
    // Wait for finalize to complete.
    await new Promise<void>((resolve) => {
      const finalCheck = (): boolean => {
        const p = phase as RecordingPhase;
        return p === 'idle' || p === 'failed';
      };
      const off = (): void => {
        if (finalCheck()) {
          recordingEvents.off('state', off);
          resolve();
        }
      };
      recordingEvents.on('state', off);
      if (finalCheck()) resolve();
    });
  }

  const finishedClean = (phase as RecordingPhase) === 'idle';
  return {
    filePath: finishedClean ? outFile : null,
    cancelled: false,
    durationMs: session.accumulatedMs,
    startedAt: new Date(session.startedAt).toISOString(),
    endedAt: new Date().toISOString(),
  };
}

/** Discard mid-recording: kill ffmpeg and delete every segment. */
export async function cancelRecording(): Promise<void> {
  if (!active) return;
  logger.info('recording: cancel requested');
  const rec = active;
  rec.pendingExitReason = 'stop'; // we don't want any finalize behavior
  if (rec.proc) {
    rec.proc.kill('SIGINT');
  }
  // Clean up segments + temp file regardless.
  setTimeout(() => {
    for (const seg of rec.segments) void unlink(seg).catch(() => {});
    void unlink(rec.currentTempFile).catch(() => {});
  }, 1500);
  closeRecordingControls();
  await teardownEffectsWindows();
  stopTickInterval();
  active = null;
  transition('idle');
}

export function isRecording(): boolean {
  return (
    phase === 'recording' ||
    phase === 'paused' ||
    phase === 'stopping' ||
    phase === 'finalizing' ||
    phase === 'countdown'
  );
}
