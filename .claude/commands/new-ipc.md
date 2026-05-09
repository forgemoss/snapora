---
description: Scaffold a new IPC channel — adds the constant, type, preload binding, and main-process handler in one go. Usage; /new-ipc <scope>:<action> [- short description]
allowed-tools:
  - Read
  - Edit
  - Grep
---

# New IPC channel

Scaffold a new IPC channel across all four files that need to know about it. The argument is the channel name in `scope:action` form, optionally followed by `-` and a short description.

Examples:

- `/new-ipc capture:cancel-current` — main-side cancellation
- `/new-ipc history:list - returns recent captures`
- `/new-ipc upload:start - begins an async upload`

## Steps

1. **Parse arguments** — split `$ARGUMENTS` on `-` to get the channel name (`scope:action`) and optional description. Validate format: must match `/^[a-z]+:[a-z][a-z-]*$/`.

2. **Determine the input/output types.** Ask the user once if not obvious from context: what does the renderer pass, what does the main process return? Default to `void → void` if the user says "just an event."

3. **Edit [src/shared/ipc.ts](../../src/shared/ipc.ts):**
   - Add the channel string to the `IPC` constants object under the right scope (create the scope object if new).
   - Add the matching method signature to the `SnaporaApi` interface (under the same scope).

4. **Edit [src/preload/index.ts](../../src/preload/index.ts):**
   - Add the bridge method that calls `ipcRenderer.invoke(IPC.<scope>.<action>, ...args)`.
   - Match the exact signature from `SnaporaApi`.

5. **Edit [src/main/ipc/handlers.ts](../../src/main/ipc/handlers.ts):**
   - Add `ipcMain.handle(IPC.<scope>.<action>, async (_evt, ...args) => { /* TODO */ })` with a TODO body referencing the appropriate roadmap milestone.
   - Import any types it depends on from `@shared/types`.

6. **Run typecheck** — `npm run typecheck`. If it fails, fix the errors before declaring done.

7. **Summarize** — list the four files touched and the next step (implement the handler body).

## Conventions

- Channel names use `:` between scope and action. Action uses kebab-case if multi-word: `capture:cancel-current`, not `capture:cancelCurrent`.
- Renderer-facing API uses camelCase methods: `cancelCurrent`, not `cancel-current`.
- Always go through the typed `IPC` constants — never inline the string in handlers or preload.
