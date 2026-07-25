---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-25
last-modified: 2026-07-25
related: []
tags: [tooling, git-hooks, quality-gates, false-confidence, gotcha]
---

# This repo has THREE pre-commit mechanisms and NONE of them run — commits pass a gate that does nothing

**Observed:** 2026-07-25, after nine consecutive commits each printed
`` `.pre-commit-config.yaml` config file not found. Skipping `pre-commit`. `` and exited 0. Traced to
the end rather than assumed. All three mechanisms are present in the tree; none enforces anything:

| Mechanism | State | Why it doesn't run |
|---|---|---|
| `lefthook.yml` (repo root) | declares `eslint` on pre-commit, `commitlint` on commit-msg, `bun test test/` on pre-push | **lefthook is not installed** — absent from `package.json`, not on `PATH`, no hook registered with git |
| `.githooks/pre-commit` | Fieldbook's path-aware dispatcher: doc-lint for `.agent-docs/**`, `bun run lint` for code | `core.hooksPath` is **unset**, so git never looks in `.githooks/`. Needs the one-time `bash .claude/hooks/install-hooks.sh` |
| `.git/hooks/pre-commit` | a **pre-commit.com** shim (generated 2026-07-21) | invoked with `--skip-on-missing-config`, and there is no `.pre-commit-config.yaml` → **skips and exits 0** |

Git runs the third. **It fires on every commit, does nothing, and always succeeds.** That is strictly
worse than having no hook: `git commit` prints a reassuring line and the repo *looks* gated.

**Root cause — a false premise recorded at install time.** `.agent-docs/.kit-manifest.json` `notes`
says Phase 6.2 was *"DELIBERATELY SKIPPED: target uses lefthook, whose pre-commit lives in
`.git/hooks/`. Setting `core.hooksPath` would disable lefthook's eslint/commitlint/pre-push gates."*
The premise is false — lefthook was never installed, so there were **no gates to disable**. The install
read a **config file's presence as evidence its tool was live**, declined to wire the working
dispatcher in order to protect something that does not exist, and left the repo ungated.

Generalized (and it is the same error as reading a blank `grep` as absence — evidence about the query,
not about the world): **a config file's presence is not evidence its tool is installed.** The cheap
check was available: is the binary resolvable, is a hook actually registered.

**Workaround / fix:** pick ONE mechanism — they are mutually exclusive, since `core.hooksPath` and
lefthook's `.git/hooks/` registration cannot both win:
- **Fieldbook dispatcher (recommended):** `bash .claude/hooks/install-hooks.sh`. **Script read
  firsthand 2026-07-25**, so this recommendation is not a relayed claim: it sets
  `core.hooksPath=.githooks` (**local config, never committed** — every clone re-runs it),
  **RENAMES** the stale `.git/hooks/pre-commit` to `…stale-disabled-<timestamp>` rather than deleting
  it — specifically so a later `git config --unset core.hooksPath` cannot silently reactivate an old
  divergent gate — then **self-verifies and exits 1** if `core.hooksPath` didn't take. Idempotent.
  Undo is one line: `git config --unset core.hooksPath`. Path-aware in use, so doc commits run
  doc-lint and code commits run `bun run lint`.
  - *Caveat:* this renames the **pre-commit.com** shim. Harmless here (it does nothing), and it is
    repo-local so other repos are unaffected — but if pre-commit.com is ever wanted in THIS repo it
    needs a `.pre-commit-config.yaml`, which is what it has always been missing.
- **lefthook:** `bun add -d lefthook && bunx lefthook install`. Then `core.hooksPath` must stay unset,
  and the `.githooks/` dispatcher stays dormant.

Either way, **verify by making the gate fail on purpose** — a hook you have never watched block a
commit is a hypothesis, not a gate.

### ⚠️ Installing the dispatcher does NOT gate all four gates — read this before believing you're covered

Wiring the hook fixes *nothing runs*. It does **not** mean *everything is checked*. Measured by reading
`.githooks/pre-commit` (not inferred):

| Staged | Gate that runs | Blocks? |
|---|---|---|
| `.agent-docs/**/*.md` | `python3 lint-docs.py` + index-completeness | **yes** |
| code files | `bun run lint` | **yes** |
| code files | *format gate* — wired to the **empty string** (`FMT_CMD` is deliberately empty; no format script exists) | no — "gate empty → skipped" |
| anything outside `.agent-docs/` | doc-refs sweep | **no — advisory by contract, never touches `rc`** |

**`bun test test/`, `tsc --noEmit`/typecheck, and `bun run build` appear ZERO times in the hook.** Grep
count is 0 for each. They stay **manual**. (`lefthook.yml` would give `bun test test/` on *pre-push* —
but lefthook isn't installed, and its `core.hooksPath` conflict makes the two mutually exclusive.)

**Second trap in the same file:** `REQUIRED_GATE_TOOLS` defaults to **empty**, and a gate whose tool is
missing from `PATH` is **skipped, not blocked** — only labels named in that variable block on absence.
So a broken toolchain passes silently by default. Set `REQUIRED_GATE_TOOLS="lint"` if you want a missing
`bun` to fail the commit rather than wave it through.

**And `FIELDBOOK_PRECOMMIT_BYPASS=1` skips every gate** — an intentional emergency exit that announces
itself loudly, but it exists.

> The generalized lesson, and the reason this section exists: **verifying that a hook is INSTALLED is
> not verifying that it CHECKS anything**, and the two are indistinguishable from the install side. A
> peer repo hit the mirror image of this repo's defect — correctly installed hook, fires on every
> commit, scrolls green, and never contained the test command at all, so their ~2722 tests had never run
> in any automated context. Same end state, opposite cause: *the repo looks gated.*

**Avoid:**
- Do **not** read "the pre-commit hook ran" as "the gates ran". Until this is fixed, `bun run lint` /
  `bun run typecheck` / `bun test test/` / `bun run build` must be run **by hand** before every commit;
  they are the only real verification. Every gate claimed green on 2026-07-25 was run manually.
- Do **not** trust `lefthook.yml`'s existence as evidence lefthook enforces anything here.
- Do **not** set `core.hooksPath` *and* install lefthook expecting both — the last one configured wins
  and the other silently stops running, reproducing exactly this failure.

**See also:** `reference/fieldbook-install-reconstitution.md` (what the install did and skipped);
`memories/installed-safety-gate-does-not-protect-this-repo.md` and
`memories/doc-lint-clean-is-a-partial-claim-kit-template-provenance-disables-four-rules.md` — the same
family, instruments that appear to protect this tree and do not.
