---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-28
tags: [meta, index, routing, lessons]
related: [CONVENTIONS]
---

# lessons/ — routing catalog

Typed, append-only lessons-learned ledger. **Read before action.** The full ledger lives here; the
bounded auto-loaded surface is `now/lessons/MOC.md` (the Tier-1 MOC, ~30 entries) — this index never
replaces the MOC. Schema authority: `../CONVENTIONS.md` (lesson template).

> **Why a typed ledger.** Every durable rule is the fossil of a real, recurrence-counted incident.
> Without typing + a decay signal + a human promotion gate, lessons either re-learn themselves each
> time or drown the signal in noise.

## Entry purpose + naming

- **Purpose:** an atomic, evidence-linked lesson or near-miss — "when X, do Y, because Z."
- **Filename:** `lessons/<kebab-slug-of-claim>.md`; superseded entries → `lessons/archive/`.
- **Write-discipline:** APPEND-ONLY (`status:` may change to `superseded`/`deprecated`/`quarantined`).

## Entry SCHEMA (front-matter axes + body)

- Front-matter: `entry_type` (lesson | near-miss) × `provenance` × `maturity` (seedling → budding →
  evergreen) × `status` × `severity` × `module` × `type`.
- Body: Question · Claim · Evidence (a log timestamp / commit / ADR / incident — required past
  seedling) · Trigger · Failure mode (or "What almost happened" + "What made the save reliable" for a
  near-miss) · Mitigation · Recurrence count.

## Quarantine (model/harness-bound lessons)

A lesson true only of a specific model or tool-era gets `status: quarantined` and lives in a
quarantine sub-section — kept for genealogy, NOT auto-loaded into the Tier-1 MOC.

## Promotion (always human-gated)

The distillation pass drafts candidates → `now/lessons/proposals.md` → promoted at `/handoff`.
Maturity `seedling → budding → evergreen`; prune `last-applied > 90d` → `lessons/archive/`. An
accepted lesson gets BOTH a `lessons/index.md` entry (here) AND a possible MOC row. Severity /
cost-of-recurrence can justify promotion on first sighting — it need not wait for the 3rd recurrence.

## Lessons

- `the-spec-is-the-floor-not-the-proof.md` (**LP-001**) — **Open when:** implementing or reviewing code
  against an external wire format, SSE vocabulary, or auth header set. **Carry-away:** writing from the
  published spec instead of memory is necessary and NOT sufficient — memory-written protocol code is
  wrong where you were confident, spec-written code is wrong wherever the deployment diverges from the
  document, and neither is visible to unit tests; probe the live endpoint before you believe it.
  *(evergreen · high · engineering.)*
- `an-end-to-end-test-must-prove-which-backend-answered.md` (**LP-002**) — **Open when:** writing an
  end-to-end test through a proxy, router, or anything with a fall-through default. **Carry-away:**
  assert the routing LEG from the decision log, and build the test config so the fall-through target
  does not exist — `routes = []` is not "no routing", it silently hit the real paid API and passed.
  *(budding · high · engineering.)*
- `red-test-the-test-not-just-the-code.md` (**LP-003**) — **Open when:** adding any test, gate, hook or
  guard, or before recording that a check passes. **Carry-away:** a guard you have never watched fail is
  not yet a guard — break it deliberately, confirm it goes red for the RIGHT reason, restore and verify
  the restore; and a negative control on a SUBSET is only evidence if you can say why the subset is
  representative. *(evergreen · high · engineering.)*
- `an-empty-result-is-evidence-about-the-query-not-the-world.md` (**LP-004**) — **Open when:** any
  empty, zero-count, or silent result is about to become a recorded verdict. **Carry-away:** a broken
  instrument, a mis-scoped query, a tool that never ran and an empty world are byte-identical in output
  — run a known-positive control first; `command -v` answers "is it on my PATH", a directory check
  answers "is it installed", only a known-positive probe answers "does it have anything to say".
  *(evergreen · high · process.)*
- `a-written-down-trap-is-not-a-disarmed-trap.md` (**LP-005**) — **Open when:** you are about to add a
  gotcha to a doc or anti-assumption list, or you have just been bitten by one that was already
  written down. **Carry-away:** a documented trap still fires at its normal rate, because a reminder
  only works on someone already looking; first firing → write it down, **second firing of the same
  trap → the doc is disproven evidence, so open a work item for a MECHANISM at the point of use** (a
  gate, a test, a lint, a wrapper) rather than re-wording it — measured in-session, the traps with
  mechanisms behind them fired zero times while three documented-only traps fired again.
  *(evergreen · high · process.)*

- `a-correct-mechanism-with-an-inverted-consequence-is-invisible-to-controls.md` (**LP-006**) —
  **Open when:** you have read code, a spec or a log correctly and are about to state what it
  *implies* — especially when the reading was careful and every control fired. **Carry-away:** a
  control catches a false STATEMENT and cannot catch a true observation followed by a one-token
  inference wrong in SIGN, because there is nothing false to control against; reading gives you the
  mechanism, only running gives you the consequence, so a behaviour claim owes an execution and a
  "therefore" spanning two true statements is the joint under test. Chain with `&&`, and grep for the
  string you believe you just wrote before claiming you wrote it. *(evergreen · high · process.)*

- `a-rule-held-as-a-procedure-does-not-transfer.md` (**LP-007**) — **Open when:** you are about to
  modify config, hooks or settings in a repo/machine that is not the one your disciplines were written
  against — especially right after correctly applying the analogous rule somewhere else.
  **Carry-away:** a rule encoded as *"for file X, do steps 1-4"* fires on recognition of X; a rule
  encoded as *"before any Y, ask Z"* fires on recognition of the SITUATION, and only the second
  generalises. Recent correct application creates the confidence that suppresses the check — the
  failure is invisible precisely to someone who HAS the discipline. Write the QUESTION beside every
  procedure, and put it where the situation occurs rather than where the file is named.
  *(budding · high · near-miss · knowledge-capture.)*

- `a-test-can-specify-a-defect-and-every-gate-defends-it.md` (**LP-008**) — **Open when:** a gate is
  green over code crossing an auth, billing, deletion or egress boundary; when you write an assertion
  whose name encodes a POLICY ("X prefers Y") rather than a property; or when a deliberate behaviour
  change turns an existing test red. **Carry-away:** `LP-003`'s sibling and worse, because it survives
  the red-test — a guard that IS non-vacuous, DOES go red when broken, and asserts the WRONG
  proposition. The suite is green *because* the code matches the spec and the spec is the bug, so
  detection cannot come from inside the apparatus. It cost ~15.2M tokens billed to the wrong account
  past 194 green tests. When an old test turns red, decide EXPLICITLY whether it specified the defect
  or is coverage you are breaking, and record the previous assertion either way.
  *(evergreen · high · testing.)*

- `a-cited-defect-outlives-its-own-remediation.md` (**LP-009**) — **Open when:** you are citing a past
  defect as motivation (an OQ, an ADR Context, a commit rationale, a config comment, a message to a
  peer) — and equally when you have just FIXED something other documents cite. **Carry-away:** fixing a
  defect does not touch the arguments that cite it; a citation lives in prose, the fix lives in code,
  and no gate joins them, so a motivating example stays true as HISTORY while reading as a claim about
  the PRESENT. It is invisible to the obvious sweep — a grep for the defective artifact will not find a
  false statement ABOUT it. Re-derive before citing (one `git log -S`); grep the citations after
  fixing. *(budding · high · knowledge-capture.)*

- `suspect-the-probe-before-the-system.md` (**LP-010**) — **Open when:** a post-deploy or
  post-implementation acceptance returns a NEGATIVE result, especially at the moment rollback looks
  responsible. **Carry-away:** the probe is newer, less exercised and likelier wrong than the thing it
  measures, yet a probe failure and a real defect are byte-identical. Two shapes, both seen minutes
  apart on one deploy: the input does not exercise the feature (a trivial prompt asked a reasoning
  feature for nothing, and "no thinking block" read as a broken carry-back), and the probe still uses a
  shape the change deliberately invalidated (an inline `<<route:>>` tag after `ADR-0004`, presenting as
  a broken deploy). Both times the fix was the probe. Completes the axis with `LP-003` (cannot fire)
  and `LP-008` (fires at the wrong claim): here it fires, is aimed right, and was never provoked.
  *(budding · high · verification.)*

## Maintenance

APPEND-ONLY; adding/retiring a lesson updates this index in the same change. Carry-away claims must
be traceable to the source lesson — a wrong carry-away is worse than none.
