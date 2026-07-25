---
provenance: kit-template
created: 2026-07-03
paths: [".agent-docs/**"]
---

# Agent-docs rules (index & routing discipline)

The `.agent-docs/` tree is navigated by its indexes, not by raw directory listings. These rules keep the
index graph honest so progressive disclosure works — you reach a doc through routing, never by enumerating
files. Schema/frontmatter authority lives in `CONVENTIONS.md`; this file governs how the index is kept.

- **Route, don't browse.** Progressive disclosure is the load-bearing principle: reach a doc via its
  directory's `index.md` and the front-matter breadcrumb graph (`tags:` / `related:` / `superseded-by:` /
  `archived-from:`), not by listing directories. Never bulk-load an `_archive` snapshot — follow the
  `archived-from:` pointer.
- **Creating or retiring ANY doc in a managed content dir** (`now/ decisions/ checkpoints/ lessons/
  reference/ research/ dispatch-charters/ traceability/ memories/ incidents/ experiments/ runbooks/
  templates/` + populated nested dirs — whichever exist in your installed profile) ⇒ **update that dir's
  `index.md` in the same change.** Entry = what-it-holds + *Open when:* + *Carry-away:*. Some indexes are
  ledger TABLES (add a row); a triage index carries severity · status · owner.
- **Carry-away claims must be traceable to the source doc** — never approximate from memory; a wrong
  carry-away is worse than no entry.
- **Root `.agent-docs/index.md` is directory-level only** — touch it only when a directory is added/removed
  or its organizing principle changes. No new top-level category without an ADR.
- **The lessons MOC is the bounded Tier-1 surface** — an accepted lesson (`LP-NNN`) gets BOTH a possible MOC
  row AND a `lessons/index.md` entry; the index never replaces the MOC.
- **Checkpoints are WRITE-ONLY** — a checkpoint is never edited after write; new information = a NEW
  checkpoint referencing the prior. **ADRs supersede, never delete** — `status: superseded` +
  `superseded-by:`, not removal.
- **Reference by ID, don't duplicate content** — cite the `WU-/ADR-/OQ-/LP-` ID, not a body excerpt; the ID
  resolves to the current doc even after supersession.
- **The lint will catch you otherwise** — the index/schema lint runs at SessionStart (warn) and at
  pre-commit (the git pre-commit hook), and is fixed as a byproduct at `/flush` (touched dirs) / `/handoff`
  (all).
- Frontmatter/schema authority stays `CONVENTIONS.md`; provenance discipline per standing rules (new docs =
  `llm-draft`; accepted ADRs cannot be `llm-draft` / `llm-autonomous`). Dates are LOCAL (`date +%Y-%m-%d`);
  UTC only for machine-sortable filenames.
- **Never commit secrets, credentials, or regulated / user data** into `.agent-docs/` — it's git-tracked.
  Reference paths / keys, never literal values (`sensitive-data.md`).

## Related

- `CONVENTIONS.md` (the schema contract) · `standing-rules-core.md` (§context lifecycle, §provenance) ·
  `sensitive-data.md`
