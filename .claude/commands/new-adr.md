---
description: Scaffold a new Architecture Decision Record with the next sequential number. Usage; /new-adr <kebab-title>
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# New ADR

Create the next-numbered ADR file in `docs/adr/` using the project's standard template.

## Steps

1. **Find the next number.** List `docs/adr/`; pick the highest `NNNN-` prefix and add 1, zero-padded to 4 digits. (Skip `README.md`.)

2. **Get the title.** Use `$ARGUMENTS` as the kebab-title (e.g., `add-system-audio-helper`). If empty, ask once: "What's the decision?" — then convert their answer to kebab.

3. **Write `docs/adr/NNNN-<kebab-title>.md`** with this template, filling in the obvious slots from the user's recent context:

   ```markdown
   # NNNN — <Human Title>

   **Date:** <today YYYY-MM-DD>
   **Status:** Proposed

   ## Context

   <1–2 paragraphs on what forced the decision: constraint, deadline, prior failure.>

   ## Decision

   <What we chose, in 1–2 sentences.>

   ## Consequences

   **Enables:**

   - <bullet>

   **Costs:**

   - <bullet>

   ## Alternatives considered

   - **<Name>** — <one-line reason it was ruled out>
   ```

4. **Update [docs/adr/README.md](../../docs/adr/README.md):** add `- [NNNN — <Human Title>](NNNN-<kebab>.md)` under the **Index** section in numerical order.

5. **Tell the user** the file path and remind them to flip Status from `Proposed` to `Accepted` once the decision is final and merged.

## Format rules

- Number is zero-padded 4 digits: `0003`, not `3` or `003`.
- Title in filename is kebab-case; in the heading it's prose.
- ADR files are short — one screen ideally. Push details into linked source files or design docs.
- Write the _why_, not the _how_. Implementation belongs in the code.
