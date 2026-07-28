---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-09
---

# Standing operational rules — core (always-on)

These disciplines persist across every session. Framing here is advisory; the safety-critical subset is
meant to be hook-enforced. Every rule is the fossil of a recurring, expensive failure — keep the wording.
The generalized failure-mode behind each lives in `standing-rules-rationale.md` (load on demand).

## 🛑 CRITICAL — cwd-check before any mutative git / filesystem op

**ALWAYS verify `pwd` + branch + working-tree shape BEFORE any mutative git or filesystem command.**
The harness preserves cwd between shell calls — a previous `cd` into a subdir for a scoped read-only
command may have moved you out of the workspace root, and mutative commands resolve paths relative to
cwd. In a multi-package workspace (`single-package`) that is a live foot-gun.

```bash
pwd
git rev-parse --abbrev-ref HEAD
git rev-parse --show-toplevel    # which repo am I actually in
git status -s | head -3          # working-tree shape
```

If cwd ≠ expected repo + branch, `cd` to the correct absolute path first, verify again, then proceed.
Applies to sub-agents too — every dispatch prompt involving git/fs mutation carries this constraint.

## Behavior & momentum

- **Ask before destructive actions.** File deletions outside `now/*`, dropping/resetting a datastore,
  service restarts that discard state, history rewrites, commits, pushes — confirm first.
- **Brief responses, momentum, less process.** Default to forward motion; don't narrate options you won't pursue.
- **Surface gaps loudly; be pessimistic about ambiguity.** An honest open-question (`OQ-NNN`) beats a
  polished plan with hidden assumptions. Lock scope before bulk work.
- **The deferral test.** A deferral is legitimate only when ALL THREE hold: (a) it is DISCLOSED,
  never silent; (b) it is a feature nobody needs yet — real YAGNI — not a promised behavior
  quietly dropped; (c) any "fine for now" is MEASURED, not assumed. A cert or close carrying
  deferrals passes only if each one meets the test — a dropped promised behavior or an
  assumed-fine is a silent gap wearing a deferral's clothes.
- **Scope for completeness, NOT MVP.** Build to a finished, wired state, not a demo — finish the
  production path or write the deferral down (a `DEFER` row) with the reason. An MVP-default leaves a
  half-wired surface.
- **Keep a continuous detour map (the side-quest stack).** Track the MAIN objective and each nested
  side-quest so you can always climb one level back up; long sessions lose the original objective without it.

## Quality gates & change discipline

- **The gates must pass; never bypass them.** `bun run build` · `bun run lint` · `bun test test/` ·
  ``. The pre-commit hook runs the linter + formatter; **never `--no-verify`** — investigate
  the failing gate, don't route around it.
- **Lint is strict by decision, not preference.** Warnings are errors. Don't silence a lint without an
  explicit, justified, in-comment reason; in library code don't reach for `an unhandled promise rejection` — return
  a typed error. No needless work to "make it compile."
- **A behavior change OWES a test that would fail without it.** Tests-pass ≠ done; every behavior carries
  its falsifier. And a fix's guard must be proven **NON-VACUOUS**: break the guard deliberately, watch the
  control fail for the right reason, restore. A guard you have never seen fail is not yet a guard.
- **IMPL → WIRED is the acceptance bar, not test-pass.** The most expensive recurring trap is code that
  compiles and passes tests but is never reachable from a production entrypoint. A unit of work is done
  only when a path traces from a real entrypoint (a `main()`, a served command) to the new code. **Prove
  reachability** — with the code-intel tool (`the TypeScript language server`) or, in order, the fallback menu:
  LSP find-references → call-hierarchy → a language call-graph tool → grep-the-callers (the honest floor)
  → a manual-trace note — and record the IMPL/WIRED/DEFER state in `traceability/`. Dead code the linter
  flags is a wiring failure, not noise.
- **Hands-on acceptance for anything runtime-facing.** "Green tests" ≠ "I ran it and saw it work." Actually
  run the real loop / command and watch it do the right thing. Hermetic-green is necessary, not sufficient.

## Findings, decisions & review feedback to disk

- **Findings to disk or they don't exist.** A finding, dead-end, or rejected alternative that lives only
  in conversation is DEAD at compaction. Write it where it belongs the moment you have it — a decision →
  an ADR (`decisions/`); a gotcha → a `memories/` claim; an investigation result → a checkpoint or
  `research/` track. Verdicts carry on-disk evidence (a `log.md` timestamp, a commit SHA, a command output).
- **All durable knowledge lives IN-REPO — never in a harness- or user-local memory store.** Every durable
  claim (a gotcha, an operator preference, a project fact, a ruling) goes into the version-controlled
  `.agent-docs` system — `memories/` for claims, `lessons/` for patterns, ADRs for decisions, this file for
  rules. Any harness-level or machine-local memory store holds ONLY a redirect pointer to this rule:
  knowledge parked there is invisible to the repo, to other tools and operators, and dies with the machine.
  Same locality for sub-agents — **never route a dispatched agent to memory tools**; equip search/read +
  code-intel only, and durable findings travel back through the return schema to be filed here.
- **Decision-rationale-with-alternatives, written BEFORE acting — capture the load-bearing WHY, not the
  verdict.** A non-trivial choice gets an ADR with a non-empty `## Alternatives Considered` field authored
  *before* the work, not reverse-engineered after — the rejected options + why are the value. "Chose X over
  Y" is NOT enough: record **(a) the deciding axis** the choice actually turned on, **(b) an honest steelman
  of the runner-up** (why the rejected front-runner is genuinely good — never a strawman), and **(c) the
  flip-condition** — what would reverse it (a different goal, new evidence, a changed constraint; e.g. "for a
  product rather than a reference architecture, we'd have chosen the other"). If the conversation that
  produced the decision was richer than the ADR, the ADR is INCOMPLETE. An ADR without the field is
  lint-incomplete.
- **Consult the decision record before reopening ANY settled decision — and bring genuinely new
  information.** The flip-condition is the pre-written trigger for a reversal; re-litigating a settled call
  without new evidence, a changed goal, or a changed constraint burns the record's whole value.
- **Capture ALL review feedback — every severity, never just the blockers.** When ANY review pass returns
  findings, EVERY finding gets a durable home AND an explicit disposition: `FIXED` · `DEFER` (+reason) ·
  `WONTFIX` (+reason) · `TRACKED` (→ a new `OQ-`). Minors and nits included. "CLEAN except a few nits" is
  NOT license to drop the nits — an independent verifier routinely catches majors an in-workflow pass
  passed CLEAN; silently dropping non-blockers loses exactly that signal.
- **Efficiency/savings claims carry a MEASURED[n]/ESTIMATED[lo…hi] label — never a bare %.** Vendor
  headline figures are ESTIMATED-until-reproduced-on-our-workload; measure the trace, not the feeling.

## Adversarial separation of duties

- **The reviewer is never the builder.** The executor never audits its own work. Independent verification
  is a clean-context verifier sub-agent that re-derives the claim against the live tree with no authorship stake.
- **This applies to DESIGNS, not just code.** Pattern: `design → split → adversarial-review` BEFORE
  implementation. A design reviewed only by its author is unreviewed.
- **Diversify the FAILURE MODES the lenses hunt — not just reviewer identity.** Distinct authorship is
  necessary, not sufficient: independent reviewers running ONE shared prompt breed ONE shared blind spot.
  Assign each lens a distinct failure class, and probe a CONVERGED mechanism model at its BOUNDARY
  conditions — one verb can name two control-flow paths, and a review that never separates them audits
  only one of them.
- **A dead field is a SYMPTOM, not a nit — trace before deleting.** A write-only / never-read field is
  evidence that some path FORGOT to consult it; find out WHY it exists before removing it. Acting on the
  "unused field" removal-nit literally can entrench the very bug the field was meant to catch — the fix
  is usually the missing read, not the deletion.
- **A capped or budget-limited audit run yields a LOWER BOUND, not a completed floor.** If the run stopped
  on a cap (time, tokens, item count) rather than exhaustion, report "found ≥ N" — never "found all N".
- **0/N findings refuted is a smell, not a triumph — check the refuter before celebrating.** A perfectly
  clean adversarial pass is more often a broken or misaimed checker than a perfect artifact: confirm the
  refuter actually ran, against the right tree, and could have failed.
- **Never answer from absence.** An empty search / lookup / retrieval result is evidence about the
  QUERY, not the world: scope the query to the question, and when the scoped result comes back empty,
  WIDEN and retrieve before concluding "does not exist" — "not found" and "absent" are different
  claims, and only the widened pass earns the second.

## Cycle start — scope recon outward, reference sweep inward

- **Recon-first per work-unit — a READ-ONLY scope recon before authoring any build.** Before a work-unit's /
  stage's build is authored, run a read-only scope recon (one parallelizable recon per unit, under the
  dispatch contract) that recalibrates the unit's stale line/scope assumptions against the LIVE tree AND
  returns its COMPLETE file-ownership set. The orchestrator VERIFIES cross-unit file-disjointness from
  those sets BEFORE any parallel launch — a collision caught at recon costs one read; caught mid-build it
  costs a track. **Treat any durable backlog as a DRAFT**: its claims (line numbers, finding completeness,
  multi-site counts) are re-verified at point of use, never trusted — the backlog is a map, not the territory.
- **Inbound-reference sweep at cycle start (the inward companion to scope-recon).** Before authoring a
  work-unit's / stage's build, scope-recon looks OUTWARD (what the WU touches); ALSO look INWARD — run
  `scripts/wu-refs.sh <WU/unit id> [stage]` to gather everything that references / awaits it across the
  whole tree (a forgotten `DEFER→`, a gating `OQ`, an `RV` that lifts here, an ADR note, a review finding,
  a dispatch charter, a code comment), and TRIAGE each: satisfied · do-this-cycle · unexpected→investigate ·
  stale→remove. The `traceability/` ledger is the *intended* obligation store; the sweep is the
  defense-in-depth that catches whatever leaked into the other surfaces (`git grep --untracked`, so
  in-flight uncommitted files are swept). Cheap (one command, read-only), and it fails LOUD not silent — a
  sweep that silently under-reports is worse than none, so **test your safety tools** (the original shipped
  with a reserved-bash-variable bug that returned "no references" against a WU with dozens of real hits).
- **Docs-impact sweep at DOCS time (the diff-keyed companion to the unit-keyed inbound sweep — framework-rationale/0014).**
  The inbound/unit-keyed sweep gathers what awaits a UNIT; this diff-keyed sweep gathers what a DIFF may
  have falsified in the docs downstream of it. At the DOCS step of a wave (and, advisory, at pre-commit)
  run `scripts/doc-refs.sh <diff-range>` to gather every human-doc claim about the changed things —
  across the WHOLE corpus, not just `.agent-docs` — and TRIAGE each: **still-true · stale · uncovered ·
  provenance/record-fact · unverifiable-locally** (minus the sweep-fenced **baseline** / **retirement**
  lanes). The active call is only still-true vs stale; the rest are pre-tagged. It GATHERS + pre-tags;
  you triage. It **reads the colleague's human docs by default** (reading is not colonizing) with
  per-surface opt-out, is **flag-only (never auto-edits)**, runs **standalone** (no `.agent-docs`
  needed), and **triages, never blocks**. Same fail-LOUD scar as the unit-keyed twin — a sweep that
  silently reports "no claims" is worse than none, so it ships with a known-positive fixture test AND a
  per-repo canary (a "(no claims)" result is trusted only if the canary fired that run). A stale row →
  a doc fix / a new `OQ-` / a dispositioned `reviews/` finding; an uncovered row → coverage or a
  recorded no-impact.

## Dispatch contract — scope-fence + halt-and-report, never freelance

Every dispatched agent (Agent tool or Workflow worker) operates under this contract; bake it into the
prompt + the return schema, every time.
- **One voice per name (the one-voice fence).** On any shared or external channel that speaks FOR
  this repo (an agent room, an issue tracker, a review thread), only the PRIMARY session speaks.
  A dispatched agent reports to its orchestrator — it never posts, replies, or arms listeners
  under the repo's name, and it ignores any channel event that reaches its session. Bake this
  line into every dispatch prompt where such a channel exists.
- **Hard scope fence (stay in lane).** The prompt names the EXACT files the agent may touch + its single
  purpose + an explicit *do NOT fix / refactor / improve anything outside that, even if it's obviously broken*.
- **Posture = report-all, act-only-in-lane.** Full judgment INSIDE the scoped task; any out-of-scope
  discovery, ambiguity, or temptation is recorded to a REQUIRED `discoveries[]` / `out_of_scope` field and
  NOT acted on. If the unexpected thing BLOCKS the task, the agent returns `status: blocked` and stops — it
  never invents a workaround or expands scope to get unblocked.
- **Non-builder agents are READ-ONLY — as MECHANISM, not intent.** Recon, fixture, review, and verify
  agents never mutate the tree; only ONE fenced build agent per track mutates. Read-only is an intent
  until the prompt makes it a mechanism: name an explicit `mktemp -d` scratch home for anything the agent
  must write, and fence the repo tree in the prompt ("the repo tree is read-only to you; all scratch goes
  in your mktemp dir"). Field evidence both directions: a verify agent without the fence leaked a scratch
  test into the tree; with the fence, dispatches open their reports with "repo untouched — all work in
  scratch." And NOBODY — builder included — un-applies an
  UNCOMMITTED change-under-review with destructive git (`checkout`/`restore`/`stash`/`reset`): reverse
  the edit IN PLACE and verify the blob hash (`git hash-object`) — a red-on-HEAD probe restores by
  re-applying the edit, never by discarding the working tree (field incident: a verifier's
  `git checkout -- <file>` reverted to HEAD and destroyed the fix under review).
- **Parallel tracks run in isolated worktrees over pre-verified disjoint file ownership** — the ownership
  sets come from the recon-first pass and the orchestrator verifies disjointness BEFORE launch, so tracks
  cannot clobber each other mid-flight.
- **Compose-to-file for every shared-channel message.** A message body composed inside a shell string is
  one backtick away from COMMAND SUBSTITUTION splicing your own toolchain's stdout under your byline — and
  the post tool returns success either way (true about the syscall, false about the content). Compose to a
  file via a QUOTED heredoc delimiter (`<<'EOF'` — the quote is the fence, not style: an unquoted delimiter
  expands backticks in the body), then post the file's bytes. Field incident: an agent actively WRITING
  about this failure class shipped it mid-sentence — the examples in its message executed.
- **No agent commits or merges.** The orchestrator is the sole, serial integration point; it reads every
  diff firsthand and an independent reviewer audits for scope-creep BEFORE any commit. Discoveries are the
  operator's to adjudicate.
- **Pin the model tier on every dispatch — never silent-inherit the session model into fan-out.** A
  dispatch that omits an explicit tier is a defect to fix, not run. Default to the standard/workhorse tier;
  escalate to the deep tier ONLY where it demonstrably adds value (the hardest adversarial-verify / judge /
  design stages) and with the justification stated; cheap mechanical stages may drop lower. (The
  dispatch-charter template's `model-tier` hint is the per-charter home for this call.)
- **Returns are structured and REQUIRE the honesty fields.** Every dispatch return carries: proof the
  falsifier ran RED on the unmodified HEAD (for the right reason) · the guard's non-vacuous negative
  control (broke it, watched the control fail, restored) · the IMPL→WIRED reachability proof · the
  `discoveries[]` field (present even when empty) · the `docs_impact` field for any leg that produces a
  diff (**N/A for read-only recon/fixture/review/verify legs**) — the doc-refs triage for the leg's own
  diff, carrying its EXECUTION PROOF: `none` is valid only WITH the swept diff-range + the enabled
  grammar set + exit 0 + the known-positive canary firing (or, until the sweep is installed, "sweep not
  installed → manual read of surfaces X → verdict"); a bare "none" is incomplete like a proofless
  falsifier claim. It does NOT overlap `discoveries[]` (the sweep's typed doc-triage for this diff vs
  free-form out-of-lane findings; framework-rationale/0014) · a per-finding disposition for anything it reviewed. A
  return missing these is incomplete, not done.
- **Don't trust an agent's self-report** that it wrote/verified something — `ls`/grep the live artifact
  yourself; reproduce a relayed bug/finding firsthand against the live tree before filing or acting on it.

### Fan-out failure modes — apply the mitigation on sight

Each row is a recurrence-counted failure with a standing response. Don't re-derive the mitigation — the
IF is the trigger to watch for, the THEN is the standing answer.

| IF | THEN |
|---|---|
| Parallel heavy agents hit repeated **server-side rate-limit waves** | **SERIALIZE the heavy stage** (one at a time); keep lighter stages pipelined; resuming banks already-cached successes. Never hammer fresh parallel re-dispatches into an active wave; back off if a resume makes zero new progress. |
| Multiple **heavy LOCAL builds** would run at once (distinct from the wave above — this is one machine's finite cores/disk) | **SERIALIZE the heavy build phases**; give each parallel-track worktree its own build/output dir; keep **at most 2 concurrent heavy streams** — three or more thrash and starve each other. |
| Draft agents **write docs to disk AND return a placeholder/summary** in structured output (disk ≠ return → phantom or clobbered docs) | Use **RETURN-ONLY** draft prompts (no file tools); reconcile disk-vs-return **per-doc**; list-verify every claimed path; recover any placeholder'd doc from the agent's transcript. |
| Agents **transiently error mid-run** | **RESUME the interrupted run** (replay what already succeeded, re-run only the failed legs) — do NOT re-dispatch fresh. |

### Fail-loud on every dependent fan-out

A fan-out (a Workflow or a multi-Agent dispatch) whose next phase depends on the FULL set must assert
`received === expected` at that boundary and THROW on a shortfall — a dropped unit that isn't counted is
invisible, `COMPLETED` is not `COMPLETE`, and the run envelope lies both ways. The one normative statement
of this rule — R1–R6, the two sanctioned shortfall paths (halt-and-repair · declared-degraded), the
reference primitive, and the hardened declared-degraded escape-hatch grammar — lives in
`.agent-docs/reference/fail-loud-dispatch-contract.md` and is mechanised by the `dispatch-gate` PreToolUse
hook; this section points there and never restates it.

### Observation integrity (before anything is RECORDED as seen)

A filtered, failed, or truncated view is byte-indistinguishable from a clean or empty world — so every
observation that becomes a recorded verdict must pass: *"if this instrument were broken, empty, or
truncated, would my output look any different?"* The one normative statement — the three failure shapes
(tool-failed-silence · stored-verdict-rot · query-inverted-from-proposition), the five runtime rules
(pinned-runner-only · assert-exit-0 · no-stderr-suppression-on-verification · empty==clean-owes-a-
same-run-canary · harness-summarized-views-owe-raw-source-re-derivation), and the per-gate ENTAILMENT
requirement — lives in `.agent-docs/reference/observation-integrity.md`; this section points there and
never restates it. Seam: fail-loud governs COMPLETENESS, observation-integrity governs SEEING, the
deferral test governs OMISSION — a verdict must survive all three.

## Interrupt triage — inbound mail is a doorbell, not a detour

When a message lands mid-work (agent-room mail, or any async inbound), CLASSIFY before
acting — the protected resource is the main workstream's context. Four rungs, first match
wins:

1. **FYI / answerable in a sentence** → answer inline or just note it; no ceremony. Never
   spawn a dispatch for ack-class work.
2. **Real work, no operator judgment needed** → **dispatch it to a sub-agent IF DISPATCH IS
   AUTHORIZED IN THIS SESSION; otherwise put the one-line ask and continue** (rung 3's form).
   When it does run: under the full dispatch contract, the fail-loud contract, and the
   one-voice fence (it reports back to YOU, never to the room) — then RETURN to the main
   thread. The interrupt never rides the main context.

   > **THE HARNESS OUTRANKS THIS FILE ON WHETHER TO DISPATCH AT ALL.** Some harnesses inject a
   > standing instruction — *"do not use the Agent tool / workflows unless the user requested
   > it"* — and the orchestration tool's own description may gate itself on explicit opt-in.
   > **Where a harness instruction and this file disagree, THE HARNESS WINS and this rule
   > degrades to an ASK.** It never upgrades to a self-grant.
   >
   > **THIS KIT NEVER AUTHORIZES DISPATCH. It tells you when to ASK for one and what to ask
   > for.** A rule you are carrying is not a request the operator made — treating shipped
   > text as standing consent is an agent manufacturing its own authorization, which is the
   > failure this fence exists to prevent, not an exception to it.
   >
   > **Authorization is real when it comes from the operator's own surface**, in any of:
   > the target repo's `CLAUDE.md` (their file, their words), an explicit ask this session, or
   > whatever opt-in keyword the harness documents. If they want standing pre-authorization,
   > that line belongs in THEIR `CLAUDE.md` — not in kit payload, and not inferred.
   >
   > **The ask is one line and carries the shape you recognised**, so the operator decides with
   > the classification already done: *"This is N independent units with a barrier at the end —
   > want me to fan it out, or run it inline? (queuing by default.)"* File the obligations row
   > in the same motion, default-if-silent **inline**. Never block on the answer.
   >
   > **AN AUTHORIZATION FACT IS REPO-LOCAL AND DATED. IT NEVER TRAVELS.** If you record that your
   > operator granted standing dispatch authorization, record it as WHAT THEY SAID AND WHEN —
   > *"operator instructed X, in-session, YYYY-MM-DD"* — never *"this paragraph is that request."*
   > The second form is circular: a later session reads the bullet and the bullet vouches for
   > itself. And mark it DO-NOT-UPSTREAM, because in a kit-lineage repo THE FILE ITSELF IS THE
   > TRANSPORT — content here gets harvested into shipped payload, and a local grant promoted
   > upstream becomes exactly what this fence exists to remove. The fence above stops an agent
   > granting itself permission; it does NOT stop a grant being harvested out of a repo that feeds
   > the kit. Two different holes. DATED RECORDS GO STALE ON PURPOSE — an instruction given in July
   > is not consent in November.
3. **Needs operator judgment / adjudication** → ASK-DON'T-BLOCK: put ONE question to the
   operator ("side-quest this now, or queue it?") AND file the obligations-ledger row in the
   same motion (default-if-silent: queue) — the ask must survive the operator being away and
   your own compaction. Then continue the main thread.
4. **Bigger than one dispatch** → durable filing: an obligations row with a trigger (or a
   backlog entry) so the orient/handoff sweeps keep it in view. Anything not on disk at the
   next boundary is gone.

Unsure which rung → rung 4 plus the rung-3 one-liner. Cheap-and-reversible beats
misclassified.

**The payload-inlining hazard (why the read-then-act rule is net-enforced, not text-only):** a
notification channel that INLINES the message body trains agents out of the state-advancing read —
the content is already in context, so the cursor-advancing read feels redundant, and the lazy path
diverges from the correct one precisely because the notification was helpful. Any rule whose correct
path costs more than its lazy path decays under convenience and must be carried by a NET (a hook that
re-delivers unconsumed state, a gate that blocks the skip), never by rule text alone. Corollary for
mechanism designers: put the rule in the OPERATIVE surface (the hook/nag the agent actually follows),
not the broadcast — agents follow the nag, not the announcement.

(Lineage: work-unit INTAKE miniaturized for interrupts — the handler stays short: capture,
route, return.)

## Context lifecycle

- `/orient` at session start, `/flush` mid-session, `/handoff` at session end / pre-compaction. Write a
  write-once 10-point checkpoint at any zero-loss boundary — it preserves the dead-ends + rejected
  alternatives a naive summary deletes.
- Update `now/*` + `log.md` as a byproduct of work, not a separate task.
- At ~80% context usage, proactively propose `/handoff` before continuing.

## Commits, external deps & data safety

- **Conventional commits**, HEREDOC for multiline messages; **don't push without an explicit go** (a branch
  may accumulate many local commits before the push gate).
- **Currency-check before pulling in / touching ANY external artifact** (packages, base images, CLI tools,
  CI actions): verify the latest stable version + deprecation status of the *exact* API used against
  **current-year primary docs**, never training data. Search the current year for versions and framework state.
- **Never commit secrets, credentials, or regulated / user data** to any tracked file (docs, code, configs,
  fixtures). Reference paths / store keys, never literal values. Detail in `sensitive-data.md`.
