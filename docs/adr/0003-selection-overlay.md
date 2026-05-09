# 0003 — Homegrown selection overlay (per-display BrowserWindows)

**Date:** 2026-05-10
**Status:** Accepted

## Context

`screencapture -i` (the macOS system selection HUD) does not expose the rectangle the user picked — it just writes a file. That's a hard blocker for two ROADMAP items:

- **v0.2 — Capture Previous Area.** Re-fire the last region without re-dragging. Impossible without remembering bounds.
- **v0.4 — Region screen recording.** ffmpeg's `avfoundation` input takes pixel coordinates, so we must know the rect before invoking it.

We therefore need to drive selection ourselves. The capture pipeline shifts from `screencapture -i path` to `screencapture -R x,y,w,h path` once we know the rect.

## Decision

Snapora drives region selection through a **homegrown selection overlay**: one frameless transparent `BrowserWindow` per display, shown above the menu bar (`alwaysOnTop: 'screen-saver'`). The user drags inside an overlay, the renderer normalizes the rect, and main converts it to global DIPs and feeds `screencapture -R`.

Key shape:

- **One window per display**, positioned at that display's `bounds`. A single window spanning the global desktop produces clipping and Mission Control problems on macOS Electron 33.
- **Interactive, not click-through.** `setIgnoreMouseEvents(true)` breaks drag detection on macOS; we own input and use a near-transparent fill (~18% black via CSS) as the visual.
- **DIPs everywhere.** `screencapture -R`, `Display.bounds`, and our stored regions are all in display-independent pixels. Retina is handled inside `screencapture` itself — we never multiply by `scaleFactor`.
- **Pure-math geometry helpers** live in `src/main/selection/geometry.ts` so the unit tests don't import `electron`.

A pref flag `useCustomSelectionOverlay` (default `true`) keeps the legacy `screencapture -i` path one release as a safety valve. Removed in v0.3 once the overlay has soak time.

## Consequences

**Enables:**

- "Capture Previous Area" (v0.2 PR2 follow-on).
- Region recording in v0.4 reuses the same overlay — one investment, two milestones.
- Future polish (magnifier loupe, keyboard nudging, snap-to-window) lives entirely in our renderer rather than fighting an OS HUD.

**Costs:**

- More code than `-i`. We own ESC, multi-display, display-removed mid-selection, drag normalization, etc.
- Visual differs from CleanShot/Shottr's selection. Acceptable — visitors expect a polished selection from a screenshot app, and we control the look.
- One additional renderer entry (`selection.html`).

## Alternatives considered

- **`AppleScript` to query the selection rect from `screencapture`** — there is no such API. The system tool keeps its rect internal.
- **Screenshot the entire screen, then crop in Node** — works for "Capture Area" but not "Capture Previous Area" (still need the rect from somewhere) and doubles I/O. Rejected.
- **A single fullscreen window spanning all displays** — Electron + macOS produces clipping and weird input routing across virtual displays. Rejected after testing.
- **Click-through overlay using `setIgnoreMouseEvents`** — pointer events go _through_ the window to the desktop below; we lose drag detection. Rejected.

## Revisit when

Apple ships a public API that returns the bounds chosen by `screencapture -i`, or when ScreenCaptureKit's region-picker becomes scriptable from a non-native process. Either would let us shed the overlay code and trust the OS HUD instead.
