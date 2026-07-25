---
provenance: kit-template
created: 2026-07-11
last-modified: 2026-07-11
related: [baseline-mechanism, CONVENTIONS]
tags: [reference, spec, contract, docs-impact, sweep, standard-profile]
---

# `doc-refs.sh` — the diff-keyed docs-impact sweep (contract)

> The ratified CONTRACT for `scripts/doc-refs.sh`, the **diff-keyed twin** of
> `scripts/wu-refs.sh` (framework-rationale/0009). `wu-refs` is **unit-keyed** — *what awaits this
> unit*; `doc-refs` is **diff-keyed** — *given the diff, which documentation claims
> about the changed things may now be false*. Both gather references pointing at a
> key and hand them to triage; the load-bearing difference is the KEY (a diff's
> referents vs a unit id) and the CORPUS (the human-doc corpus vs the obligation
> stores), not a reversed direction. ("Outbound" in framework-rationale/0014 is a reading-aid for
> the diff→downstream-docs blast radius — reconciled there against the kit's other
> inbound/outbound axes.)
>
> **Spec-first (kit G0).** This document ships in the 0.5.0 package as the contract
> the implementation MUST satisfy; the script build is a later work-unit gated on
> framework-rationale/0014's ratification. The gate stage degrades to a manual read until the script
> lands (see `gate-deltas.md`).

## What it does (and does not)

It **gathers** every human-doc claim about the things a diff changed, **pre-tags**
the rows it can settle mechanically (uncovered · provenance · unverifiable-locally ·
the baseline/retirement fences), and emits a **triage worksheet** — leaving the
agent only the **still-true vs stale** call. It is the mechanical half of the
docs-impact CLEAR stage. Same posture as `wu-refs`:

- **Gather-then-triage** — the tool never decides a judgment state; it surfaces
  candidates and pre-tags the mechanical ones.
- **Flag-only, NEVER auto-edits** — no surface is ever written by the sweep;
  normative / append-only / frozen surfaces are hard-flagged read-only.
- **Reads the human-doc corpus by default** — reading is not colonizing — with
  per-surface opt-out.
- **Runs STANDALONE** — no `.agent-docs` required; the diff + the corpus + an
  optional config file are sufficient.
- **Triages, never blocks** — presence of candidate rows is NOT a failure exit
  (see *Exit semantics*).

## CLI contract

```
scripts/doc-refs.sh <diff-range>          # e.g. main..HEAD, HEAD~3..HEAD, <base>..<head>
scripts/doc-refs.sh --staged              # the staged set (the pre-commit advisory lane)
scripts/doc-refs.sh --files <paths…>      # an explicit changed-file set
scripts/doc-refs.sh <range> --grammar paths,commands,sections,env
scripts/doc-refs.sh <range> --config <path>     # exclusions + grammar config (default: .docrefs.config)
```

- Exactly one of `<diff-range>` · `--staged` · `--files` selects the changed set;
  none given → usage error (exit 2), like `wu-refs`' missing-argument guard.
- Runs from the repo root (`cd "$(git rev-parse --show-toplevel)"`), as `wu-refs`
  does.
- `--grammar` overrides the configured grammar set for this run; absent → the
  config's enabled set; no config → all four initial grammars.

## Input derivation — from the diff to the changed *referents*

For the selected change set the sweep derives, per enabled grammar, the set of
**changed referents** — the things a doc could make a claim *about*:

- `git diff --name-only <set>` → changed **paths**.
- `git diff <set>` hunk content → added/removed **exported symbols**, touched
  **CLI flags / subcommands**, changed **config keys / env vars / routes /
  §-ids / wire-shape fields**, per each grammar's extractor.

The referent set is the sweep's key: it then greps the **human-doc corpus** for
claims that cite any referent. (The corpus is every doc surface not excluded — see
*Exclusion config*. It is NOT limited to `.agent-docs`; that is the whole point —
it covers the neither-doc-nor-code surface the pre-commit dispatcher leaves
ungated.)

## Grammar-plugin shape (pluggable — the core engine + a matcher library)

A grammar plugin is a small declarative unit with three required parts and two
optional ones:

1. **EXTRACTOR** — from a diff, produce the set of changed referents of this class.
2. **MATCHER** — a pattern (grep-class) that finds a doc claim *citing* a referent.
3. **COVERAGE-EXPECTATION** — a boolean: does a changed referent of this class
   *expect* a doc claim? If yes, a changed referent with zero doc hits is an
   **uncovered** candidate (the mechanically-detectable inverse). If no (e.g. an
   internal-only symbol), absence is silence, not a gap.
4. **RESOLVER** *(optional — pre-judgment normalization)* — computes the
   **effective** claim before the matcher judges it, where the surface text is not
   the operative text (an amended §, a generated projection, a vendored citation).
   A plugin without a resolver judges surface text as-is; a plugin whose class
   needs normalization (the §/amendment grammar) MUST declare one, or scope its
   verdict to "unresolved" (see below). Resolution is **not** a pure grep and needs
   declared inputs (`.docrefs.config`).
5. **REFERENT-CLASS WEIGHT** *(optional)* — feeds *weight by load-bearing-ness*, below.

The **core engine** drives every enabled plugin and merges their rows; the plugin
set is per-install. The **four archetype grammars** (the initial library — extend
or disable per repo), plus the wired **license-join check** (below, ranked with
them):

| Grammar | Referents (extractor) | Claim matcher (examples, re-fictionalized) |
|---|---|---|
| **paths/symbols** | changed paths, exported symbols, config keys, typed IDs | `` `internal/store/redis.go:88` ``, "the `Shorten` method", `SPARROW_TTL_DEFAULT` |
| **commands/routes** | CLI subcommands + flags, HTTP routes, client methods | `sparrow shorten --ttl 24h`, `POST /s`, "call `Client.Expand(id)`" |
| **§/amendment-ids** | §-numbers, amendment ids, decision ids, review tags | "per §3.2", `AMENDMENT-014`, `REV-071-F02` |
| **env-vars/flags/wire-shapes** | env vars, feature flags, wire-envelope fields | `SPARROW_BASE_URL`, `--dry-run`, a JSON envelope quoted verbatim across N docs |
| **license-join** *(a first-class check)* | manifest `[license]` / `license-file` + per-dependency license metadata | rows of the README / `LICENSE` license table (see *Weight by load-bearing-ness*) |

**Self-amending resolution (§/amendment grammar — a RESOLVER, not a grep).**
Before judging, the effective claim must be resolved through the amendment chain: a
§1.1 that amends §3/§5 lower in the same file, or spec text corrected only by an
append-only deltas block in a *different* file, is judged at its amended value —
not its superseded surface text. This is expressly **not** expressible as a
matcher pattern; it is the grammar's RESOLVER step, and it reads declared inputs
from `.docrefs.config`: the in-file amendment-header convention (the shipped
CONVENTIONS §2 banner — `> **Amended YYYY-MM-DD by [ADR-NNNN]:**`) and the path of
any cross-file deltas ledger. **Fallback when no resolver is declared:** the
grammar MUST NOT emit a `stale` verdict on amendable text — it flags
**`amendment-chain unresolved → agent resolves`** and hands the row to judgment. A
grammar that judges pre-amendment text as `stale` manufactures exactly the false
stales that make a corpus refuse the tool.

## Claim-target indirection (three rules)

- **Generated artifacts chase their SOURCE.** Generated API docs, CLI `--help`
  text, and task-runner `--list` output are *linked, not linted*: a claim in a
  generated surface is resolved to the doc-comment / schema file it is generated
  FROM, and the SOURCE is what the sweep gates. Never flag the generated output
  directly — it is a projection of the source.
- **Vendored citations are FROZEN.** A citation into vendored / third-party source
  (a `file.go:NNN` in a dependency, a foreign schema) re-verifies only on a
  **dependency version bump** (a manifest version change in the diff), NOT on an
  ordinary diff. On a normal change these rows are skipped.
- **In-code doc-comments about wiring / status are first-class claims.** A
  `// not yet wired` / `// deprecated` / `// experimental` comment is swept like any
  prose doc; it drifts **both** directions — stale-optimistic ("wired" on dead
  code) AND stale-pessimistic ("not yet wired" on live code, which nearly triggered
  a wrong dead-code deletion). Both directions are surfaced.

## Weight by load-bearing-ness (not size, not age)

Output is ranked by a load-bearing weight, never by doc size or `mtime` (the
rule-12 file-age signal is explicitly NOT this tool's basis — framework-rationale/0014, Alt C). A
tiny doc can be the most load-bearing, so when a row IS in scope it sorts by weight,
not size. Grammar plugins may raise a referent-class weight so their rows sort to
the top of the worksheet.

**The license-join check (a wired first-class check, not just a weight).** The
field datum — a nine-line README whose license table omits the most
legally-encumbered dependency — is the sharpest "small ≠ safe" case, so it ships as
its own check in the initial library, not merely a high weight on some other
grammar:

- **EXTRACTOR** — the manifest license fields (`[license]` / `license-file`) + the
  per-dependency license metadata the manifest/lockfile carries.
- **MATCHER** — the rows of the README / `LICENSE` license table.
- **COVERAGE-EXPECTATION** — every encumbered dependency appears in the table; a
  license-bearing dependency with no table row is an **uncovered** row, ranked HIGH.

**Honest trigger (it is diff-scoped like everything else).** Because the sweep is
diff-scoped, the famous omission is caught **(a)** once at the adoption inventory
(`baseline-mechanism.md` §1), and **(b)** per-diff *only when the diff touches a
manifest license field, the lockfile, or a component's packaging*. It does not
re-scan the whole license surface on every unrelated commit — but when a license
field *is* in the diff, its row sorts HIGH regardless of the README's size.

## The five-state triage output + the two lanes

Each candidate row carries a **proposed** disposition — and the load actually on
the agent is only **two live choices**: *still-true* vs *stale*. Every other row is
pre-tagged by the sweep (uncovered, provenance, unverifiable-locally) or fenced
(baseline, retirement); those are confirmations, not decisions. The **veracity
markers are the shipped closed set** (CONVENTIONS §2 — `[code-verified]` ·
`[claimed-unverified]` · `[contradicted-by-code]` · `[historical as-of]`); this
sweep introduces **no new marker**. (State DEFINITIONS are normative in `standing-rules-core.md`
§"Cycle start" — this table specifies only the sweep's OUTPUT schema: who assigns each state and
which veracity marker rides along.)

| State | Meaning | Who assigns | Veracity marker |
|---|---|---|---|
| **still-true** | claim holds against the change | agent (judgment) | `[code-verified]` (cite the evidence) |
| **stale** | change contradicts the claim | agent (judgment) | `[contradicted-by-code: <what the code shows>]` → a doc fix, else a dispositioned finding (§below) |
| **uncovered** | changed referent, expected-but-absent claim | **sweep** (coverage-expectation) | — (no claim exists to mark) |
| **provenance / record-fact** | deliberately-frozen history; code differing ≠ drift | **sweep** if the surface is record-fact-marked, else agent | **none** — a *record-fact* carries no reality-claim marker at all (CONVENTIONS §2: "faithful capture suffices") |
| **unverifiable-locally** | referent is outside the repo | **sweep** (cross-repo referent) | `[claimed-unverified]` — asserted, not locally checkable → route to a manual / owed-to-me check |

**Where a stale row files.** A `stale` claim is not a review-pass finding with a
binding test (framework-rationale/0010's `REV-NNN-FNN` model), so it does not default into
`reviews/`. It files, in order: **(1)** fixed in the same pass (a `log.md` entry);
else **(2)** a new `OQ-NNN` in the doc-debt lane (the home the shipped G2-docs
already names — "a dispositioned finding or a new `OQ-NNN`"); else **(3)** when the
docs-impact pass *is itself* a review pass, a `REV-NNN-FNN` whose test-obligation
reads `n/a (doc-claim) → unbound → <owner>`. Never a silent drop.

Two **lanes** fence a row OUT of accountability (pre-tagged by the sweep):

- **retirement** — the claiming doc/tree is marked queued-for-deletion (a
  retirement marker or a `--config` retirement glob): surfaced, **never owed a
  fix**. Fenced even when the diff touches the referent (you are excising it, not
  maintaining it).
- **baseline** — the claim is in the adoption-time inherited-drift inventory and
  this diff did NOT touch its referent: fenced as inherited debt. If the diff DOES
  touch the referent, the row **graduates** out of baseline into live
  accountability. Full mechanism, incl. graduation and scheduled-drift:
  `baseline-mechanism.md`.

## Exclusion config + per-surface opt-out

Default: read ALL human docs (reading is not colonizing). The `--config` file
(default `.docrefs.config`, plain and standalone-friendly — dependency-free,
pure-bash-parseable, **no `jq`**, to honor the pre-commit dispatcher's bash-3.2+
portability constraint) declares:

- **path/glob exclusions** — surfaces the sweep skips entirely.
- **per-surface opt-out** — a doc opts itself out via a marker/frontmatter flag OR
  a config glob (a golden-fixture file, a recorded transcript — NOT docs; a
  re-recording is a contract-change event, so tooling stays away).
- **`generated: <surface-glob> from <source-path-or-comment>`** — declares a
  generated surface and where its source lives, so *generated-vs-authored is a
  declared fact, not a mechanical guess* (the sweep cannot reliably detect which
  files are generated). A repo whose API docs are produced from source comments
  declares `generated: docs/api/** from //-doc-comments`; a `--help` snapshot
  declares its deriving source; a golden fixture is declared a non-doc exclusion.
  The generated→source indirection (below) is applied only to declared surfaces.
- **FLAG-only surfaces** — normative / append-only / frozen paths that are
  hard-flagged read-only. (The sweep never auto-edits *anywhere*; these are the
  surfaces where even a *suggested* edit is inappropriate — flag and stop.)
- **grammar enablement** — which grammar plugins are live for this repo, and any
  referent-class weight overrides.

**Ordering with the adoption inventory.** Non-doc / generated / frozen surfaces are
declared **before** the one-shot inventory runs (`baseline-mechanism.md` §1), so
fixtures and generated output are never inventoried as authored docs. A surface
excluded *after* an inventory already ran MUST have any baseline rows it seeded
struck (they were never real drift).

## Standalone operation

No `.agent-docs` is required. The sweep needs only: the diff (git), the human-doc
corpus (the tree minus exclusions), and the optional `--config`. Where
`.agent-docs` exists, the sweep additionally reads the baseline ledger
(`baseline-mechanism.md`) and can route stale findings into `reviews/`; where it
does not, it prints the worksheet to stdout and the agent routes findings by hand.
Absent config ⇒ all four grammars, no exclusions, empty baseline (cold-start
default — nothing inherited, nothing fenced).

## Fail LOUD + the known-positive test (the inherited scar)

`wu-refs` shipped with a reserved-shell-variable bug that made it silently report
"no references" — *the exact silent-under-report failure it exists to prevent* —
caught only by running it against a unit with known references. `doc-refs` inherits
that scar as two hard requirements:

- **Fail LOUD.** An internal error (a broken grammar, a git failure, an unreadable
  config) prints a loud diagnostic to stderr and exits non-zero — it MUST NOT emit
  a clean-looking "(no doc-claims found)" that an operator reads as "no drift."
- **Ship a known-positive test.** The script's own test suite runs it against a
  fixture diff carrying a KNOWN doc claim and asserts the claim is found (per
  grammar). A safety tool you don't test is worse than none — this test is a
  first-class deliverable of the build unit, not a byproduct.
- **Plant a per-repo known-positive CANARY** (distinct from the ship-time fixture
  test). The fixture test proves the *engine* works in the abstract; it does NOT
  catch the failure the scar actually was — a REAL-corpus miss, where the enabled
  grammar set is mis-scoped for THIS repo or the corpus glob never reached the docs.
  So at adoption (`baseline-mechanism.md` §1) the install points the config at a
  known real claim already in the repo's own corpus that the configured grammar set
  MUST find on every run. **A "(no doc-claims found)" worksheet is trustworthy only
  if the canary still fired that run** — otherwise the emptiness is evidence about
  the QUERY (mis-scoped grammar / unreached corpus), not the world (standing-rules
  §"Never answer from absence"). The canary's firing is part of the `docs_impact`
  no-impact proof (`gate-deltas.md` §3a).

## Grammar-coverage audit (the meta-check the canary cannot give)

`COVERAGE-EXPECTATION` detects an uncovered referent *within an enabled grammar*;
the canary proves the *enabled* grammars still fire. Neither catches a changed
referent of a class **no enabled grammar extracts** — it yields no referent at all
and is simply invisible. As a repo's referencing style evolves (a new ID scheme, a
new wire format), emergent claim classes silently fall outside the sweep's vision.
So the sweep carries a **coverage audit**, run at adoption and registered as a
periodic re-audit obligation (not a one-time install choice): flag referent SHAPES
that appear in diffs/corpus (e.g. backticked identifiers in doc spans matching no
enabled plugin's extractor) as **`candidate uncovered claim class → consider a
grammar`**. This keeps the grammar set honest against the repo's actual style
rather than freezing it at install.

## Exit semantics (for gate wiring)

| Exit | Meaning | Gate behavior |
|---|---|---|
| **0** | swept cleanly; worksheet emitted (rows may be present) | candidate rows present is **not** a failure — the gate triages, never blocks |
| **2** | usage error (no change set, bad flag) | surfaced loudly; caller fixes the invocation |
| **≥3** | internal failure (fail-loud: broken grammar, git error) | surfaced loudly as a TOOL failure, not a drift block |

The pre-commit ADVISORY lane never sets the commit's return code — a rows-present
sweep (0) and a clean sweep (0) both let the commit through. But it is
**quiet-on-empty**: when the staged set produces zero changed referents it emits a
single terse line (not a full worksheet header), so the constant-commit repos the
dispatcher is built around are not trained to tune the advisory output out. A
non-zero exit is a **tool** failure printed loudly; in the advisory lane it is
still non-blocking — contrast the two *blocking* dispatcher lanes, which exit 1 on
gate failure. This mirrors `wu-refs`: gather, emit, exit 0; the human triages.

## Worksheet output format

Grouped by grammar (as `wu-refs` groups by location), a header printing the triage
vocabulary, then one block per hit:

```
# docs-impact sweep — you actively choose only  still-true | stale  per row;
#   uncovered · provenance/record-fact · unverifiable-locally are PRE-TAGGED confirmations,
#   and [retirement] · [baseline] are fenced out of accountability entirely.

════════ referents changed in: main..HEAD ════════
── commands/routes ──
  referent:  sparrow shorten --ttl        (added flag)
  claim:     README.md:42  "shorten takes no options"
  proposed:  uncovered            confirm: ____
  weight:    high (public CLI)

── paths/symbols ──
  referent:  internal/store/redis.go  (Shorten signature changed)
  claim:     docs/design/store.md:15  "Shorten(url) returns (id, error)"
  proposed:  (agent — still-true|stale)   confirm: ____

── §/amendment-ids ──
  referent:  §3.2 (amended by §1.1)
  claim:     spec/wire.md:120  "per §3.2 the envelope carries `ttl`"
  proposed:  [baseline]  (inherited; diff did not touch §3.2)  confirm: ____

(no referents matched under: env-vars/flags/wire-shapes)
```

## Related

- framework-rationale/0014 (the design this specifies) · `scripts/wu-refs.sh` (the unit-keyed twin —
  same gather-then-triage + fail-loud contract) · `gate-deltas.md` (where this
  sweep wires into the gate contracts, the return schema, and the pre-commit lane)
  · `baseline-mechanism.md` (the baseline / retirement / scheduled-drift lanes this
  reads) · `reviews/index.md` (where a stale finding lands) · CONVENTIONS lint
  rule 12 (the file-age signal this deliberately is NOT)
