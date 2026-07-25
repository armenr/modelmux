---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-25
last-modified: 2026-07-25
related: []
tags: [safety, hooks, fieldbook, gate, upstream-defect]
---

# The installed PreToolUse safety gate does not protect this repo, and a green response from it means nothing

**Observed:** 2026-07-25, immediately after the Fieldbook v0.8.2 install, while verifying the
assembled `.claude/hooks/pretooluse-safety-gates.sh`. Probed by feeding the hook JSON on stdin
and reading its verdict — the hook is a text classifier, so nothing was executed, no remote was
contacted, and every probe target was a path that does not exist. The kit maintainer
(`fieldbook`) reproduced the core defect on the origin kit and has issued a standing interim
disclosure to all adopters: **assume the gate provides no protection** until a rewrite lands.
Seven trees found eight evasion classes in a gate whose own upstream battery was 18/18 green.

Verified FIRSTHAND on this tree (probe scripts under `See also`):

| Class | Result here |
|---|---|
| force-push naming the protected branch | DENY — the one form that works |
| force-push with no refspec (long and short flag) | ALLOW, no decision emitted |
| leading-`+` refspec (a force push carrying **no force flag**) | ASK only — downgraded, not denied |
| `--mirror` (implicit force over every ref) | ALLOW, wholly ungated |
| tab in place of the single literal space between `git` and `push` | ALLOW — and **only** in that gap |
| `sudo` / `env` prefix | ALLOW |
| `-c` option form before the verb | ALLOW |
| `switch -C`, `branch -D`, `update-ref -d` on a protected name | ALLOW |
| any safe-list token (e.g. the bare word `coverage`) anywhere in the command | recursive-delete guard DISARMED |

**Root cause:** the gate matches against the **command text** rather than a parsed argv, and its
recursive-delete rule is an **absence-negation** — it greps the whole command string for a safe
token and stands down if one appears. So every guard is a substring, every fix is another
substring, and the safe token need not be in the target at all: it disarms from a trailing
comment, or from an entirely unrelated command joined on the same line. The force rules key on
the force **flag**, so force spellings that carry no flag (leading-`+` refspec, `--mirror`) are
never classified as force in the first place — a rule-content gap sitting underneath the
matcher-design gap.

**Workaround / fix:** none locally, by policy. Treat this repo's destructive-command safety as
**discipline plus git history**, not enforcement. The upstream remedy is a rewrite (tokenize over
parsed argv, presence-conjunction anchored on the verb, path-anchored safe tokens, refspec
resolution, force-classification covering leading-`+` and mirror, deny-tier) shipping as its own
release after v0.8.3. v0.8.3 explicitly does **not** touch the gate.

**Avoid:**
- Do **not** patch `.claude/hooks/pretooluse-safety-gates.sh`. It is kit-owned with merge
  semantics and an exact manifest hash; a local patch diverges a security file and turns every
  future upgrade into a three-way merge on the file where a bad merge is least visible.
- Do **not** read a gate ALLOW as "this command is safe" — on this gate ALLOW is also what a
  disarmed rule looks like, and the two are indistinguishable from the output.
- Do **not** treat ASK as a block. Under a `bypassPermissions` configuration ASK is decorative,
  which is why the leading-`+` refspec downgrade matters as much as the outright holes.
- Do **not** name a test fixture, probe file, or scratch directory using a safe-list token
  (`coverage`, `.cache`, `/gen/`, `/build/`, or the node-ts additions `.next`, `.vite`, `.turbo`,
  `.astro`, `.nuxt`, `.svelte-kit`, `.parcel-cache`) — the fixture disarms the very gate it tests
  and reviews clean.
- Do **not** point a destructive probe at `/tmp` to make it "safe": `/tmp/` is in the safe-path
  set, so the control goes vacuous. Use a target that is **nonexistent by construction and
  outside the safe set**.

**See also:**
- **The evidence of record is the table above** — those verdicts were measured, not inferred, and
  the doc carries them so the claim stands without any external file. The reproduction aids
  (`probe_evasions.py`, `probe_tab.py`, `probe_refspec.py`, `probe_collision.py`; each feeds JSON
  to the hook and prints verdicts, none executes anything) are archived at
  `~/modelmux-backups/2026-07-25T-fieldbook-install/evidence/`. They were originally written to a
  harness job directory that is deleted with the job — a citation that would have dangled, and
  that the doc linter does **not** catch, because rule 8 validates `related:` front-matter and not
  See-also prose.
- The `SAFE_PATHS` construction is at `.claude/hooks/pretooluse-safety-gates.sh` — note the
  `SAFE_PATHS_EXTRA` seam, which is the documented extension point each stack pack appends to,
  so the disarm surface grows by design with every pack.
- Upstream coordinator ruling and interim disclosure: `fieldbook`, 2026-07-25, partyline room
  `~/rooms/crates`, message `c36abe6d`.
