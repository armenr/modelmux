<!--
Lesson / near-miss template per CONVENTIONS.md §2 + §4 (LP-NNN spine) + §8 (versioned templates).
Instantiate to `.agent-docs/lessons/<kebab-slug-of-claim>.md`. Atomic entries; APPEND-ONLY; read
before action. Three-axis front-matter (provenance × maturity × severity) + an entry_type
discriminator. Promotion is always human-gated: llm-draft → llm-reviewed; seedling → budding →
evergreen. Keep the sections for YOUR entry_type; delete the other variant's sections.
Delete this comment block + the inline guidance once filled in.
-->

---
id: LP-NNN                       # §4 spine — the lesson's typed id
entry_type: lesson              # lesson | near-miss
provenance: llm-draft           # llm-draft | llm-reviewed | human (promotion is human-gated)
template-version: 1.0.0
maturity: seedling              # seedling → budding (applied 1+) → evergreen (recurred 3+, in Tier-1 MOC)
status: active                  # active | superseded | deprecated | quarantined (model/harness-bound)
severity: low                   # low | medium | high
module: system                  # memory | planning | action | reflection | system
type: false-belief              # false-belief | over-generalization | staleness | tool-failure | near-miss
tags: []
created: <YYYY-MM-DD>
last-modified: <YYYY-MM-DD>
last-applied: <YYYY-MM-DD>
superseded-by: null
---

# <Title — claim-y, stable>

## Question
<!-- What situation raised this? -->

## Claim (the lesson)
<!-- When X, do Y, because Z. One durable, restatable sentence. -->

## Evidence
<!-- log.md timestamp / git SHA / ADR / INC — REQUIRED past the seedling stage. -->

## Trigger (when this fires)
<!-- Concrete detection: the paths, commands, or error messages that signal this is happening now. -->

## Failure mode                  <!-- lesson variant — the consequence if this lesson is ignored -->

## Mitigation / Action items     <!-- lesson variant — severity=high ⇒ name an owner + a due date -->

## What almost happened          <!-- near-miss variant — delete for a plain lesson -->

## What made the save reliable   <!-- near-miss variant — delete for a plain lesson -->

## Recurrence count              <!-- near-miss only — N=3 ⇒ propose promotion to the Tier-1 MOC -->
