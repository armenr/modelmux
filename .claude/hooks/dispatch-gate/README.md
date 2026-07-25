---
provenance: kit-template
created: 2026-07-13
last-modified: 2026-07-13
tags: [hooks, dispatch, gate, fail-loud, enforcement, workflow, agent]
related: [fail-loud-dispatch-contract, lint-docs]
---

# `dispatch-gate` — the deterministic dispatch-conformance gate

This is the **enforcement** that `.agent-docs/reference/fail-loud-dispatch-contract.md` refers to. The
reference doc ships the FAIL-LOUD DISPATCH CONTRACT v1 as the one normative spec; this gate makes the
STRUCTURAL half of it real — a PreToolUse hook that checks a dispatch is **written so a failure cannot be
silent** before it launches, over both dispatch surfaces:

- the **Agent** tool (plain sub-agent dispatches — one or many, serial or parallel), and
- the **Workflow** tool (dynamic workflows).

It rhymes with `lint-docs.py` on purpose (the kit's other portable check engine): a numbered check catalog
with FAIL vs WARN severities, brownfield-inert activation (it keys on a governance **declaration**, never a
filename), a known-positive self-test, and **stock Python 3 / stdlib only** — no `jq`, no JS parser, no
PyYAML. A green gate means *"built to fail loud," never "succeeded"* — see [What it does NOT
check](#what-it-does-not-check).

## Files

| File | What it is |
|---|---|
| `dispatch-gate.py` | The check engine (Python 3, stdlib). Reads a PreToolUse payload, runs the catalog, emits the allow/deny/surface decision. Also carries `--hash-preamble` / `--make-preamble` / `--self-check`. |
| `dispatch-gate.sh` | The PreToolUse entry shim (the hook `command`). Portability guard: `python3` present → exec the engine; absent → a **loud did-not-run** surface, then allow. Takes the surface as `$1`. |
| `preamble.js` | The versioned, hash-headered fail-loud **preamble** a self-contained Workflow script pastes in (`assertComplete` · `manifestDiff` · `vacuityGuard` · auto-asserting `fanout` · `preflight` · `resumeGaps`). |
| `make-preamble.sh` | Recompute + rewrite the preamble header hash after any edit (delegates the canonicalisation to `dispatch-gate.py`, one source of truth). |
| `fixtures/` | Red/green fixtures — `workflow/*.js` leg fragments and `agent/*.json` payloads. |
| `self-test.py` | The known-positive self-test: runs every fixture through the engine, asserts the exact finding set, and FAILS LOUD if any red passes, any green blocks, or a canary does not fire. |

## The check catalog

Severity follows the determinism boundary: a **DETERMINISTIC-structural** fact → **FAIL** (blocks via
`permissionDecision: "deny"`); a **HEURISTIC-proxy** → **WARN** (surfaces via `additionalContext`, never
blocks — a hard block on a proxy manufactures the silent workaround the escape hatch exists to prevent).

| id | surface | sev | what it checks |
|---|---|---|---|
| **CA1** | Agent | WARN / **FAIL** | `tool_input.model` present + non-empty. **Graded**: WARN on an *undeclared* dispatch (a visible nudge, never a retro-block), **FAIL** on a *declared* one (the author opted into the contract). |
| **CW1** | Workflow | **FAIL** / WARN | The pasted preamble is present, **un-tampered** (canonicalised body hash == the header's declared hash), and **current** (== the gate's pinned hash for its version). A missing/tampered preamble on a governed workflow is a FAIL; an old-but-valid version is a WARN. |
| **CW3** | Workflow | WARN | A naked `.filter(Boolean)`-family compaction on a fan-out result — a silent-drop idiom (contract R2). WARN, and the message says it is countering the Workflow docs' own `filter(Boolean)` advice. |
| **CB4** | Workflow / Agent | **FAIL** / WARN | A governed fan-out's accounting lives in the leg's **RETURN** — the terminal return must be a sanctioned primitive call (`return fanout(…)` / `return manifestDiff(…)` / `return { …manifest }`). Confirms the **call in return position**, never a grep of the body for `{expected,received,missing}` (the preamble supplies those by construction). Agent: WARN (schema in prose). |
| **CB2** | Workflow / Agent | WARN | A declared `build`/`migrate` leg **names** the honesty fields (`discoveries[]`, falsifier proof, reachability) in its return schema. A proxy — it checks the schema *declares* them, never that they are *true*. |
| **CX1** | Workflow / Agent | **FAIL** | DECLARED-DEGRADED / verdict **conflict**, and a **malformed** escape-hatch bypass. Reads the leg's returned `coverage`/`verdict` **only** (the preamble region is stripped first, so its internal `'COMPLETE'` literals are never read); a declared-degraded leg that also asserts COMPLETE/READY is the contradiction R3(b) forbids. **Not bypassable.** |

**Brownfield-inert (the opt-in switch).** The gate is **silent** on any dispatch that carries no governance
declaration — a `contract: 'v1'` pin in a Workflow's `const meta = {…}`, or a `<!-- fieldbook:dispatch … -->`
block in an Agent prompt. The one exception is CA1, which is **graded**: it WARNs on an undeclared dispatch
(a nudge) and FAILs only on a declared one, so installing the gate never retro-blocks a repo's existing
ad-hoc dispatches.

**Never grep the file for a verdict.** Every return-locus / idiom check runs over the **leg region** (the
hashed preamble is stripped away first) and over a **comment/string-stripped** view, so the preamble's own
`coverage: 'COMPLETE'` tokens — and any explanatory comment that merely *mentions* a pattern — are never
credited or accused. This is the load-bearing correctness fix: the mandatory paste contains the very tokens
a whole-file grep would misread.

## What the hook sees, per surface

- **Agent** — `tool_input.prompt` (the full prompt, carrying the declaration block) and `tool_input.model`
  (the pin CA1 checks). Both are memo-grounded named Agent fields.
- **Workflow** — `tool_input.script` (inline script text) **or** `tool_input.scriptPath` (a path the gate
  **reads from disk** — hooks run as local commands with fs access). An **unknown** `tool_input` shape
  (neither field) FAILS OPEN with a loud WARN — never a silent pass, never a hard block on a shape the gate
  cannot read. The observed two-form contract is pinned so an upstream schema change is caught at self-test
  time, not in the field.

## The escape hatch (contract v1 R3(b), hardened)

A dispatch that must ship degraded **by design** carries a `fieldbook:degraded` annotation (comment-style
agnostic — HTML/block/line comments all parse). A **well-formed** annotation downgrades the scoped FAIL to
allow-through and appends an audit line; a **malformed** one is itself a CX1 FAIL (the underlying finding
stands). Hardened so it is not a rubber stamp:

```
// fieldbook:degraded
//   checks:   CB4, CW3          # ENUMERATED check-ids — `all` is forbidden (no master key)
//   reason:   <non-empty why this unit may be dropped by design>
//   artifact: FR-0007           # a resolvable operator artifact (a ledger id, or a path that EXISTS)
//   coverage: INCOMPLETE
//   drop_count: 1
```

Every use appends one line to `.agent-docs/.gate-audit.jsonl` (append-only) so a **cycle-start
bypass-review sweep** can read what was waived — "auditable" means *actually read*, mirroring the inbound
reference sweep. `CX1` can never be waived (you cannot degrade AND claim complete).

## The block-with-reason protocol

The engine always **exits 0 and speaks through JSON** (never mix exit 2 with JSON — stdout is ignored on
exit 2):

- **FAIL** → `hookSpecificOutput.permissionDecision: "deny"` + a reason carrying the fix, the contract
  pointer, and the escape-hatch pointer. `deny` cancels the call even under `--dangerously-skip-permissions`,
  so a completeness gate is un-skippable *except* through the sanctioned hatch.
- **WARN / surface / audited-bypass** → `hookSpecificOutput.additionalContext`, and the tool proceeds.
- **Can't run** (python3 absent, unreadable scriptPath, unknown shape, an engine crash) → a **loud**
  `additionalContext` naming the UNVERIFIED state, then allow. The whole run is wrapped so an unexpected
  exception degrades to **one** finding, never a traceback and never a silent pass (the `lint-docs.py`
  try/except discipline).

## The preamble + its drift story

Workflow scripts cannot `import`, so the fail-loud primitives travel **inside** the script as a pasted
block. Because it is pasted, it drifts independently of the kit, so it carries a version/hash header the
gate hash-checks (CW1):

- **self-consistency** — the header's declared hash == the recomputed **canonical** body hash (the
  canonicalisation neutralises whitespace/reflow so a copy-paste or formatter pass does not false-alarm,
  while any token change is caught). Catches a hand-edit that forgot to regenerate the header.
- **currency** — `(version, hash)` is in the gate's `PINNED_PREAMBLES` table. Catches a self-consistent but
  tampered header, or an old/unknown version (WARN — an old-but-valid preamble is a nudge, not a tamper).

After any edit to `preamble.js`, run `make-preamble.sh` (rewrites the header) and update `PINNED_PREAMBLES`
in `dispatch-gate.py`. `dispatch-gate.py --self-check` (run by the self-test) FAILS LOUD if the two drift,
so the pin can never silently rot.

## The protocol token (configurable)

The kit-name is a **functional protocol token**: it labels the preamble header/END block, the
`<token>:dispatch` / `<token>:degraded` annotation markers an author types, and the `<TOKEN>_GATE_CWD` env
var. A leak-gated public adopter who cannot carry the kit name byte-for-byte can **rename it in one place**
instead of hand-forking the gate:

- **Constant** — `DEFAULT_PROTOCOL_TOKEN` at the top of `dispatch-gate.py`.
- **Env override** — `DISPATCH_GATE_TOKEN`. **Precedence:** the env var wins when set and non-empty;
  otherwise the constant. The **default is exactly the shipped token**, so every existing install is
  byte-for-byte unaffected and the numbered-check behaviour is identical.

Two properties make the rename safe:

- **The pinned hash is token-invariant.** The token lives *only* in the preamble's header + END marker
  **lines**, which are **excluded** from the canonicalised body hash (the hash covers the body strictly
  *between* those lines). Renaming the token cannot change the body hash, so `PINNED_PREAMBLES` stays valid.
- **`preamble.js` derives from the same source.** `make-preamble.sh` (→ `dispatch-gate.py --make-preamble`)
  stamps the *configured* token label into the header + END lines and refreshes the hash. Under the default
  token this is a **no-op** (the shipped `preamble.js` is untouched); under an override it re-labels
  `preamble.js` to match. Detection is token-**agnostic** (`\S+ DISPATCH PREAMBLE …`), so `--self-check` /
  `--make-preamble` / `--hash-preamble` keep working on a `preamble.js` carrying any label — while the
  `<token>:dispatch` / `<token>:degraded` opt-in markers match the **configured** token exactly.

The `fieldbook:*` markers shown elsewhere in this README are the **default** token. `self-test.py`
re-tokenises the fixtures to the active token, so it passes under both the default and an env override.

## Self-test (test your safety tool — C4)

```sh
python3 self-test.py     # exit 0 = all pass; exit 1 = FAIL LOUD
```

It composes each Workflow fixture (the current `preamble.js` + the leg fragment — for the tampered fixture,
a preamble with one primitive line mutated back into a known bug), runs it through the **real** engine, and
asserts the **exact** finding set — a red that passes clean and a green that trips a check are both bugs. It
verifies two **known-positive canaries** (an unpinned declared Agent dispatch; a bare-return governed
fan-out) actually fire — *"0 findings on the canary"* is treated as a broken refuter, never a clean pass
(the exact inversion of the scar where a safety tool that could no longer fail was believed). It also
exercises the real deny / allow / audited-bypass decision paths end-to-end, and pins the preamble hash.

A **FAIL** check with no red fixture is **not considered shipped**.

## How it is wired

Two PreToolUse hook entries — one per surface — with **distinct command strings** (`… dispatch-gate.sh
agent` vs `… dispatch-gate.sh workflow`), because the concierge merge dedups on the exact command string
(matcher-blind), so two same-command blocks would collapse and silently drop a surface. See
`concierge/merge-strategy.md` for the settings.json wiring and the adopter upgrade note. The Agent surface
is the grounded floor; the Workflow surface is a real blocking gate (a Workflow dispatch raises a matchable,
deny-able PreToolUse event that exposes its script — verified firsthand).

## What it does NOT check

The gate converts the IMPOSSIBLE content question *"did the fan-out succeed?"* into the STRUCTURAL question
*"is the fan-out written so a failure cannot be silent?"* and answers **only** the second. It does not
verify: that the work was done or the results are correct; that a declared degradation is *acceptable by
design* (recognised and constrained, never blessed — the operator's call); that a return is a genuine
payload vs a well-shaped stub; that the honesty fields are *true* (it checks the schema declares them);
that a pinned model tier is *apt*; that an agent will *obey* its scope fence; that two dispatches are
actually *dependent*; or that a completeness assertion sits at the *right* boundary. A hollow station body
and a proofless-but-well-formed claim both pass.

> **The disclaimer the gate ships with:** *This gate enforces that a dispatch is STRUCTURED so a failure
> cannot be silent — every station declared, every leg accounted, the loud-failure machinery present and
> version-pinned. It does NOT verify the work was done, the results are correct, the proofs are true, or a
> declared degradation is acceptable. A green gate means "built to fail loud," never "succeeded."*

The one normative statement of R1–R6 is `.agent-docs/reference/fail-loud-dispatch-contract.md` — this gate
CITES it and never restates it.
