---
provenance: llm-draft
created: 2026-07-03
last-modified: 2026-07-29
tags: [current, lessons, proposals]
related: [MOC, ../../lessons/index]
---

# Lesson proposals — staging

Two-step human-gated promotion. Candidates land here as seedlings; `/handoff` §7c surfaces each for
**accept / defer / reject**. Accepted → `../../lessons/<slug>.md` + a `lessons/index.md` entry (+ an
MOC row if Tier-1). Rejected → removed, with a one-line reason in `log.md`.

<!-- New candidates appended below as fenced lesson stubs (provenance: llm-draft, maturity: seedling). -->

*(Previously — `LP-005` accepted 2026-07-27 and promoted to
`lessons/a-written-down-trap-is-not-a-disarmed-trap.md`, evergreen, with an MOC row. Its acceptance
shipped `OQ-010` rather than a note-to-self, per its own claim.)*

*(Staging empty — `LP-006` accepted 2026-07-28 and promoted to
`lessons/a-correct-mechanism-with-an-inverted-consequence-is-invisible-to-controls.md`, evergreen,
with an MOC row. Three firsthand instances in one day, the third inside the commit recording the
second.)*

### LP-007 (seedling · llm-draft · 2026-07-29) — A rule held as a PROCEDURE does not transfer; only a rule held as a QUESTION does

- **Trigger:** you are in a situation that rhymes with one your disciplines cover, but the artifact in
  front of you is not the artifact the discipline names.
- **Claim:** a discipline encoded as *"for file X, do steps 1-4"* fires on **recognition of X**. A
  discipline encoded as *"before any Y, ask Z"* fires on **recognition of the situation**. Only the
  second generalizes. The first feels identical from the inside — you have the rule, you have used it,
  you can recite it — and it silently fails to apply one directory sideways.
- **Evidence (firsthand, 2026-07-29):** I ran the full skip-worktree dance on modelmux's `CLAUDE.md`
  (`OQ-003`) *specifically so a machine-local localhost path would not reach git*. **Sixty minutes
  later** I inserted a localhost `ANTHROPIC_BASE_URL` into a **tracked** file in a peer's **public**
  repo, and reported it as "one insert, hooks byte-identical" — true, and silent on tracking status. It
  nearly shipped in that agent's queued 17-file docs commit. I was asking *"did I break their hooks?"*
  (a procedure question about a known artifact) instead of *"will this travel?"* (a situation question).
- **Severity:** high — the failure mode is invisible precisely to someone who HAS the relevant
  discipline and has recently exercised it, which is the population least likely to re-derive it.
- **Note for review:** distinct from `LP-005` — there a documented trap never reaches the point of use;
  here the discipline reached me and I had just executed it correctly. Distinct from `LP-006` — no
  inference was involved; I never formed the "therefore" because I never asked the question. Candidate
  mitigation: when writing a procedure into an `OQ`/runbook, also write the one-line QUESTION it answers,
  and put the question where the situation occurs rather than where the file is named.

### LP-009 (seedling · llm-draft · 2026-07-31) — A defect cited as JUSTIFICATION outlives its own remediation

- **Trigger:** you are about to cite a past defect as the reason something matters — in an OQ body, an
  ADR Context, a lesson's evidence, a commit rationale, a config comment, a message to a peer. Also:
  you just FIXED something that other documents cite as motivation.
- **Claim:** fixing a defect does not touch the arguments that cite it. A citation lives in prose, a
  fix lives in code, and **no gate joins them** — so a motivating example stays word-for-word true as
  HISTORY while reading as a claim about the PRESENT. The stronger the motivating example, the more
  load-bearing the stale citation becomes. **When you cite a defect as motivation, re-derive whether
  it is still there**; a citation of a fixed defect is byte-indistinguishable from a live one.
- **Evidence (firsthand, 2026-07-31, caught only because an external peer asked everyone to run a
  grep):** `OQ-008` motivates its whole "frozen tables rot" argument with *"which is exactly how the
  README came to ship `gpt-5.3-codex`, a model that does not exist."* True: `fd08a9a` shipped
  `flagship = "codex:gpt-5.3-codex"` as a working example. **But `5e862d8` fixed it** — the slug has
  since appeared only in a ❌ Rejected column beside a live-probe date. I quoted the motivation
  forward as PRESENT tense into a commit body (`38cd513`), the live proxy config, this repo's journal,
  and **twice into messages to a peer**. Re-deriving it took one `git log -S`. Corrected in `be97ee3`.
- **Severity:** high — not for the instance, but because the class is invisible to the obvious sweep.
  A peer's fleet-wide grep hunts version STRINGS; this is a false statement ABOUT one, and matched
  only by coincidence (it quotes the slug). Phrased *"our README ships a model that does not exist"*
  it is undetectable by that check entirely.
- **Note for review:** distinct from the peer's five shapes (a script, a prohibition clause, a
  benchmark-in-an-ADR, a version-keyed price table, a rule restated in a charter). Theirs share one
  mechanism — *the world moved and the text stood still*. This one **inverts** it: **we fixed the
  thing and the text stood still**, so the trigger is an internal commit rather than an external
  vendor event. Nearest neighbour is the benchmark-in-an-ADR, and the difference is load-bearing:
  there the measurement remains true and the SELECTION drawn from it is unwarranted; here the cited
  CONDITION is no longer true at all, and we are the ones who made it untrue.
- **Second-order, worth keeping even if the lesson is rejected:** the claim TRANSITED to a peer twice,
  carrying measurements that made it credible. Payload was clean and all four trees invented their
  defects independently — but **an inter-agent channel is itself a carrier**, and it strips provenance
  the same way quoting strips a date. "Structural, not contagious" understates the risk once the
  agents talk to each other.

### LP-008 (seedling · llm-draft · 2026-07-29) — A test can SPECIFY a defect, and then every gate defends it

- **Trigger:** a gate is green over code you are about to trust, especially code that moves money,
  credentials, or data across a boundary. Also: any time you write an assertion whose name begins
  "X prefers Y" or otherwise encodes a POLICY rather than a property.
- **Claim:** `LP-003` says a guard you have never watched fail is not yet a guard. This is the
  sibling failure and it is worse, because it survives that test: a guard that **is** non-vacuous,
  **does** go red when broken, and asserts the **wrong proposition**. Nothing in the apparatus can
  see it — the suite is green because the code matches the spec, and the spec is the bug. **A guard
  aimed at the wrong proposition is worse than no guard**, because it converts a defect into a
  requirement and every future gate defends it.
- **Evidence (firsthand, 2026-07-29, and it cost real money):** `test/upstreams.test.ts` carried
  `test("anthropic leg PREFERS env ANTHROPIC_API_KEY as x-api-key")`. It was correct, non-vacuous,
  and green from the day it was written. It specified that a proxy should substitute a METERED key
  for the caller's SUBSCRIPTION credential. **93 orchestrator requests, ~15.2M input tokens** were
  billed to the wrong account, past lint, typecheck, 194 tests and CI — every one of which passed
  *because* the assertion said the behaviour was correct. The runtime tell (a 200 answered to a
  credential-less request) was visible for hours and read as trivia.
- **Severity:** high — it is the failure mode that a fully-disciplined test suite cannot detect by
  construction, and it is most likely exactly where the stakes are highest (auth, billing, deletion,
  egress), because those are the paths people write explicit policy assertions about.
- **Note for review:** distinct from `LP-003` (vacuity — the guard cannot fire) and from `LP-006`
  (inference — the observation was right and the "therefore" was wrong). Here the observation, the
  instrument, AND the guard are all sound; the *specification* is wrong. Candidate mitigation: for any
  assertion that encodes a POLICY on a money/credential/destructive path, write the sentence the test
  makes true and ask whether you would sign it — "modelmux substitutes a metered key for a
  subscription credential" is not a sentence anyone would have signed. A property test survives
  refactors; a policy test outlives its own justification.
