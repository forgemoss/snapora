# .claude/

Project-level configuration for [Claude Code](https://claude.com/claude-code). Anything in this folder applies to all contributors who use Claude Code in this repo.

## What's here

- **[settings.json](settings.json)** — committed Claude Code settings: a permission allowlist for safe read-only commands so the assistant doesn't prompt on every `npm test` etc.
- **[agents/](agents/)** — project-specific subagents Claude can spawn for specialized tasks. Each `.md` file is one agent.
- **[commands/](commands/)** — custom slash commands. Type `/new-ipc` or `/new-adr` etc. to invoke.

The companion `CLAUDE.md` (at the repo root) is the always-loaded project context. Edit that when project rules change so future sessions inherit the update.

## What's NOT here

- `settings.local.json` — personal, machine-local Claude settings. **Gitignored.** Use it for per-developer permission allowlists or hooks you don't want to share.
- User-level memory — that lives outside the repo at `~/.claude/projects/...` and is per-user.

## When to add things here

| Situation                                        | What to add                                       |
| ------------------------------------------------ | ------------------------------------------------- |
| New convention or repeated mistake to enforce    | Update `CLAUDE.md`                                |
| Repetitive multi-step task (scaffolding, checks) | Add a slash command in `commands/`                |
| Specialized debugging or review pattern          | Add a subagent in `agents/`                       |
| Hook (auto-format on edit, etc.)                 | Add to `settings.json` `hooks` block              |
| Permission noise from a routine command          | Add a glob to `settings.json` `permissions.allow` |

Keep `CLAUDE.md` short — it loads into every conversation and costs tokens. Push details into `docs/` and link to them.
