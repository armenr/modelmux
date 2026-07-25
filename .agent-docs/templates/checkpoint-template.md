<!--
Checkpoint template — the 10-point zero-loss sitrep. The RATIONALE for each point lives in
CONVENTIONS.md §6 (canonical); this scaffold does NOT restate it — read §6 once, then fill.
Instantiate to `.agent-docs/checkpoints/YYYY-MM-DD-HHMMSS-<slug>.md` (UTC filename, machine-sortable:
  date -u +%Y-%m-%d-%H%M%S). Keyed to the active WU.
WRITE-ONLY: never edited after write. New information = a NEW checkpoint referencing this one (§6).
Delete this comment block + the inline guidance once filled in.
-->

---
provenance: llm-autonomous
template-version: 1.0.0
created: <YYYY-MM-DD>            # LOCAL date in front-matter (§2); UTC only in the filename
last-modified: <YYYY-MM-DD>
work-unit: WU-NNNN
tags: [checkpoint]
---

# Checkpoint YYYY-MM-DD-HHMMSS — <slug>

<!-- All ten points are MANDATORY (CONVENTIONS §6). The one-liners below name each point; §6 says WHY. -->

1. **Mission / objective** — main objective + active WU + the side-quest / detour stack (what spawned each detour → what it found → resolved/open).
2. **Current state** — branch, working-tree shape, what builds/runs right now.
3. **Work completed this segment** — concrete deliverables, each tied to its WU.
4. **In-flight / interrupted** — exact pause point + the next concrete action.
5. **Decisions made (with rejected alternatives)** — chosen + rejected + why (mirrors the ADR Alternatives field).
6. **Investigation results (including dead-ends)** — paths that did NOT pan out + the reason. *(The clause a summary deletes.)*
7. **Open questions / blockers** — OQ-NNN refs; what is undecided/blocking, and on whom.
8. **Files / artifacts touched** — paths + one-line why + wiring/reachability status of each.
9. **Next actions** — the ordered resume queue, precise enough to act on cold.
10. **Addendum check** — re-read points 1–9: what would be LOST if this were the only surviving record? Name anything still living only in conversation, and add it here.
