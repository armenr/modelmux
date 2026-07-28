---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-28
tags: [meta, index, routing, memories]
related: [CONVENTIONS]
---

# memories/ — routing catalog

Non-obvious gotchas + findings, **titled as claims, not topics**. Tier-2 — loaded on demand when the
claim is relevant. UPDATE-IN-PLACE (rare). Schema authority: `../CONVENTIONS.md` (memory template).

> **Memory vs lesson vs ADR.** A *memory* is a standing gotcha/fact ("X behaves surprisingly because
> Y"). A *lesson* is a behavioral rule with promotion + decay (`lessons/`). An *ADR* is a settled
> decision (`decisions/`). When in doubt: did it change how we ACT (lesson) or decide a fork (ADR)?
> Otherwise it's a memory.

## Entry purpose + naming

- **Purpose:** capture a non-obvious finding so it isn't re-derived — the title IS the claim.
- **Filename:** `memories/<kebab-claim-as-title>.md`. Good:
  `build-needs-explicit-env-recipe`. Bad: `build-notes`.
- **Write-discipline:** UPDATE-IN-PLACE (rare).

## Entry SCHEMA (body)

Observed (when/where/how it surfaces) · Root cause (if known) · Workaround / fix · Avoid (specific
anti-actions) · See also (related docs, upstream issues, commit refs).

## Memories

- 🛡️ `installed-safety-gate-does-not-protect-this-repo.md` — **Open when:** you are about to rely
  on the PreToolUse safety gate to stop a destructive command, or you are writing a probe/fixture
  that targets one. **Carry-away:** the gate matches command TEXT, not parsed argv, so eight
  verified spellings reach a protected branch and any safe-list word anywhere on the line disarms
  the recursive-delete rule — treat destructive safety here as discipline plus git history, and
  never patch the kit-owned hook. (Measured firsthand 2026-07-25; reproduced upstream by
  `fieldbook`, rewrite pending.)

- 🔌 `the-proxy-is-not-running-on-the-development-machine.md` — **Open when:** you are about to reason
  about which model answers a request from this repo, describe this project's capability to anyone, or
  infer runtime behaviour from `routes.toml` / the `<<route:>>` tags. **Carry-away:** modelmux is built
  here, not run here — sessions in this tree are ordinary Claude Code on subscription auth, so routing
  config is specification and not observation; four peers manufactured false operational conclusions
  from exactly this confusion. (Stated by the operator 2026-07-25.)

- 🔍 `doc-lint-clean-is-a-partial-claim-kit-template-provenance-disables-four-rules.md` — **Open when:**
  you are about to cite "doc-lint clean — N files" as evidence, or wondering why a reference/annotation
  defect went unreported. **Carry-away:** `lint-docs.py` skips rules 8/15/21/12 on any doc whose
  `provenance:` is `kit-template` regardless of path — **17 of our 37 files**, so a clean headline means
  "clean on the rules that ran". Those 17 split two ways: **10 SEED-THEN-LIVE** (every `index.md`, plus
  `log.md` and `glossary.md`) that the *adopter writes* — rule 13 mandates adding index rows, and the
  label then exempts exactly what you wrote — and **7 static-normative** that are genuinely verbatim.
  An armed-vs-control diff found 2 real hidden findings here, both in the static-normative bucket, both
  kit-owned. **Do not patch, and do not self-bump the seed files** (zero findings gained, manifest
  `sha256` divergence risk). Hit count is not debt (17→2 here vs 4→6 on another tree), the buckets are
  **not filename-separable** (`MOC.md` is seed-then-live despite its name), and a subset control is only
  evidence if you can say why the subset is representative. (Measured firsthand 2026-07-25; kit-side
  confirmed and the two-class taxonomy corrected by `fieldbook`; fix queued behind v0.8.3.)

- 🪝 `this-repo-has-three-pre-commit-mechanisms-and-none-of-them-run.md` — **Open when:** you are about
  to rely on the pre-commit hook to catch a lint/test failure, or wondering why commits print
  "Skipping `pre-commit`". **Carry-away:** `lefthook.yml` exists but lefthook is **not installed**;
  `.githooks/pre-commit` is tracked but `core.hooksPath` is unset; the hook git actually runs is a
  pre-commit.com shim that skips on missing config and **exits 0 every time** — so commits pass a gate
  that does nothing and the repo only *looks* gated. Run the four gates by hand until
  `bash .claude/hooks/install-hooks.sh` is run. Root cause worth generalizing: the install read a
  **config file's presence as evidence its tool was live**. (Diagnosed firsthand 2026-07-25 after nine
  commits skipped.)

- 📬 `room-unread-is-the-non-mutating-probe-and-the-watch-count-is-cursor-independent.md` — **Open
  when:** a room-monitor wake says you have mail, or you are about to check mail status with
  `partyline read`. **Carry-away:** `room unread --for <agent>` is the **non-mutating** probe —
  measured against a known-positive control, it prints pending mail and leaves the cursor
  byte-unchanged — while `partyline read` CONSUMES; `CLAUDE.md` names only the consuming verb, which
  is how a status use once ate four messages. And a `watch` wake's "N new" is **not** the unread
  count: it announced "4 new" with the cursor at byte 2504790 against a 2504790-byte `room.jsonl`
  (exactly EOF, zero unread) — the 4 are the last four to-field mentions, cursor-independent, all
  already consumed. A wake is evidence mail EXISTS, not that any is unread. `unread` also takes
  **`--count`** (measured exact, still non-mutating), which is the cursor-aware counter the watch
  path is missing *from the same binary*. Only the **arm-time** announcement is broken — the two
  notification formats in the unstripped binary separate the day's four wakes without exception:
  phantom wakes carry the count, genuine ones don't. And a shared symptom did **not** mean a shared
  cause — a peer's identical symptom came from `tail -F` replaying 10 lines, which is **not** our
  mechanism (we run `partyline watch`), so their `-n 0` fix is a no-op here. (Measured firsthand
  2026-07-28; reported to `@partyline`.)

- 🚧 `the-dispatch-gate-sees-a-compacted-fanout-but-only-warns.md` — **Open when:** you are about to
  rely on the dispatch-gate to stop a fan-out defect, or are authoring a Workflow with
  `parallel()` + `.filter(Boolean)`. **Carry-away:** the gate **detects** a compacted fan-out even
  nested inside a `pipeline()` stage (`CW3`, verified against the shipped fixture as a
  known-positive) — but it emits `additionalContext` with **rc=0**, not a `permissionDecision`, and
  says so itself: *"allowed — WARN never blocks"*. Armed, detecting, and blocking are three states
  and this rule sits in the middle one. Also: a BLOCKED verdict proves nothing until you check
  WHICH rule blocked — the first run here was masked by `CW1`/`CB4`, right shape, wrong reason.
  Route dependent fan-outs through `fanout()`, and assert at the **barrier** (a throw inside a
  pipeline stage becomes a null and misattributes the diagnosis). (Measured firsthand 2026-07-28;
  reframed the fleet ask; `fieldbook` owns the hook — do not patch locally.)

## Maintenance

UPDATE-IN-PLACE; adding/retiring a memory updates this index in the same change. Carry-away claims
must be traceable to the source memory.
