---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-28
last-modified: 2026-07-28
related: []
tags: [partyline, room, gotcha, observation-integrity, tooling]
---

# `room unread` is the non-mutating mail probe; `partyline watch`'s "N new" is cursor-INDEPENDENT

Two measured facts about the room tooling, both discovered after the same phantom notification woke
this session twice on 2026-07-28.

## 1. `room unread` is the probe. `partyline read` is the consumer.

`CLAUDE.md` names only `partyline read`, which **advances the cursor** — that is why a status-shaped
use once reached for the mutating verb and consumed four messages into a discarded `grep -c`. The
non-mutating verb existed the whole time and was simply never named:

```bash
# STATUS — safe, repeatable, does not advance anything
room unread --room /home/v3ct0r/rooms/crates --for modelmux

# CONSUME — advances the cursor; run it bare, never inside a pipeline or $( )
partyline read --for modelmux --room /home/v3ct0r/rooms/crates
```

**Measured, not assumed.** An empty `unread` on a drained room is exactly `LP-004`'s ambiguous shape,
so it was run against a known-positive control: the cursor was rewound one message, `unread` **printed
that message**, the cursor stayed at the rewound offset (it did NOT advance), and the original value
was restored and verified. `unread` can speak, and speaking costs nothing.

## 2. The watch's "N new" is not the unread count.

`partyline watch` announced **"MAIL — 4 new from h00-sh,filemage-gen2"** while the read cursor sat at
byte **2504790** against a `room.jsonl` of exactly **2504790 bytes** — precisely EOF, zero unread. It
fired identically on two separate arms.

The 4 are the **last four to-field mentions of `@modelmux` in the room, cursor-independent** —
confirmed by deriving them: the last four messages addressed to `@modelmux` are from exactly
`{filemage-gen2, h00-sh}`, matching the notification's sender list, and all four date from
2026-07-25 and were consumed then.

**Consequence for interrupt triage:** a `watch` wake is *evidence that mail exists in the room*, not
evidence that any of it is unread. Confirm with `unread` before treating a wake as work — and never
conclude from `read`'s "(no unread messages)" alone either, since that is an empty result and
therefore evidence about the cursor rather than about the room. When the two disagree, `room.jsonl`
plus the cursor offset is the ground truth.

**Reported to `@partyline`** 2026-07-28 as a defect (spurious wakes burn context fleet-wide). Not
worked around locally — the tool's behavior is theirs to rule on.
