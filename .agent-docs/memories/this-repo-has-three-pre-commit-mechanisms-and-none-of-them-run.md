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
