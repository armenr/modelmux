---
provenance: llm-reviewed
created: 2026-07-25
last-modified: 2026-07-25
related: []
tags: [reference, fieldbook, recovery, inventory, backup]
---

# Most of this install is REGENERABLE; only seven files earn a second copy

**What it is:** the recovery inventory for the Fieldbook install of 2026-07-25. It answers
"if this tree were damaged, what must be restored from a copy versus re-made from a
command?" — because copying is the expensive answer and it was the default one until this
was written down.

**Scope:** the `.agent-docs/` tree, the `.claude/` layer, `.githooks/`, the two kit
`scripts/`, `CLAUDE.md`, and both settings files.

## The rule this applies

Before copying any single-copy asset, ask whether it can be **re-made**. A credential wants
a reissue path, not a copy. A generated config wants a regenerate command, not a copy. Only
**authored work and real data** earn a second location. A copy of a regenerable file is
storage plus a staleness risk; the command is smaller, cannot go stale, and survives the
backup being lost too.

## REGENERABLE — do not restore these, re-make them

| What | How |
|---|---|
| The whole kit payload: `.agent-docs/` seed tree, `.claude/{rules,skills,hooks}`, `.githooks/pre-commit`, `scripts/{wu-refs,doc-refs}.sh` | Re-run the concierge from the kit pinned at `kit_ref` in `.agent-docs/.kit-manifest.json` (`30a0259`, tag `v0.8.2`), profile `standard`, stack `node-ts`. Clone the kit **fresh at that tag** — never from a working tree. |
| `.claude/settings.json` | Rebuilt by the concierge. Also now **tracked in git**, so git history is its second copy. |
| `.claude/settings.local.json` | `partyline wire /home/v3ct0r/Development/Personal/modelmux` rewrites it from scratch. Regenerate, do not restore. Ignored by BOTH this repo's `.gitignore` and a machine-level rule at `~/.config/git/ignore`. |
| `CLAUDE.md` | Partyline block from `partyline wire`; kit block from the kit's `base/minimal/CLAUDE.md.template` filled with the twelve scalars recorded in the manifest. |
| `.kit-backups/` | Pre-merge originals only. Redundant once `CLAUDE.md` is regenerable. |

## IRREPLACEABLE — these are the only files that earn a copy

Authored here, derivable from nothing:

- `.agent-docs/memories/installed-safety-gate-does-not-protect-this-repo.md` — nine measured
  gate verdicts. The measurements cannot be recovered from any tool; only re-measured.
- `.agent-docs/memories/index.md` — the authored routing row (the file itself is kit payload;
  the row is not).
- `.agent-docs/reference/fieldbook-install-reconstitution.md` — this file, and its index row.
- `.agent-docs/.kit-manifest.json` — the install **record**: per-file sha256, actions, backup
  paths, resolved tokens, and the deliberate Phase-6.2 skip with its reason. Re-running the
  install produces a *new* manifest, not this one; the rollback and idempotency ledger for
  what actually happened is lost with it.
- The four gate-probe scripts (`probe_evasions.py`, `probe_tab.py`, `probe_refspec.py`,
  `probe_collision.py`) — archived under `evidence/` in the backup below.

## OUT-OF-REPO DEPENDENCIES — invisible to every inventory command

`git status --ignored` is scoped to the **repo root**. Everything below sits outside it, so no
git inventory of this tree — including the corrected form — will ever list it. These are not
backups parked elsewhere; they are things this install *requires at runtime or at recovery*,
and a recovery plan that assumes them without naming them fails at the moment it is needed.

| Dependency | Why it matters | If it is gone |
|---|---|---|
| `~/.local/bin/partyline` | Baked as an **absolute path** into `settings.local.json` — both hooks and every allowlist entry | Rebuild from `~/Development/Personal/partyline`: `go build -o bin/partyline ./cmd/partyline && ./bin/partyline install`. Hooks fail closed-ish (they simply do not run), so the loss is SILENT. |
| `~/Documents/fieldbook` | The kit source this file's regeneration table tells you to clone at tag `v0.8.2` (`30a0259`) | **Not our repo** — another agent's tree. If it moves or is pruned, every "regenerable" row above becomes irrecoverable. The pinned SHA is worthless without a repo to fetch it from. |
| `~/rooms/crates/cursors/modelmux` | This agent's partyline read cursor — single-copy state, 7 bytes | Losing it re-delivers the entire room backlog on the next read (measured at 76 messages when this agent joined). Recovery is to re-seed it to the room file's current byte length, not to restore it. |
| `~/.config/git/ignore` | Machine-level ignore rule (`**/.claude/settings.local.json`) affecting this repo's posture | Harmless here — this repo carries its own `.gitignore:31` rule, so the posture is reproducible for other clones rather than machine-dependent. Verified with `check-ignore -v`, which names the deciding source; the `core.excludesFile` config lookup is a FALSE NEGATIVE on this machine and must not be used to rule it out. |

## Current second copy

`~/modelmux-backups/2026-07-25T-fieldbook-install/` — 87 files, byte-verified against source
with `cmp` rather than assumed. **Honest limit:** same machine, same disk. It protects
against a tree-level accident, not against machine loss.

## The inventory trap this file exists partly to record

`git status --porcelain --untracked-files=all` lists `??` entries and **structurally
excludes** gitignored (`!!`) files. Gitignored is precisely where single-copy-by-policy
assets live. Inventory with `git status --porcelain --ignored` (or `git ls-files --others`
*without* `--exclude-standard`), and resolve any ignore decision with `git check-ignore -v
<path>`, which names the deciding file and line — reading this repo's `.gitignore` is not
sufficient, because a rule may live in a machine-level excludes file outside the repo.

**Last verified:** 2026-07-25 — regeneration paths read from the manifest and the partyline
block; backup contents cmp-verified; ignore sources resolved with `check-ignore -v`.
