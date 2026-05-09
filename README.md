<div align="center">

<img src=".github/assets/logo.svg" alt="Snapora" width="120" />

# Snapora

**The free, open-source screenshot, screen-recording, and annotation app for macOS.**

A community-built, MIT-licensed alternative to [CleanShot X](https://cleanshot.com), [Shottr](https://shottr.cc), and [Xnapper](https://xnapper.com).

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS%2013%2B-lightgrey.svg)](#requirements)
[![CI](https://github.com/forgemoss/Snapora/actions/workflows/ci.yml/badge.svg)](https://github.com/forgemoss/Snapora/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/forgemoss/Snapora?include_prereleases&sort=semver)](https://github.com/forgemoss/Snapora/releases)
[![Downloads](https://img.shields.io/github/downloads/forgemoss/Snapora/total.svg)](https://github.com/forgemoss/Snapora/releases)
[![GitHub stars](https://img.shields.io/github/stars/forgemoss/Snapora.svg?style=flat&label=stars)](https://github.com/forgemoss/Snapora/stargazers)

[**Download**](#install) · [Features](#features) · [Snapora vs CleanShot](#snapora-vs-cleanshot-x) · [Roadmap](ROADMAP.md) · [Contributing](CONTRIBUTING.md)

</div>

---

<!-- TODO: drop a demo recording into .github/assets/demo.gif and re-enable the block below.
<div align="center">
  <img src=".github/assets/demo.gif" alt="Snapora demo — capture, annotate, share" width="800" />
</div>
-->

## Why Snapora?

Snapora is a **free and open-source replacement for paid screen-capture apps on macOS** — built for power users who want CleanShot-level polish without lock-in or subscriptions.

- **No subscription, no account required** — install and capture
- **No telemetry** — your captures stay on your Mac
- **Hackable by design** — TypeScript + Electron + React, the same stack any web developer already knows
- **Clean-room implementation** — built from public Apple docs and bundled OSS tools (`screencapture`, `ffmpeg`, `tesseract`); no decompiling, no leaked code

> **Status — pre-alpha.** The scaffolding is in place; most features are stubs. [Watch the repo](https://github.com/forgemoss/Snapora) to know when v0.1 ships.

## Features

> Items marked **✅** work today. Everything else is planned and tracked in [ROADMAP.md](ROADMAP.md).

- **Capture** — area, window, full-screen, scrolling
- **Annotate** — arrows, text, blur, pixelate, highlight, shapes, counters, crop
- **Record** — region / window / display with mic and webcam overlay; export MP4 or animated GIF
- **OCR** — extract text from any screenshot (bundled Tesseract or on-device)
- **Pin overlays** — float screenshots above any window for visual diffs
- **Quick-access HUD** — post-capture floating thumbnail with one-click actions
- **History** — searchable local SQLite, configurable retention
- **Global hotkeys** — fully rebindable
- **Menu-bar app** — no Dock clutter

Full feature reference: [docs/features.md](docs/features.md).

## Install

> 🚧 Pre-alpha — no installable build is published yet. The instructions below are the plan for v0.1.

Snapora ships in two phases. **Until we sign builds (v1.0)**, installs need one extra step. Detailed walkthrough in [docs/install.md](docs/install.md).

### Phase 1 (v0.1+) — direct DMG, $0

Grab the latest `Snapora-<version>-arm64.dmg` (Apple silicon) or `-x64.dmg` (Intel) from the [Releases page](https://github.com/forgemoss/Snapora/releases). Drag Snapora to Applications, then run once in Terminal:

```bash
xattr -cr /Applications/Snapora.app
```

Open Snapora normally — the first-run wizard handles permissions. The `xattr` command clears macOS's "unidentified developer" warning that fires on unsigned apps. One-time per install, not per launch.

### Phase 2 (v1.0+) — signed + notarized + Homebrew

Once the Apple Developer Program ($99/yr) is wired in:

```bash
brew install --cask snapora
```

Zero warnings, zero terminal steps, auto-updates via electron-updater.

### Permissions

On first launch the **first-run wizard** walks you through Screen Recording (required), Microphone (optional, for recording), and Camera (optional, for webcam overlay). Screen Recording grants take effect after **quit and relaunch** — that's a macOS rule, not a Snapora bug, and the wizard handles the prompt.

## Snapora vs CleanShot X

|                              |        **Snapora**        |                CleanShot X                 |     Shottr      |
| ---------------------------- | :-----------------------: | :----------------------------------------: | :-------------: |
| Price                        |         **Free**          | $29 (single seat, lifetime) + $10/mo cloud | Free + paid pro |
| Open source                  |        **✅ MIT**         |                     ❌                     |       ❌        |
| Telemetry                    |         **None**          |                    Some                    |      Some       |
| Account required             |          **No**           |                  Optional                  |       No        |
| Auto-updates                 | ✅ (via electron-updater) |                     ✅                     |       ✅        |
| Screen recording (MP4 / GIF) |          Planned          |                     ✅                     |     Limited     |
| OCR                          |          Planned          |                     ✅                     |       ✅        |
| Pinned overlays              |          Planned          |                     ✅                     |       ✅        |
| Annotation editor            |          Planned          |                     ✅                     |       ✅        |

**Honest take:** CleanShot X and Shottr are excellent native apps and worth supporting if you can. Snapora exists for people who want the same workflow without paying, want to read and modify the source, or want a tool that's auditable and hackable end-to-end.

## Quick start

After installing:

1. Click the Snapora icon in your menu bar.
2. Press <kbd>⌘</kbd><kbd>⇧</kbd><kbd>2</kbd> to capture an area, <kbd>⌘</kbd><kbd>⇧</kbd><kbd>3</kbd> for a window, or <kbd>⌘</kbd><kbd>⇧</kbd><kbd>4</kbd> for the full screen.
3. The capture appears in the Quick Access HUD — copy, save, or open the editor for annotations.
4. Configure shortcuts and save folder in **Settings…** (⌘,).

## Build from source

**Requirements:** macOS 13+, [Node.js 20+](https://nodejs.org), and either npm or pnpm.

```bash
# clone
git clone https://github.com/forgemoss/Snapora.git
cd Snapora

# install dependencies (rebuilds native modules for Electron)
npm install

# launch in development with hot-module reload
npm run dev
```

### All scripts

```bash
npm run dev         # launch the app in development with HMR
npm run build       # production build (unsigned)
npm run dist        # build + package macOS DMG (signed if certs present)
npm run lint        # ESLint
npm run format      # Prettier (write)
npm run typecheck   # TypeScript noEmit
npm test            # Vitest unit tests
npm run e2e         # Playwright end-to-end (Electron)
```

Or use the Makefile shorthand: `make dev`, `make build`, `make test`, etc.

### Architecture

```
src/
├── main/        # Node — tray, hotkeys, capture pipeline, IPC handlers, child processes
├── preload/     # contextBridge — typed IPC API exposed safely to the renderer
├── renderer/    # React + Tailwind + Konva — editor, settings, HUD, first-run wizard
└── shared/      # types & IPC channels imported by both sides

build/           # electron-builder resources (entitlements, notarize hook, icon)
resources/       # bundled binaries — ffmpeg, tesseract — populated at build time
```

The capture pipeline shells out to macOS's built-in `/usr/sbin/screencapture` and bundles `ffmpeg`/`tesseract` for advanced flows. We don't write native macOS code; we orchestrate system tools and bundled OSS binaries. See [docs/features.md](docs/features.md) for the full implementation map.

## Roadmap

A short summary — see [ROADMAP.md](ROADMAP.md) for the full plan.

| Milestone | Theme                                                       |
| --------- | ----------------------------------------------------------- |
| **v0.1**  | MVP: working area capture + tray + hotkeys + signed release |
| **v0.2**  | All capture modes + history view                            |
| **v0.3**  | Annotation editor (Konva)                                   |
| **v0.4**  | Screen recording (ffmpeg)                                   |
| **v0.5**  | Pinned overlays + OCR + quick-access HUD                    |
| **v0.6**  | Cloud upload (S3, R2, B2, WebDAV, custom)                   |
| **v1.0**  | Auto-update, notarized, on Homebrew Cask                    |

## Contributing

Issues, design discussions, and PRs are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR — there are specific rules around clean-room provenance.

**Important:** do **not** decompile, disassemble, or otherwise reverse-engineer any commercial screenshot app and submit derived code. Snapora must remain a clean-room implementation. PRs with tainted provenance will be rejected.

## Support the project

If Snapora is useful to you:

- ⭐ **Star this repo** — it's the single biggest signal that the project is worth maintaining
- 💬 [Open an issue](https://github.com/forgemoss/Snapora/issues/new/choose) with feedback or feature requests
- 🛠 [Pick a roadmap item](ROADMAP.md) and send a PR
- 💖 [Sponsor the project](https://github.com/sponsors/forgemoss) — funds notarization fees, hosted-cloud infrastructure, and contributor time

## Star history

<a href="https://star-history.com/#forgemoss/Snapora&Date">
  <img alt="Star history chart" src="https://api.star-history.com/svg?repos=forgemoss/Snapora&type=Date" width="640" />
</a>

## Other forgemoss projects

Snapora is the first of a series of open-source alternatives to popular paid Mac apps under [forgemoss](https://forgemoss.com). More are on the way — [follow the org](https://github.com/forgemoss) to be notified.

## License

[MIT](LICENSE) © [forgemoss](https://forgemoss.com) and Snapora contributors.

---

<sub>Snapora is not affiliated with, endorsed by, or sponsored by the developers of CleanShot X, Shottr, Xnapper, or any other screen-capture app. All trademarks belong to their respective owners.</sub>
