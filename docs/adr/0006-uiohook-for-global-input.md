# 0006 — Global input hooks via `uiohook-napi`

**Date:** 2026-05-10
**Status:** Accepted

## Context

CleanShot X-style "highlight clicks" and "show keystrokes on screen" overlays
require listening to **global** mouse-down and key-down events — not just the
events that hit Snapora's own windows. macOS exposes this via the Quartz
event-tap API (`CGEventTap`), which is C and Obj-C only.

Hard rule #1: no native code we write. The pragmatic interpretation has
always been "we ship pre-built binaries; we don't write them" — the same
model that lets us ship `ffmpeg` (ADR-0004) and the `better-sqlite3`
prebuilt N-API addon.

## Decision

Use **`uiohook-napi`**, an N-API addon with prebuilt binaries published per
arch on npm. It wraps the C library `libuiohook` and exposes `mousedown`,
`mouseup`, `keydown`, `keyup` events to Node.

Architecturally:

- The addon is loaded **lazily** via dynamic `await import('uiohook-napi')`
  inside `src/main/recording/effectsWindow.ts`. A missing or broken addon
  doesn't crash main — we log a warning and degrade gracefully (recording
  still works, no overlay).
- Hooks are started on `recording → countdown` transition, stopped on the
  transition to `complete`/`failed`/`idle`. They are **not** running 24/7.
- Events are forwarded to the effects renderer over IPC; the renderer
  paints click ripples + keystroke pills on a transparent fullscreen
  click-through overlay window. ffmpeg captures the pixels off the screen,
  so the overlays bake into the video.

## macOS permissions

`uiohook-napi` requires **Accessibility** permission for global keyboard
events. `systemPreferences.isTrustedAccessibilityClient(false)` is checked
before showing the effects window; if it returns false we skip the overlay
and log a warning. (Future: a polished "grant Accessibility" dialog.)

## Consequences

**Enables:**

- Click highlight + keystroke pill — the user-visible features the user
  explicitly asked for.

**Costs:**

- ~3 MB extra in the DMG per arch (the prebuilt addon).
- A new TCC permission (Accessibility) for users who turn the features on.
- We're now on the hook for a third native dependency's update cadence
  (alongside `ffmpeg` and `better-sqlite3`).

## Why this satisfies "no native code we write"

- We do not author any Swift, Obj-C, or C source.
- We bundle a pre-built native artifact, identical in shape to what we do
  with `ffmpeg` and `better-sqlite3`.
- The behavior is opt-in: a user who never enables click/keystroke
  recording never triggers the addon load.

## Alternatives considered

- **`iohook` (the older lib)** — abandoned, no prebuilt binaries for current
  Node/Electron ABIs.
- **Skip the feature** — explicitly requested by the user; deferring would
  have shipped a recorder visibly worse than CleanShot.
- **Listen only to in-window events** — no, by definition the user wants to
  capture clicks they're making on _other_ apps while recording.
- **Write our own Swift CGEventTap helper** — forbidden by rule #1.

## Revisit when

- The user removes the click/keystroke features from the spec (then we drop
  the dep).
- A pure-JS approach to global events appears (it won't).
