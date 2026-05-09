# CLAUDE.md

Project context for Claude Code. Loaded into every session — keep it short.

## What is this

**Snapora** — open-source CleanShot X alternative for macOS, under the [forgemoss](https://forgemoss.com) umbrella. Electron 33 + React 19 + TypeScript + Tailwind v4. Working tray, global hotkeys, screenshot pipeline shelling out to `/usr/sbin/screencapture`. Recording (ffmpeg), OCR (tesseract), cloud upload, annotation editor — all stubbed for future milestones.

## Hard rules (do not break)

1. **No native code we write.** No Swift / Obj-C. Native capabilities come from system CLIs and bundled binaries. (Why: ADR-0001 — keeps the contributor pool wide.)
2. **Main process is CJS, not ESM.** No `"type": "module"` in `package.json`. (Why: ADR-0002 — Electron 33 ESM main has a CJS-preparser bug. Revisit when Electron upstream fixes it.)
3. **Pure-ESM-only deps don't work in main.** They need a homegrown replacement or `dynamic import()`. (E.g., we replaced `electron-store` with [src/main/storage/prefs.ts](src/main/storage/prefs.ts).)
4. **`main` is protected.** Every change goes through a feature branch + PR. CI must be green before merge. Squash merges only.

## Where things live

| Need to…                                    | Read this                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Understand process model, IPC, windows      | [docs/architecture.md](docs/architecture.md)                                                                   |
| Understand a past design decision           | [docs/adr/](docs/adr/)                                                                                         |
| See what's planned and what's done          | [ROADMAP.md](ROADMAP.md)                                                                                       |
| Follow naming + branch + commit conventions | [CONTRIBUTING.md → Conventions](CONTRIBUTING.md#conventions)                                                   |
| Add an IPC channel correctly                | [docs/architecture.md → Adding an IPC channel](docs/architecture.md#adding-an-ipc-channel) — or run `/new-ipc` |
| Record a new architectural decision         | [docs/adr/README.md](docs/adr/README.md) — or run `/new-adr`                                                   |

## Stack at a glance

- **Shell:** Electron 33 + electron-vite (build) + electron-builder (package)
- **Main / preload:** TypeScript → CJS bundle, externalized deps via `node_modules/`
- **Renderer:** React 19 + Tailwind v4 + Konva (annotation editor, v0.3+) — sandboxed, contextIsolation on
- **Storage:** JSON file for prefs (`~/Library/Application Support/snapora/preferences.json`), SQLite (better-sqlite3) for capture history (v0.2+)
- **Testing:** Vitest (unit), Playwright (e2e)
- **Logging:** electron-log → `~/Library/Logs/snapora/main.log`

## Common commands

```bash
npm run dev         # launch with HMR
npm run build       # production bundle
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run format      # prettier write
npm run dist        # build + DMG (signed if Apple secrets present)
```

## Workflow

1. Check ROADMAP.md or open issues, pick a task.
2. Branch off main: `feat/<area>-<description>` / `fix/...` / `docs/...` / `chore/...`
3. Code, following [CONTRIBUTING.md](CONTRIBUTING.md) conventions.
4. Run `npm run lint && npm run typecheck && npm test && npm run format:check`.
5. Commit with [Conventional Commits](https://www.conventionalcommits.org): `feat(capture): ...`
6. Push, open PR against `main`, wait for CI green, squash merge.
7. CHANGELOG.md is maintained by maintainers — don't edit it in feature PRs.

## Tooling specific to this project

- `.claude/agents/electron-troubleshooter.md` — debugging Electron-specific runtime/build issues
- `.claude/commands/new-ipc.md` — scaffold all four files for a new IPC channel
- `.claude/commands/new-adr.md` — scaffold a numbered ADR
- `.claude/commands/check-ready.md` — run the full pre-PR check suite
