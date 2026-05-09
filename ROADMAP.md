# Snapora Roadmap

Living document. Order is approximate build order; milestones may shuffle.

## v0.1 — "It captures something" (MVP)

Goal: prove the core capture pipeline end-to-end on a real Mac.

- [x] Project scaffold (Electron + Vite + React + TypeScript + Tailwind)
- [x] UI foundation (Tailwind theme, Button + Card primitives, Window shell layout)
- [x] Tray menu + status item with template icon
- [x] Global hotkey registration
- [x] Area / window / fullscreen screenshot via `screencapture`
- [x] Save to disk + copy to clipboard
- [x] `snap://` custom protocol for safely loading captures in the renderer
- [x] Quick Access HUD — post-capture floating panel with Copy / Save / Edit (was v0.5)
- [x] First-run permission wizard (Screen Recording, Mic, Camera)
- [x] Basic preferences window
- [ ] **Initial unsigned release** — DMG via GitHub Releases + own Homebrew tap (`forgemoss/snapora`); README documents the one-time Gatekeeper bypass

## v0.2 — Capture modes

- [ ] Window capture (`screencapture -W`)
- [ ] Full-screen per-display
- [ ] Self-timer (3 / 5 / 10s)
- [ ] Hide desktop icons toggle
- [ ] Capture history (SQLite, browsable, configurable retention)

## v0.3 — Annotation editor

- [ ] Konva-based editor canvas
- [ ] Tools: arrow, line, rectangle, ellipse, freehand, text, highlight, blur, pixelate, counter, crop
- [ ] Undo/redo
- [ ] Export PNG / JPG / WebP / PDF

## v0.4 — Screen recording

- [ ] Region/window/display recording (bundled ffmpeg + avfoundation input)
- [ ] Microphone input
- [ ] System audio (where macOS permits)
- [ ] Webcam overlay (floating window)
- [ ] GIF export (gifski or ffmpeg palette method)

## v0.5 — Pinned overlays + power features

- [ ] Pinned screenshot windows (transparent, always-on-top)
- [ ] OCR via Tesseract (bundled) or Tesseract.js (fallback)
- [ ] Color picker / measure tool
- [ ] Drag-out from HUD / pinned windows to any app

## v1.0 — Stability + polish

- [ ] **Signed + notarized releases** — Apple Developer Program ($99/yr) wired into CI (`MAC_CERT_P12`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` secrets); zero-warning installs
- [ ] Submit to **homebrew-cask** main repo (deprecate the `forgemoss/snapora` tap)
- [ ] electron-updater auto-update wiring
- [ ] Localization scaffold (en at minimum)
- [ ] DMG with custom background
- [ ] Documentation site (docs.forgemoss.com)
- [ ] Migration guide from CleanShot/Shottr (config import where feasible)

## Beyond

- [ ] Scrolling capture
- [ ] On-device AI (denoise, redact PII)
- [ ] Cloud upload providers (S3, R2, WebDAV, etc.) — deferred until v1.0 ships and demand is clear
- [ ] Windows / Linux ports (capture pipeline rewrite per OS)
