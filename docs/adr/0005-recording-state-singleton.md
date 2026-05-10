# 0005 — Recording state lives in a module-level singleton

**Date:** 2026-05-10
**Status:** Accepted

## Context

The screen recorder needs a state machine: idle → countdown → recording →
stopping → finalizing → idle (with a `failed` branch off everything). State
needs to be reachable from:

- The IPC handlers (start / stop / cancel / state).
- The tray (label flips Record ↔ Stop, plus a `● REC` title indicator).
- The `will-quit` handler (to cancel an in-flight recording).
- The recording-controls overlay window (timer ticks, stop button).
- The effects window (start / stop the uiohook listeners).
- Settings (future "show recording status" UI).

Only one recording can run at a time — that's a strong invariant.

## Decision

Recording state lives in **module-level state in `src/main/recording/session.ts`**,
exposed through pure functions (`startRecording`, `stopRecording`,
`cancelRecording`, `getRecordingState`, `isRecording`) and a single
`recordingEvents` `EventEmitter`.

This matches the existing patterns in `src/main/windows/hud.ts` and
`src/main/selection/overlay.ts`. We considered:

- **A `RecordingSession` class** held in a module variable — same shape with
  more ceremony.
- **Zustand-in-main** — overkill for one piece of mutable state.
- **Per-instance object passed around as a parameter** — pollutes the signature
  of every IPC handler that needs to check `isRecording()` or kill an active
  recording on quit.

## Consequences

**Enables:**

- IPC fan-out is trivial: every renderer subscribes to `recordingEvents`
  via a single `recording:on-state` channel.
- New consumers (tray, will-quit, settings) call a one-line function
  instead of threading a class instance through.

**Costs:**

- Module state is harder to fake in unit tests. Mitigated by extracting the
  pure pieces (`buildRecordingArgs`, `cropArgs`, `parseDevices`) into their
  own modules — those are individually testable. The orchestration in
  `session.ts` is exercised manually + via Playwright e2e.

## Revisit when

We add a second simultaneous recording (multi-track, dual-camera, etc.) — at
that point the singleton breaks and we need a per-session class.
