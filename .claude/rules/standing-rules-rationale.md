---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-09
---

# Standing rules — rationale (load on demand)

The companion to `standing-rules-core.md`. Each entry states the generalized failure mode the rule
prevents — the *why* behind the imperative. Read this when a rule feels like ceremony, when you're
tempted to skip one, or when onboarding someone to the discipline. The core file stays terse so it can
be always-on; the cost of the "why" is paid here, on demand.

## cwd-check before mutative git / filesystem ops

The shell's working directory persists between tool calls. A scoped read-only command earlier in the
session (`cd` into a package to run a build or read a file) silently relocates you, and the next mutative
command — a `git add`, an `rm`, a redirect — resolves its paths against that moved cwd, not the root you
think you're in. In a multi-package workspace the classic casualty is a lost worktree: files created in
the wrong package, a commit staged from the wrong tree, or a delete that lands somewhere unexpected.
The four-line check is cheap; the recovery from a mis-rooted mutation is not.

## Ask before destructive actions

Destructive operations are irreversible or expensive to reverse: dropping a datastore, resetting state,
rewriting history, force-pushing, deleting outside the scratch area. Automation that performs these
without a confirmation gate eventually performs one you didn't intend — the cost asymmetry (a one-line
confirm vs. an unrecoverable loss) is the entire justification. Confirm first, always.

## Scope for completeness, not MVP

The recurring, expensive trap is the built-but-not-wired surface: a feature implemented and tested but
never reachable from a real entrypoint, or a path half-finished because "MVP" quietly became the ceiling.
It reads as done — the code exists, the tests are green — but the production path is dead. Building to a
finished, wired state (or writing the deferral down with its reason) is what prevents a backlog of
plausible-looking work that never actually runs.

## The gates must pass; never bypass them

Bypassing a gate (`--no-verify`, silencing a lint, skipping a test) trades a visible failure now for an
invisible one later. The gate encodes a class of defect someone already paid to discover; routing around
it re-admits that class. A strict linter with warnings-as-errors is a deliberate choice, not pedantry:
the alternative is a slow accumulation of "harmless" warnings until the signal is gone and a real defect
hides in the noise. Investigate the failing gate; the failure is information.

## A behavior change owes a test

Tests-passing is not the same as done. A behavior with no test that would fail without it is a behavior
with no guardrail against silent regression — the next refactor can quietly break it and every gate stays
green. The falsifier is what makes the behavior real; without it, "it works" is an unverified claim that
decays the moment someone else touches the code.

The non-vacuity extension exists because a guard can pass forever while checking nothing: a control that
matches no path, asserts a tautology, or watches the wrong signal is indistinguishable from a working one
as long as it stays green. The only way to tell them apart is to make it fail on purpose — break the
guarded thing, watch the control go red *for the right reason*, restore. It's the same lesson as testing
the inbound sweep against a known-positive: a safety check you have never seen fire is a hypothesis, not a
safety check, and the vacuous version is worse than none because it manufactures confidence.

## IMPL → WIRED is the acceptance bar

This is the single most expensive recurring failure: code that compiles and passes its unit tests but is
never called from any production entrypoint. It survives review because every local signal is green. It
is only caught when someone asks "does anything actually reach this?" — often much later, after more work
has been built on top of the dead branch. Proving reachability from a real `main()` / served command (via
a code-intel query, an LSP reference search, a call-hierarchy, or the honest grep-the-callers floor) at
acceptance time is what closes the gap. Dead code a linter flags is this failure surfacing, not noise.

## Hands-on acceptance for runtime-facing changes

"Green tests" and "I ran it and watched it work" are different claims. Hermetic tests exercise the code
under assumptions the test author chose; they cannot see an integration seam that was never wired, a
config that only exists in the fixture, or a behavior that's correct in isolation and wrong in the real
loop. For anything runtime-facing, actually running it is the only evidence that the assumptions hold.

## Findings, decisions, and review feedback to disk

Conversation is volatile; it is deleted at compaction and lost at session end. A finding, a rejected
alternative, a dead-end investigation, or a review nit that lives only in the transcript is gone the
moment the context window rolls — and its absence is invisible, so the same dead-end gets re-explored and
the same nit re-discovered. Writing it to its durable home (an ADR, a memory claim, a checkpoint, an OQ)
the moment you have it is what makes the work cumulative instead of amnesiac. The corollary on review
feedback is sharper: an independent verifier routinely finds real defects that an in-workflow pass called
CLEAN, so "CLEAN except a few nits" that drops the nits is discarding exactly the signal that mattered.

## Memory locality — durable knowledge lives in-repo

A repo's knowledge system only works if it is the *single* place knowledge lives. A harness-level or
machine-local memory store is a second brain with none of the repo's guarantees: it isn't version-
controlled, isn't reviewable, isn't visible to other tools or operators, doesn't travel with a clone, and
dies with the machine. Knowledge parked there fragments the record silently — the repo looks complete
while the load-bearing gotcha sits somewhere no one else can see. The redirect-pointer convention keeps
the local store from becoming a shadow archive: the only thing it may remember is where the real memory
lives. The sub-agent half of the rule is the same failure at one remove — a dispatched agent granted
memory tools can write durable-looking state into a store outside the repo (or pollute a runtime store
that is not a knowledge base at all), so agents get search/read + code-intel only, and anything durable
they learn comes back through the return schema to be filed in `.agent-docs` where it belongs.

## Decision-rationale-with-alternatives, before acting

An ADR written after the fact is a justification, not a decision record — the alternatives get
reverse-engineered to flatter the choice already made. Written *before* acting, the rejected options and
the reasons they lost are the actual value: they stop the team from re-litigating settled questions and
they make a later reversal legible ("we knew about X; here's why it lost; here's what changed"). A
decision doc with an empty Alternatives field is a decision that was never really made.

But "chose X over Y" is the thin version, and the thin version is what compaction leaves you with. The
load-bearing rationale is three things the bare verdict discards: **the deciding axis** (the one dimension
the choice actually turned on — not the ten pros and cons, the *one* that decided it); **a steelman of the
runner-up** (why the option you rejected is genuinely strong — a strawman'd alternative makes a later
reversal illegible, because when the runner-up's moment finally comes you won't recognise it); and **the
flip-condition** (the goal, evidence, or constraint that would reverse the call — "for a product, not a
reference architecture, we'd choose the other"). The flip-condition is often the single most valuable line
in the ADR: it is the pre-written trigger for the future reversal. The tell that an ADR is under-written is
simple — the conversation that produced the decision was more insightful than the record of it.

Reopening etiquette is the record's other half: a decision log only saves work if it is consulted before a
settled question is re-litigated. Reopening without reading the record repeats the original deliberation
from scratch — often landing on the already-steelmanned runner-up for the already-rejected reasons — and
reopening without genuinely new information (evidence, goal, or constraint the record didn't have) signals
that the flip-condition machinery is being bypassed rather than used. Read the record first; if nothing
new has arrived, the decision stands.

## Adversarial separation — the reviewer is never the builder

An author cannot reliably review their own work; they share its blind spots and have a stake in its
correctness. Self-review is the failure mode that lets a whole class of defect ship because the one person
who could catch it is the one person motivated not to look. An independent reviewer with no authorship
stake, re-deriving the claim against the live tree, is the control. This applies to designs as much as
code — a design reviewed only by its author is unreviewed, and design defects are the most expensive to
discover late.

## Verification honesty — lower bounds and suspicious zeros

Both lines guard the same failure: mistaking the *shape* of a verification result for its *content*. A
capped audit — stopped by a time budget, a token budget, or an item cap — found everything it found, and
says nothing about what lies past the cap; reporting it as a completed floor converts "we looked at some
of it" into "we looked at all of it" without anyone lying, and the missing residue is exactly where the
next incident lives. "Found ≥ N" keeps the claim honest. The zero-refutations line is the mirror image: an
adversarial pass exists to fail things, so a pass that fails nothing is evidence about the *checker* before
it is evidence about the artifact. Real artifacts of any size carry real defects; a refuter that was
misconfigured, aimed at the wrong tree, or structurally unable to fail produces the identical 0/N as a
flawless artifact — and feels much better. Check that the refuter ran, ran against the right thing, and
could have gone red, before treating the zero as good news.

## Cycle start — recon-first, the outward scope recon

A work-unit's plan is written against a snapshot of the tree that is stale by the time the unit runs:
line numbers have moved, a "single-site" bug has grown siblings, a file the plan assumed untouched now
belongs to someone else's track. Building straight from the plan commits real work to those stale
assumptions, and the failure surfaces at the worst time — mid-build, as a collision between parallel
tracks or a fix applied to the wrong place. The recon is the cheap counter: read-only, parallelizable, run
*before* the build is authored, it recalibrates the plan against the live tree and returns the unit's
complete file-ownership set — which is what makes the orchestrator's cross-unit disjointness check
possible at all. Parallel launch without verified disjoint ownership is a race; with it, tracks provably
cannot clobber each other. The treat-the-backlog-as-DRAFT clause generalizes the same lesson: any durable
backlog is a record of what was true when it was written, and its own claims — line numbers, completeness,
site counts — drift like everything else. Field experience is unambiguous here: recons run against a
trusted backlog have found missed sites, undercounted multi-site defects, and whole classes of debt the
register never recorded. Verify at point of use; the backlog is a map, not the territory.

## Cycle start — the inbound-reference sweep

A work-unit rarely starts clean: by the time its cycle comes up, other work has parked obligations against
it — a `DEFER→` row, an `OQ` homed to it, a `REVISIT` anchor that lifts here, an ADR note ("the next unit
authors X"), a review finding, a code comment. The traceability ledger is *meant* to be the one place those
live, but obligations leak into every other surface, and a ledger is only as complete as the discipline
that fed it. Scope-recon looks outward — what files this unit touches — and catches nothing pointed *at*
it. So the failure mode is quiet: a unit starts, does its planned work, and silently drops an obligation
nobody re-read. The inbound sweep is the cheap mechanical counter — one `git grep` (including `--untracked`,
because the obligation may sit in an uncommitted file written minutes ago) across every location an
obligation could hide, gathered for triage. It does not decide; it refuses to let something be missed by
*omission*. The deeper lesson is about safety tooling itself: the first version of this sweep shipped with a
bug that made it silently return "no references" when there were dozens — the exact false-confidence it
exists to prevent — and it was caught only by running it against a unit with known references. A safety
check you have not tested against a known-positive is not yet a safety check.

## Cycle start — the docs-impact sweep

The inbound sweep catches obligations pointed *at* a unit; neither it nor the outward scope recon catches
the mirror failure — a claim in the human docs that this *diff* just falsified. A change edits a symbol, a
CLI flag, a config key, a license field; the README, the design note, the `--help` text, the in-code
`// not yet wired` comment still describe the old reality, and each silently becomes a lie. This surface is
the one the pre-commit dispatcher leaves ungated: human docs are classified neither-`.agent-docs`-doc nor
code, so nothing mechanical looks at them, and prose drift is invisible until someone acts on the stale
claim (a wrong dead-code deletion, a mis-cited spec §, a license table missing its most encumbered
dependency). The docs-impact sweep is the diff-keyed counter to the unit-keyed inbound one: given the diff,
gather every human-doc claim about the things it changed and triage each — the live call is only still-true
vs stale, the rest (uncovered, provenance, unverifiable-locally) pre-tagged, and the baseline / retirement
lanes fenced out. It carries the same scar as its twin — a sweep that silently reports "no claims" is worse
than none, so it ships with a known-positive fixture test *and* a per-repo canary, and a "(no claims)"
result is trusted only when the canary fired that run (an empty result is evidence about the query, not the
world). The generalized design is `framework-rationale/0014` (why diff-scoped, not always-full-corpus; why
triage-not-block); the sweep contract is `reference/doc-refs-contract.md`; the brownfield answer — new debt
loud, inherited debt fenced — is `reference/baseline-mechanism.md`.

## The dispatch contract

A dispatched agent with a fuzzy scope will freelance: fix something adjacent that looked broken, refactor
beyond its lane, or invent a workaround to get unblocked — and those unsanctioned changes land silently,
sometimes colliding with a track no one was watching. The contract (a hard file-scope fence, report-all /
act-only-in-lane, halt-and-report on a blocker, and no agent committing or merging) confines each agent's
authority to exactly its purpose and routes every surprise back to a single serial integration point where
a human can adjudicate it. The residual risk — an agent misjudging in-scope necessity, or failing to notice
something worth reporting — is why the orchestrator reads every diff firsthand and never trusts a
self-report of "done": reproduce the claim against the live tree before acting on it.

The enforcement clauses are defence in depth for the same contract. Non-builders read-only: a recon,
fixture, review, or verify agent has no legitimate reason to mutate the tree, so granting it write access
only creates the possibility of an unsanctioned change from an agent nobody is watching for one — one
fenced builder per track means every mutation has exactly one accountable author. Worktree isolation over
pre-verified disjoint ownership: two parallel tracks sharing a working tree can clobber each other even
when both behave, so isolation plus the recon-derived disjointness check makes the collision structurally
impossible rather than merely discouraged.

The required honesty fields exist because a free-form "done" absorbs every shortcut invisibly. Each field
forces a specific claim that is easy to skip and expensive to skip silently: RED-on-HEAD proves the
falsifier tests the change and not a tautology; the non-vacuous negative control proves the guard can
actually fire; the IMPL→WIRED proof closes the built-but-not-wired trap at return time instead of much
later; `discoveries[]`-even-when-empty distinguishes "nothing found" from "didn't look"; and the
per-finding disposition keeps review feedback from evaporating between the agent's return and the durable
record. A return schema without these fields lets an agent be honestly wrong at zero cost.

## Model-pinning on every dispatch

Fan-out multiplies whatever model choice it inherits. A silent inherit means the session's (often deepest,
most expensive) tier gets stamped onto every mechanical leg of a wide dispatch — or, inverted, a cheap
session tier silently handles the one adversarial-verify stage that genuinely needed depth. Both failures
are invisible at dispatch time and only show up as cost or quality anomalies later, with no record of what
ran where. An explicit tier on every dispatch makes the choice a reviewable decision: the workhorse
default covers the bulk honestly, and an escalation carries its stated justification, so a later reader
can audit both the spend and the reasoning. The charter template's `model-tier` hint is the same decision
made once, durably, per charter — the pin at dispatch is where it becomes real.

## Fan-out failure modes — the standing table

The table exists so a known failure is met with its known answer instead of a fresh mid-incident
derivation. Each row was paid for at least once: rate-limit waves punish parallel re-dispatch and reward
serialization-plus-resume, because resuming banks the successes already cached while fresh dispatches
re-burn them into an active wave. Heavy local builds are a different resource (one machine's cores and
disk, not a server's limiter) with the same answer — serialize, isolate each worktree's build dir so
parallel tracks stop invalidating each other's caches, and cap concurrency at two because a third heavy
stream tips from sharing into thrashing. The RETURN-ONLY row closes a subtle split-brain: an agent that
both writes to disk and returns a summary creates two versions of the truth, and the orchestrator reads
whichever one is wrong — so drafts come back through the return channel only, reconciled per-doc against
disk. And resume-don't-redispatch is the transactional instinct: a transient error mid-run invalidates the
failed legs, not the succeeded ones; a fresh dispatch throws away exactly the work that was fine.

## Context lifecycle

Context windows are finite and compaction is lossy. Without deliberate checkpoints, a long session's
hard-won state — the detour map, the dead-ends, the in-flight pause point — is silently summarized away,
and the next session (or the same one after compaction) restarts half-blind. The lifecycle rituals
(`/orient` to load, `/flush` to keep `now/*` honest, `/handoff` before compaction, a write-once checkpoint
at any zero-loss boundary) exist because a naive summary drops exactly the reasoning that was expensive to
produce. Proposing `/handoff` at ~80% usage beats discovering the loss after it happens.

## Currency-check external dependencies

Training data has a cutoff; the ecosystem does not. A version number, an API signature, a deprecation
status, or a "recommended replacement" recalled from memory is a snapshot that may be stale or was never
accurate. Infrastructure and dependency choices built on a stale recollection fail in ways that are hard
to diagnose because the reasoning looked sound. Verifying the exact API you're about to use against
current-year primary docs — not an aggregator, not memory — is the difference between a decision and a guess.

## Never commit secrets, credentials, or regulated / user data

A secret committed to a tracked file is compromised the instant it's pushed and stays in history after
it's "removed" — the only real remediation is rotation. Regulated or user data in a fixture, a log line, or
a checkpoint is a leak with legal weight, and derived artifacts (embeddings, caches, traces) can leak the
content they were derived from. Referencing a path or a store key instead of pasting the value is the
cheap habit that avoids the unrecoverable mistake. Detail in `sensitive-data.md`.
