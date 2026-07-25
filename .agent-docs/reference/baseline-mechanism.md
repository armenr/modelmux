---
provenance: kit-template
created: 2026-07-11
last-modified: 2026-07-11
related: [doc-refs-contract, CONVENTIONS]
tags: [reference, brownfield, baseline, adopt-exemption, docs-impact, drift, scheduled-drift]
---

# The baseline mechanism — brownfield-vs-cold-start for the docs-impact gate

> How the docs-impact gate (framework-rationale/0014) handles a repo where drift **already
> exists**. The owner's brownfield axis, verbatim spirit: *we might be walking into
> situations where shit already exists, or it's just a mostly cold start.* The rule:
> **new debt loud, inherited debt acknowledged-and-fenced** — an agent is
> accountable only for the doc drift its own diffs create or *touch*.
>
> This is the **adopt-exemption pattern's next application**: the same move the kit
> already makes for retro-adopted docs, applied to doc-*claims*.

## The two entry states

An adopter lands in one of two states, and the gate must serve both:

- **Cold start** — a mostly-empty or fresh corpus, little or no pre-existing drift.
  The baseline is empty; the gate is pure forward accountability from day one.
- **Brownfield** — drift already exists: a README a lifecycle-stage stale, a
  normative doc settled-wrong-in-place, a test-count claim off by 2×, an entire
  second-language port mentioned by zero human docs. A gate that surfaced all of it
  on the adopter's first unrelated diff would be a false-positive machine and would
  be turned off within a day.

The baseline mechanism is what lets the *same* diff-scoped gate serve both: it
inventories inherited drift ONCE and fences it, so the gate only ever surfaces a
row for a referent the current diff actually touched.

## Precedent — the adopt-exemption pattern

The kit already exempts pre-existing artifacts from rules written for kit-native
ones. CONVENTIONS §"Lint rules": *"Pre-existing docs retro-adopted in place
(manifest `action: adopt`) predate the kit and carry no kit front-matter: the
schema rules above are waived for them, but rule 13 (index completeness) still
applies."* The doc linter honors it (`lint-docs.py` skips the schema-class rules
for `action: adopt` rows) — **waived, but never invisible**: an adopted doc still
owes its `index.md` row so it stays greppable.

The baseline mechanism is the identical move for doc-*claims*. Pre-existing drift
predates the agent's accountability, so it is **exempted from the gate** — but stays
**parked and visible**, never deleted. Where a manifest exists, baseline composes
directly with `action: adopt`: an adopted doc's inherited claims are baseline by
construction.

## Mechanism 1 — the adoption-time drift inventory (one-shot)

At kit adoption (or first docs-impact-gate install), run the sweep ONCE against
`HEAD` over the **full corpus**. This is the *only* time the corpus scope is full —
framework-rationale/0014 rejects always-full-corpus *per cycle* (Alternative D) and admits it here
as the one-shot exception. Three ordered steps:

1. **Declare non-doc / generated / frozen surfaces FIRST.** Before the inventory
   reads anything, `.docrefs.config` declares golden fixtures, recorded transcripts,
   generated surfaces (`generated: <glob> from <source>`), and frozen/vendored trees
   (`doc-refs-contract.md` §"Exclusion config"). This keeps fixtures and generated
   output from being inventoried as authored docs. A surface excluded *after* the
   inventory ran must have any baseline rows it seeded struck.
2. **Inventory only the MECHANICALLY-determinable lanes** — `uncovered`,
   `unverifiable-locally` (cross-repo), and surface-marked `provenance` /
   `retirement`. It does **NOT** run a full-corpus `still-true` / `stale` JUDGMENT
   pass: `stale` is an agent call (`doc-refs-contract.md` §"five-state triage"), and
   judging a whole corpus's claims in one sitting is exactly the Alternative-D
   drowning, merely relocated to adoption day (and the brownfield corpora this is FOR
   are where that pass is largest). Inherited `stale` is instead *discovered on first
   touch* under the same accountability line (Mechanism 2: you own the claim once your
   diff touches its referent) — same provenance outcome, no adoption-day drowning.
3. **Establish the per-repo known-positive canary** — point `.docrefs.config` at a
   real claim already in this corpus that the enabled grammar set MUST find on every
   run (`doc-refs-contract.md` §"Fail LOUD"). The inventory is the natural place: it
   has just proven the grammar set fires against the live corpus.

Each inventoried row is recorded ONCE into a parked backlog:

| Column | Meaning |
|---|---|
| referent | the changed-thing the claim is about |
| claim | the claiming `doc:line` |
| state | `uncovered` \| `unverifiable-locally` \| `provenance` (mechanically pre-tagged — never `stale`, which is judgment) |
| inventory-date | when the one-shot ran (the point-in-time snapshot) |
| disposition | `parked` \| `scheduled` (→ Mechanism 4) \| `retirement` (→ Mechanism 3) |

**Same-change index obligation.** Where `.agent-docs` exists, the ledger lands at
`.agent-docs/reference/docs-baseline.md`, so its `reference/index.md` routing row is
added in the **same commit** — rule 13 (index completeness) is the one always-on
hook-enforced lint and would otherwise fail the first adoption commit. Standalone
(no `.agent-docs`), the ledger is a plain `.docrefs-baseline` at repo root with no
index obligation.

Missing / malformed baseline ⇒ **no fencing** — the cold-start default: nothing
inherited, nothing exempted (mirrors `lint-docs.py`'s "missing manifest ⇒ no
exemptions, no crash").

## Mechanism 2 — accountable-only-for-touched-drift (the accountability line)

The gate is diff-scoped (framework-rationale/0014, Alternative D rejection). A baseline row is
**fenced** unless the current diff touches the referent it claims about:

- **Diff does NOT touch the referent** → the row stays parked; the gate never
  surfaces it. No inherited-drift false positives — the adopter is not drowned.
- **Diff DOES touch the referent** → the row **graduates** out of baseline into live
  accountability. The agent who touched the thing now owns triaging its claim. You
  cannot hide behind "that was already broken" once you edit the thing the claim
  describes.

Graduation is **one-way and recorded**, obeying framework-rationale/0008's content-preserving
disposition: the baseline row is **struck in place with a stamp** (graduation-date +
the diff/commit that touched it), journaled, and enters the normal triage →
`reviews/` finding flow — **never silently dropped**. An upgrade that lost a
baseline row, or a graduation that discarded one, is a defect, not a degradation.

This single rule is the whole brownfield answer: **new debt loud** (a claim the
diff freshly falsifies is never in the baseline — it surfaces immediately),
**inherited debt fenced** (a baseline row the diff didn't touch stays parked), and
**touched-inherited debt graduates** (you own what you edit).

## Anti-laundering — the baseline is SEALED and write-once

The whole accountability line rests on "new debt loud" — so the baseline must not
become a laundry where a claim you *just* broke gets re-labelled "inherited." The
kit's threat model assumes an agent takes the easy path, so the seal is a **contract
requirement that ships now**, not a deferred nicety:

- **Sealed at first inventory.** The one-shot inventory records
  `baseline-sealed-at = <commit-sha + date>` in the manifest (standalone: a header
  line in `.docrefs-baseline`). Only that sealed one-shot writes baseline rows.
- **A second full-corpus run is refused, or is a LOUD recorded re-baseline event** —
  never a silent re-inventory. Re-baselining is an operator-visible action with its
  own stamp, so inherited-drift scope cannot quietly expand later.
- **Post-seal rows are flagged.** Any baseline row whose `inventory-date` post-dates
  the seal, or whose claim `doc:line` was modified after the seal, is flagged as a
  suspected launder — a fresh break cannot be hand-parked into "inherited."

This mirrors graduation's own *one-way and recorded* rule (above), applied to row
**creation**. The mechanical enforcement is the rule-17-class **baseline-integrity
linter** — a **required deliverable of the script build** (`gate-deltas.md` §5), not
optional, because it guards the accountability line rather than a convenience. Until
it lands, the seal is discipline + the operator-visible re-baseline stamp.

## Mechanism 3 — the retirement lane

A doc or tree **queued-for-deletion** is surfaced by the sweep but **never owed a
fix** — do not force-fix a doc about to be excised. Retirement is a mandatory lane
(a field repo carries retired-but-tracked trees awaiting excise that must not be
forced-fixed).

**Retirement is NOT a new marker — it reuses the shipped end-of-life vocabulary.**
The kit already carries the dying-doc lifecycle: `status: deprecated` /
`status: superseded` front-matter (CONVENTIONS §2) and the `archive/` tree with its
`archived-from:` breadcrumb (§7.3). The retirement lane is the sweep's *reading* of
that existing signal, not a second convention: a doc is retirement-fenced when it
carries `status: deprecated` **with a stated excision event** (or lives under an
`archived-from:`-bound tree), or — standalone, where kit front-matter may be absent —
a `retirement:` glob in `.docrefs.config`. "Retirement" is the narrow case of
*marked for imminent physical excision*, distinct from a merely `deprecated` doc that
still needs to be correct; when a distinct signal is wanted it is the excision-event,
not a new keyword.

Retirement ≠ baseline:

- **baseline** = *inherited, fix-eventually, parked* — and it graduates when touched.
- **retirement** = *dying, don't touch* — fenced **even when the diff touches the
  referent**, because you are removing it, not maintaining it.

A retirement row that is *not* actually excised by its stated point is the one thing
worth re-surfacing — that is a scheduled expectation, so it registers as
scheduled-drift (Mechanism 4) pointing at the excision milestone.

## Mechanism 4 — scheduled-drift registration

A doc-claim **known to expire at a future event** (a spike cited in five places all
scheduled to go stale at one known milestone; a retirement due at a named cutover)
is **pre-registrable**. A scheduled-drift entry names the claim + the expiry event
and tells the sweep: *this claim is expected-stale until the event — do not surface
it as fresh drift before; surface it once the event has passed.*

The flagship case is the **no-`.agent-docs` install-waiver repo** (framework-rationale/0014's
normative-contract archetype), so the mechanism must work with NO obligations ledger
and NO `/orient`. Two forms:

- **Where an obligations ledger exists (`.agent-docs` installed).** The entry does
  NOT restate a trigger's action — it **POINTS at** the framework-rationale/0012 obligations
  **tripwire** already watching that milestone. framework-rationale/0012's non-overlap rule governs:
  *an entry may POINT at a tripwire/`RV`/`DEFER`/`WU-` by id; it must never DUPLICATE
  one.* The tripwire owns the trigger and its firing; the entry owns only the
  *doc-claim ↔ event* binding the sweep reads. (Only the event-WATCH graduates to a
  typed `RV` anchor at Full — as a tripwire does, framework-rationale/0007; the doc-claim↔event
  binding stays in the baseline ledger, so the entry itself does not migrate.)
- **Standalone (no obligations ledger to point at).** `watches:` carries a **bare
  event / date / milestone token** inline — there is nothing else to point at, so
  self-carrying the expiry is **not** a non-overlap violation (the point-don't-
  duplicate rule binds only where a tripwire exists to own the trigger). This is the
  form the flagship archetype actually runs.

**Firing (what the wired mechanism can actually deliver).** The sweep is
diff-scoped, so it cannot fire *at* the event on its own. The firing net is:

- **With `.agent-docs`:** `/orient` computes *overdue* against the entry's
  `expires-at` at cold-start — the exact `Trigger/by-when → /orient overdue`
  machinery framework-rationale/0012 already ships — so an expired row surfaces at the next orient
  regardless of whether any diff touched the referent.
- **Standalone (no `/orient`):** the sweep itself flags any **expired-but-still-
  fenced** scheduled row on **every** run (a cheap date compare against `expires-at`),
  so a no-`.agent-docs` repo is not left without the net. This replaces the
  `/orient`-only recovery for standalone.

Register (standalone form): `{ claim: "spec/wire.md:120 — §3.2 envelope carries
`ttl`", expires-at: <milestone/date>, watches: <bare event token> }`; the
`.agent-docs` form sets `watches: TRIPWIRE-<id>` instead. Before the milestone the
sweep keeps the row fenced (expected-stale, not drift); after it, the row is surfaced
by whichever net the install carries. Honored by **discipline + the sweep's read of
the registration** — the same discipline-only cost framework-rationale/0012's non-overlap join
carries.

## Backlog visibility — the baseline is not a landfill

Diff-scoping fences an untouched inherited row from surfacing — which, without a
counter-net, would make "accountable only for touched" silently become "inherited
debt is invisible forever unless a diff happens to touch it." Every sibling ledger
has a drain (obligations prune settled rows to `log.md` and get `/orient` overdue
surfacing; reviews rows are dispositioned one by one), so the baseline gets one too:

- **`/orient` surfaces the backlog at cold-start** — the parked-row count + the
  oldest-N rows (cheap; it already reads the ledger surfaces for dangling pointers,
  and mirrors obligations' overdue surfacing). The inherited debt stays in view, so
  it is a *visible* backlog, not a write-once dump.
- **Optional per-cycle burndown budget** — an install may adopt "triage K baseline
  rows per cycle" so the queue drains by discipline, not only by the accident of a
  diff touching a referent. Off by default (diff-scoped stays the floor); on where an
  adopter wants the inherited backlog actively retired.

Standalone (no `/orient`): the sweep prints the parked-row count as a one-line
banner on each run, so the backlog is still surfaced.

## Homes (where each lives — Standard+ and standalone)

The sweep runs standalone (no `.agent-docs`; `doc-refs-contract.md`), so each home
has a standalone fallback:

| Surface | Standard+ home | Standalone fallback |
|---|---|---|
| baseline inventory | `.agent-docs/reference/docs-baseline.md` (indexed; rule 13 row added same-change) | a plain `.docrefs-baseline` file at repo root (no index obligation) |
| seal record | `baseline-sealed-at` in `.agent-docs/.kit-manifest.json` | a header line in `.docrefs-baseline` |
| retirement lane | `status: deprecated` + excision event / `archived-from:` tree, or a `retirement:` glob in `.docrefs.config` | a `retirement:` glob in `.docrefs.config` (config is standalone-friendly) |
| scheduled-drift registration | baseline rows `disposition: scheduled` + `watches: TRIPWIRE-<id>`; `/orient` computes overdue against `expires-at` | same rows in `.docrefs-baseline` with `watches: <bare event/date token>`; the sweep flags expired-still-fenced rows every run |

Where a manifest exists, baseline **composes with** `action: adopt`: adopted docs'
inherited claims are baseline by construction, so the two records reinforce rather
than duplicate. The baseline ledger is content, not code — it never auto-edits; the
sweep only READS it to decide fencing.

## Consequences

- **+** No inherited-drift false-positive drowning — the gate is usable on a
  brownfield adopter from day one; the accountability line is mechanical (did the
  diff touch the referent?), not a judgment call.
- **+** Inherited debt stays **visible** — parked, surfaced at cold-start (backlog
  count + oldest-N), optionally burned down per cycle — and graduates the moment a
  diff touches it, so it neither drowns the adopter nor rots invisibly.
- **+** Composes with the shipped precedents it extends: the adopt-exemption pattern
  (waived-but-visible), the obligations tripwires + `/orient` overdue machinery
  (scheduled drift points where it can, self-carries where it can't), and framework-rationale/0008's
  content-preserving disposition (graduation strikes-and-stamps, never drops).
- **+** The seal makes the accountability line tamper-evident: a fresh break cannot
  be hand-parked into "inherited," because only the sealed one-shot writes baseline
  rows and post-seal rows are flagged.
- **−** The adoption inventory carries a **bounded mechanical cost** (declare
  surfaces, grep the corpus once, record the pre-taggable lanes, plant the canary) —
  NOT the full-corpus still-true/stale judgment pass Alternative D was rejected for;
  that pass is deliberately deferred to per-diff first-touch, so adoption day is not
  a drowning.
- **−** A baselined referent stays un-fixed until a diff touches it OR the burndown
  budget reaches it — inherited drift can linger. Accepted: the alternative is
  drowning the adopter on day one, which gets the whole gate turned off; the /orient
  backlog surfacing is the visibility net.
- **−** The inventory is a **point-in-time snapshot**. A claim that drifts AFTER
  adoption without a diff touching its referent is not re-inventoried — it is caught
  only when a diff eventually touches it. Same touched-only limitation as
  Mechanism 2, by design (the gate is diff-scoped, not a periodic full re-scan).
- **−** Scheduled-drift is discipline-not-lint: a mis-registered claim (wrong
  `watches:`, wrong expiry) can hide real drift until its stated event. With
  `.agent-docs`, `/orient`'s overdue-against-`expires-at` + dangling-pointer checks
  recover the common cases; standalone, the sweep's every-run expired-row flag does;
  but the registration's correctness itself is not mechanically enforced.

## Related

- framework-rationale/0014 (the docs-impact gate this makes brownfield-safe) · CONVENTIONS §"Lint
  rules" adopt-exemption + `lint-docs.py` `action: adopt` (the pattern this extends)
  · the kit-upgrade retro-adoption branch (`action: adopt` backfill — where the
  manifest-side of baseline composition lands) · framework-rationale/0012 (obligations tripwires —
  scheduled drift points at, never duplicates; the non-overlap rule) · framework-rationale/0007
  (the typed `RV` anchor a scheduled-drift entry graduates to at Full) · framework-rationale/0008
  (content-preserving disposition — the rule a graduated baseline row obeys) ·
  `doc-refs-contract.md` §"the two lanes" (the sweep-side reader) · `gate-deltas.md`
  §5 (the baseline-ledger seeding)
