# 0004 — Bundling ffmpeg

**Date:** 2026-05-10
**Status:** Accepted

## Context

Screen recording (v0.4) requires capturing the framebuffer at video frame
rates plus an avfoundation audio device. Two userland-friendly paths exist:

- Use Apple's `ScreenCaptureKit` framework via Swift / Obj-C
- Bundle `ffmpeg` and shell out to its `avfoundation` input driver

Hard rule #1 in [CLAUDE.md](../../CLAUDE.md) forbids native code we write.
ScreenCaptureKit is Swift-only, so it's off the table. ffmpeg is a system CLI

- binary we can ship — exactly the model the rule allows.

Electron's `desktopCapturer` + `MediaRecorder` is in-renderer, low quality,
and can't reliably mux audio for long recordings — explored and rejected.

## Decision

Snapora ships a static `ffmpeg` binary at `resources/bin/ffmpeg-{arm64,x64}`,
bundled via `electron-builder`'s `extraResources` block.

- **Source:** [evermeet.cx](https://evermeet.cx/ffmpeg/) — the long-running
  community service for static macOS ffmpeg builds. Static = no dylib deps =
  signs cleanly with `cs.disable-library-validation` (already in the
  entitlements file).
- **Architecture caveat:** evermeet currently publishes x86_64 only. It runs
  via Rosetta 2 on Apple silicon. ffmpeg's avfoundation pipeline stays within
  ~10% of native under Rosetta; users of recording features will be on Macs
  modern enough that this is acceptable. When an arm64-native upstream
  stabilizes (osxexperts.net is the most likely candidate), bump
  `scripts/manifest.json`.
- **Pinning:** `scripts/manifest.json` records URL + sha256 per arch. The
  fetcher (`scripts/prepare-resources.mjs`) downloads, verifies, and refuses
  to ship a binary that doesn't match the locked sha. First run with an
  empty sha writes the discovered hash back.
- **Resolved at runtime:** `src/main/capture/binaries.ts` returns
  `<app>.app/Contents/Resources/bin/ffmpeg` in production and
  `resources/bin/ffmpeg-{arch}` in dev (`app.getAppPath()`).

## Consequences

**Enables:**

- Recording, GIF export, video thumbnail extraction (HUD recording cards),
  and future trim functionality — all from one binary.
- Future `tesseract` (OCR, v0.5) and `gifski` (if we want better GIFs) follow
  the same fetch-and-verify pattern.

**Costs:**

- ~80 MB DMG bloat per arch.
- LGPL 2.1+ obligations satisfied by shipping the LICENSE next to the binary
  and pointing at upstream sources. Snapora's own MIT code does not link
  against ffmpeg sources at compile time.
- Code-signing implications when v1.0 lands: the binary needs signing too.
  electron-builder handles this when `binaries: ['Contents/Resources/bin/ffmpeg']`
  is added to the mac config and `hardenedRuntime: true`. Pre-signed.

## Revisit when

- Apple ships a public, scriptable ScreenCaptureKit interface.
- Native arm64 static ffmpeg builds become canonical.
- The DMG size becomes a customer complaint.

## Alternatives considered

- **`ScreenCaptureKit` via Swift helper** — forbidden by hard rule #1.
- **`desktopCapturer` + `MediaRecorder`** — quality hit, audio mux fragility,
  long-recording memory issues. Rejected.
- **Bundle `gifski` for GIF export instead of ffmpeg's palette method** —
  better quality but +5 MB, and the palette method is good enough.
- **Build ffmpeg from source in CI** — too much CI work for v0.4. evermeet is
  trusted enough.
