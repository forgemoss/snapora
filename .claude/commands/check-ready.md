---
description: Run the full pre-PR check suite — format, lint, typecheck, tests, build. Reports each as pass/fail with the failing line if any.
allowed-tools:
  - Bash
---

# Check ready

Run the same gates that CI will run, in the same order. Stop on the first failure and report it concisely so the user can fix and re-run.

## Steps

1. `npm run format:check` — Prettier
2. `npm run lint` — ESLint (`--max-warnings=0`)
3. `npm run typecheck` — TypeScript noEmit on both project references
4. `npm test` — Vitest unit tests
5. `npm run build` — electron-vite production build (catches Rollup-only failures that don't show up in `tsc`)

If anything is red:

- For format: suggest `npm run format` (auto-fix).
- For lint: print the first 3 violations.
- For typecheck: print the first 3 errors.
- For tests: print the failing test names.
- For build: print the bundler error.

If all green: report "✅ ready to push" and prompt: "open a PR or commit more changes first?"

Do not commit or push. Reporting only.
