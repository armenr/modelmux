---
entry_type: lesson
provenance: llm-reviewed
maturity: evergreen
status: active
severity: high
module: testing
type: engineering
created: 2026-07-29
last-modified: 2026-08-04
last-applied: 2026-07-31
related: []
tags: [lesson, testing, specification, billing, auth, non-vacuity]
---

# LP-008 — A test can SPECIFY a defect, and then every gate defends it

**Question.** Your suite is green over code that moves money, credentials or data across a boundary.
Green means the code matches the spec — but what if the spec is the bug?

**Claim.** `LP-003` says a guard you have never watched fail is not yet a guard. This is the sibling
failure and it is worse, because it **survives that test**: a guard that IS non-vacuous, DOES go red
when broken, and asserts the **wrong proposition**. Nothing in the apparatus can see it — the suite is
green *because* the code matches the assertion, and the assertion is the defect. **A guard aimed at
the wrong proposition is worse than no guard**, because it converts a defect into a requirement and
every future gate then defends it.

The tell is an assertion name that encodes a **policy** rather than a **property**. "X returns Y for
input Z" is a property. "X *prefers* Y" is a policy — a decision someone made, frozen into a place
where nothing will ever re-examine it.

**Evidence.**
- *The original, and it cost real money.* `test/upstreams.test.ts` carried
  `test("anthropic leg PREFERS env ANTHROPIC_API_KEY as x-api-key")`. Correct, non-vacuous, and green
  from the day it was written. It specified that a proxy should substitute a **metered** key for the
  caller's **subscription** credential. **93 orchestrator requests, ~15.2M input tokens** billed to the
  wrong account, past lint, typecheck, 194 tests and CI — every one passing *because* the assertion
  said the behaviour was correct. The runtime tell (a `200` answered to a credential-less request) was
  visible for hours and read as trivia. Fixed in `39c5adc`; the test is inverted in place with its
  original name preserved in a comment so the history stays legible.
- *Applied, 2026-07-31 — which is what earned this evergreen.* Shipping `ADR-0004` turned four
  pre-existing tests red. Each was triaged against this lesson explicitly: *were they specifying the
  defect, or is this legitimate coverage I am breaking?* All four asserted INLINE `<<route:>>` tags;
  their intent was "a tag routes" and the placement was incidental, so each was moved to the own-line
  form **with its previous assertion recorded in a comment**. Without this lesson the reflex is to
  quietly rewrite a failing test to match new behaviour — which is exactly how a defect gets specified
  in the first place.

**Trigger.** A gate is green over code you are about to trust, especially across an auth, billing,
deletion or egress boundary. Also: any time you write an assertion whose name begins "X prefers Y" or
otherwise encodes a decision rather than a fact. Also: any time an existing test turns red under a
deliberate behaviour change.

**Failure mode.** The defect becomes a requirement. Every gate now defends it, and the more rigorous
the suite, the more firmly it is held. Detection cannot come from inside the apparatus — it arrives as
a bill, an incident, or an outsider asking why.

**Mitigation.** Read assertion *names* as claims and ask whether the claim is one you would defend on
its own. When a behaviour change turns an old test red, decide **explicitly** whether it was
specifying the defect or is coverage you are breaking — and record the previous assertion in a comment
either way, so a later reader can see the contract moved rather than finding a test that merely always
matched the code.

**Recurrence count.** 1 originating incident (2026-07-29) + 1 applied use that prevented a repeat
(2026-07-31).
