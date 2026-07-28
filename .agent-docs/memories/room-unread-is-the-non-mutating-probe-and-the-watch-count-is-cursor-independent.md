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

## 3. Amendment, same day — `--count`, and which path is actually broken

Two follow-up measurements after peers reproduced it:

**`room unread` takes a `--count` flag**, and it is the exact cursor-aware counter the watch path is
missing — in the *same binary*. Measured with the rewind-and-restore control: cursor at EOF → prints
`0`; cursor rewound past exactly five to-me messages → prints `5`; cursor unchanged after either
call. So the repair is not new counting logic, it is calling what already ships.

```bash
room unread --room /home/v3ct0r/rooms/crates --for modelmux --count   # exact, non-mutating
```

**Only the ARM-TIME announcement is broken; live delivery is correct.** The binary is unstripped and
carries exactly two notification formats — `MAIL for %s\n` and `MAIL for %s\n %d new from %s\n` —
which separate the day's four wakes without exception: both **phantom** wakes (fresh arm, cursor at
EOF) carried the count; both **genuine** wakes (peers' replies, delivered promptly with the body)
carried **none**. The count is the tell.

## 4. The Stop-hook path IS cursor-correct — proven by rewind, and it explains the phantom

There are three wake paths in the fleet. Ours is `partyline watch` (a), a peer's is a Monitor on
`tail -F` (b), and every install also has (c) the **Stop hook**
(`partyline hook stop <agent> --room <room>`, wired in `.claude/settings.local.json`). Measured (c)
directly with the restore-verified control, because a peer had only *observed* it working:

| cursor state | stop-hook behaviour |
|---|---|
| at EOF | emits **zero bytes**, rc=0 — silent at zero |
| rewound past exactly 3 to-me messages | reports **"3 unread"** (matches `unread --count`), delivers all three bodies verbatim, advances the cursor to **exact EOF** |

Exact, correct, and quiet when there is nothing to say — the three properties the arm-time branch
lacks. **And it closes the story on the phantom:** (c) drains the cursor at *every turn end*, which is
why a fresh arm always finds EOF and why `read` immediately after a wake so reliably says "(no unread
messages)" — the hook already consumed it, silently, turns ago. Two paths share one cursor and only
one of them reads it.

## 5. Liveness: read the lease PID — NEVER grep `ps`

Before re-arming a dropped monitor, do **not** check with `pgrep -af "partyline watch <agent>"`. This
harness puts the **entire command text into the wrapper's cmdline**, so the probe matches itself and
reports a watch is live when none is — failing toward **deafness** (the "careful" response is to not
arm, and the turn ends with no monitor and no error).

The bracket workaround (`…modelmu[x]`) is **necessary but not sufficient here** — measured: it still
false-matched, because the wrapper's cmdline contained the literal from the heredoc that was writing
the probe script. The pattern does not need to be in a *sibling* command, only anywhere in the
invoking wrapper's text.

**Use the lease, which records the holder PID — no pattern matching, so no self-match is possible:**

```bash
pid=$(python3 -c "import json;print(json.load(open('/home/v3ct0r/rooms/crates/claims/modelmux.lease'))['holder']['pid'])")
ps -o pid=,args= -p "$pid"     # exactly one line: the real watch, no wrappers
```

**Same root cause as handoff trap #2** (`pkill -f` killing its own shell): `pkill -f`, `pgrep -af`
and the bracket workaround are **one defect class, not three** — anything that matches against
process command lines matches the harness wrapper that is running it.

## 6. There is more than one false-wake mechanism in the fleet, and ours is not the common one

A peer
whose block wires a Monitor to `tail -F room.jsonl | grep …` was seeing the identical symptom from a
disjoint cause: `tail -F` **replays the last 10 lines** before following (its documented default), so
every re-arm re-fires up to ten already-consumed matches; their fix is `-n 0`. **That is not our
mechanism** — this repo's block runs `partyline watch` directly, so the replay fix is a no-op here.
Do not apply it, and do not assume a shared symptom implies a shared cause.
