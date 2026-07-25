---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [hooks, lint, enforcement, schema]
related: [lint-docs]
---

# `lint-docs.py` — the doc-schema linter

This is the **enforcement** that the `.agent-docs/CONVENTIONS.md` *"Lint rules"* section refers to.
CONVENTIONS ships those rules as a spec and is honest that only *index completeness* was ever
hook-enforced; the rest were advisory. `lint-docs.py` makes **all fifteen** real — each a discrete
check with a `PASS` / `FAIL` (or `WARN`) verdict and a `file:line` message — and adds four **kit-local**
checks (16, 17, 18, 19) the spec does not enumerate.

Language-agnostic and dependency-free by design: **stock Python 3, standard library only** (no
`pip install`, no `import yaml` — front-matter is hand-parsed). It runs the same on Linux, macOS/BSD,
and WSL. It never reads a wall clock — the staleness check takes its "now" from `--now`, so a run is
deterministic and reproducible in CI.

## Usage

```
lint-docs.py [--root DIR] [--now YYYY-MM-DD] [--warn-days N] [--fail-days N] [--extra-id-prefixes LIST]
```

| Flag | Default | Meaning |
|---|---|---|
| `--root DIR` | `.agent-docs` | Root of the `.agent-docs/` tree to lint. |
| `--now YYYY-MM-DD` | *(unset)* | Reference date for the `now/` staleness rule. **Omit to skip staleness** — the linter never invents a clock. |
| `--warn-days N` | `7` | `now/` age (days) above which a doc warns. |
| `--fail-days N` | `90` | `now/` age (days) above which a doc is "hard-stale" (still a WARN — see rule 12). |
| `--extra-id-prefixes S,U,…` | *(unset)* | Comma-separated **local** typed-ID prefixes to also treat as resolvable non-file ledger ids for rule 8 (see the rule-8 note). For spines the kit deliberately does not canonize; wire it into the caller — no linter edit. |

**Exit status:** `0` when clean (or warnings only) · `1` when any `FAIL` was reported · `2` on a usage
error (bad `--root`, bad `--now`). **Warnings never change the exit code.** Output is grouped by rule.

## The checks (rule → CONVENTIONS mapping)

Rules 1–15 map 1:1 to a numbered entry in the CONVENTIONS *"Lint rules"* section; **16–19 are kit-local**
(marked as such in the last column).

| # | Check | Class | CONVENTIONS ref |
|---|---|---|---|
| 1 | Front-matter present + parseable | FAIL | Lint rule 1 · §2 |
| 2 | Required fields populated (`provenance`, `created`, `last-modified`) | FAIL | Lint rule 2 · §2 |
| 3 | `provenance` in the allowed set | FAIL | Lint rule 3 · §2 |
| 4 | ADRs have a valid `status` | FAIL | Lint rule 4 · §2/§5 |
| 5 | `status: superseded` ⇒ non-null `superseded-by` | FAIL | Lint rule 5 · §2/§5 |
| 6 | `status: pending` ⇒ `pending-on`; `deferred` ⇒ `deferred-because` | FAIL | Lint rule 6 · §2 |
| 7 | ADRs contain a non-empty `## Alternatives Considered` | FAIL | Lint rule 7 · §5 |
| 8 | `related` / `supersedes` / `superseded-by` / `archived-from` references resolve | FAIL | Lint rule 8 · §2 |
| 9 | File path matches category — active ADR placement (`decisions/`); a checkpoint **and** a calendar-dated artifact are *classified by directory*, not by shape alone | FAIL | Lint rule 9 · §1/§3 |
| 10 | Accepted ADRs are not `llm-draft` / `llm-autonomous` | FAIL | Lint rule 10 · §2 |
| 11 | Date-prefixed filenames match the date format | FAIL | Lint rule 11 · §3 |
| 12 | `now/` files `last-modified` within the freshness window | **WARN** | Lint rule 12 · §1/§2 |
| 13 | **Index completeness** — every populated content dir has a matching `index.md` | FAIL | Lint rule 13 · §7.1 |
| 14 | Checkpoint integrity — all ten numbered points present | FAIL | Lint rule 14 · §6 |
| 15 | `work-unit:` resolves to a WU in `now/work-plan.md` | FAIL | Lint rule 15 · §4 |
| 16 | Advisory: ADR filenames carrying a redundant `ADR-` prefix (canonical is `NNNN-slug.md`) | **WARN** | kit-local advisory (not a CONVENTIONS rule) |
| 17 | **Obligations receivable integrity** — every `## Owed to me` data row in `now/obligations.md` names a trigger **and** a canonical default-if-silent | FAIL | kit-local (obligations ledger; silent when the file is absent) |
| 18 | **Charter design-review gate** — a `full` risk-tier dispatch-charter whose `status` has left drafting must carry a resolved `REV-NNN` `design-rev`; a charter is recognized by `charter-id` **or** a filename-keyed `FR-NNNN-slug.md` under `dispatch-charters/` | FAIL | kit-local (dispatch-charters; silent when a charter carries no `risk-tier`) |
| 19 | **Baseline-integrity** — a present docs-impact baseline (`reference/docs-baseline.md`) must carry a recorded seal and no parked row's `inventory-date` may post-date it | FAIL | kit-local (docs-impact seal; silent when the ledger is absent; **not** adopt-exempt) |
| 20 | **ID-collision detector (INTERIM)** — one typed-ID numeric key (canonical prefixes + `--extra-id-prefixes`, 1-4 digits) mapping to >1 distinct `PREFIX-NNN-slug.md` file or index entry-row slug FAILs naming all sources — same-number/different-slug collisions merge clean in git and resolve green, so this rule is the surface that notices. COMPANION FILES are legal via the dot form (`PREFIX-NNN.qualifier.md` — a companion of the id's one primary artifact, not a second claimant); the identity-allocation redesign is a separate open program | FAIL | kit-local (citation-graph guard; **not** adopt-exempt) |
| 21 | **Deferral-home typing (tractable core)** — a `DEFER→ <home>` must point at a TYPED-ID home (known or declared prefix); a prose home fails. TYPING only: target existence/OPEN-status and code-comment sweeping are disclosed deferred halves | FAIL | kit-local (accountability line; **not** adopt-exempt) |

### Notes on specific rules

- **Rule 12 ships WARN-only (warn-not-fail by default).** CONVENTIONS describes a 90-day *fail*
  threshold; the linter emits it as a louder warning (`> fail window`) rather than a hard failure, so a
  stale-but-correct doc never blocks a commit or CI gate. `--fail-days` sets where the wording flips
  from "soft" to "hard" stale; it does not change the exit code. A maintainer who wants a hard gate
  flips the single `STALENESS_FAILS` constant at the top of the script. If `--now` is not passed, the
  rule is skipped entirely (no clock is invented).
- **Rule 13 (index completeness) is FAIL here** — it is the one rule the source system already
  enforced by hook, folded in verbatim: for each managed dir it compares the on-disk ``\`file.md\``
  basenames against the `` `file.md` `` backtick tokens in that dir's `index.md`, reporting *missing
  index*, *unindexed* (on disk, not referenced), and *phantom* (referenced, no such file). Cross-dir
  tokens (containing `/`) are ignored — presence-only, by design. Managed dirs are the one-level (and
  one-nested) content dirs under `--root`, **excluding `now/` and `templates/`**.
- **Rule 8 resolution** (tried in order): a **path-qualified** token (contains `/`, or ends `.md`)
  resolves relative to the doc dir then the root — and when it is **extensionless** (e.g.
  `decisions/0001-foo`) the literal path is tried first, then the same path with `.md` appended, so a
  `related:` written without its extension still resolves; `ADR-NNNN` resolves to `decisions/NNNN-*.md`
  **or** `decisions/ADR-NNNN-*.md` (the filename prefix is optional — see rule 16); the canonical typed
  ledger ids (`OQ-`, `WU-`, `LP-`, `REV-`, `RV-`, `FR-`, `R-`, `INC-`) are treated as resolvable non-file
  references; a **bare stem** resolves to `<doc_dir>/<stem>.md` or `<root>/<stem>.md`; and **last**, a bare
  slug that matched none of the above is scanned for across the managed content dirs — the rule-13 set
  **plus `now/`** (the live-state dir rule 13 does not index but a `related:` legitimately points into) — as
  `<slug>.md`. A single unambiguous hit resolves, while **two or more** hits keep the FAIL and report
  *"ambiguous across N content dirs (…) — qualify it with a path"* so the author disambiguates by adding the
  directory. Including `now/` here is safe *because* of that ambiguity-FAIL: a slug that also lives in
  another content dir goes ambiguous rather than silently mis-resolving, so scanning the live-state dir can
  never pick the wrong target. `templates/` and dot-dirs stay excluded. The content-dir scan is deliberately
  **last** so typed ids and path-qualified refs keep their exact prior semantics. **`REV-`** (reviews subsystem — `REV-NNN`, Standard tier) is distinct
  from **`RV-`** (REVISIT anchors); the alternation is ordered longest-first so `REV-` is never swallowed by
  `RV-`/`R-`. To also recognize **local** spines the kit deliberately does not canonize (e.g. a slice/unit
  `S-`/`U-` spine), pass `--extra-id-prefixes S,U,…` — those prefixes then get the same resolvable-ledger-id
  treatment. It is an extension seam in the caller's wiring, so it stays upgrade-safe (no keep-local fork of
  the linter).
- **Rules 9 & 14 — a checkpoint is classified by directory + shape, not shape alone.** A file counts as a
  checkpoint only when it lives directly under `checkpoints/` **and** carries the timestamped
  `YYYY-MM-DD-HHMMSS-<slug>.md` shape. A date+time-named file **elsewhere** (an `audits/` record, say, that
  legitimately shares that filename shape) is therefore **not** a checkpoint: it gets no checkpoint-integrity
  check (rule 14) and no "misplaced checkpoint" finding (rule 9). Rule 9 accordingly performs **ADR
  placement only** — an `NNNN-slug.md` ADR must live in `decisions/` — and the timestamp shape is excluded
  there so a checkpoint is never misread as a misplaced ADR by the leading digits it happens to share.
  Checkpoint *placement* is no longer a shape-triggered check, because the shape alone cannot distinguish a
  stray checkpoint from a same-named audit artifact; the directory is the only reliable signal. **The same
  logic covers a plain calendar-dated name** (`YYYY-MM-DD-<slug>.md`, no `HHMMSS` — an incident / audit /
  dogfood record): its leading four digits satisfy the ADR filename shape, but the directory decides, so a
  dated file **outside** `decisions/` is excluded from ADR placement and never flagged as a misplaced ADR.
  A genuine `NNNN-slug` ADR is unaffected — its second segment is a title word, not a two-digit month, so it
  does not match the date shape.
- **Rule 16 (ADR-prefix advisory) ships WARN-only.** An adopter whose ADR files are named
  `ADR-NNNN-slug.md` is fully recognized — the ADR rules run and references resolve either way — but
  one advisory per run names the canonical unprefixed form, so drift converges without a forced rename.
- **Rule 17 (obligations receivable integrity) keys on a runtime file.** It fires only when
  `now/obligations.md` exists — the standalone **multi-party** obligations ledger. A single-party / Minimal
  install ships no such file (the same rows live as an `## Obligations` section inside `now/handoff.md`
  instead), so the rule **passes silently** when the file is absent. When present, it parses the
  `## Owed to me` table and requires, on every **data** row, both a non-empty **Trigger / by-when** cell
  (without it a receivable can never come due) and a **Default-if-silent** cell beginning with one of the
  canonical dispositions — **`chase-once`**, **`apply-default`**, **`never-chase-never-peek`** (a row may
  append a clause after the token). Both cell checks **strip leading markdown emphasis** (`**`, `*`, `_`,
  backtick) before comparing, so a cosmetically bolded value — the template legend bolds these tokens,
  e.g. `**never-chase-never-peek**` — still matches its canonical form; cosmetic markdown must not fail a
  canonical check. Each violation is a `FAIL` naming the row's *Counterparty / What*. Rows
  the template ships between the `<!-- example:start -->` / `<!-- example:end -->` markers are illustrative
  (delete-on-first-use) and are **skipped**; the header and separator rows are skipped too. Columns are
  found by **header name** (a cell containing "trigger" / "default"), not by position, so the exact schema
  wording is tolerated. A table the parser cannot make sense of degrades to **one `WARN`** naming the file —
  never a traceback (the portability contract: a malformed doc is a finding, not a crash). The `## Owed by
  me` (debt) table has no silence rule and is not checked by this rule.
- **Rule 18 (charter design-review gate) keys on a front-matter field.** It applies only to a
  **charter-shaped** doc — one whose front-matter carries a `charter-id` (a dispatch-charter `FR-NNNN`; the
  long-term mission `charter.md` has no `charter-id` and is never a target). Two fields govern it:
  `risk-tier` (`standard` | `full`) and `design-rev` (a `REV-NNN` id). A **full**-tier charter may not
  advance its `status` past the drafting phase (`drafting` | `draft`) without a `design-rev` that is
  non-empty, matches `REV-NNN`, **and** resolves through the **same** reference machinery rule 8 uses
  (`REV-` is a canonical ledger prefix) — the pre-G0 multi-lens design review a full-risk surface
  (turn-control, shared-write state, contracts, irreversible surfaces) earns before it leaves drafting.
  A **standard**-tier charter carries no such gate. **Brownfield-safe:** a charter with **no `risk-tier`
  field at all** passes **silently** (the same absent-artifact precedent as rule 17), so an adopter's
  pre-kit charters never retro-fail. A `risk-tier` present but outside `{standard, full}`,
  or any charter whose front-matter the rule cannot make sense of, degrades to **one `WARN`** naming the
  file — never a traceback. Kit-shipped charter scaffolding (`templates/`, `.template.md`,
  `provenance: kit-template`) is skipped, so a seed's placeholder `design-rev` is never a live violation.
  **Charter detection is `charter-id` OR filename-keyed.** A charter is recognized by a `charter-id`
  front-matter field (canonical) **or** by an `FR-NNNN-slug.md` filename directly under a
  `dispatch-charters/` (or `dispatch/`) dir — the same *recognize-not-canonize* move rule 16 makes for
  `ADR-NNNN` filenames. Without the filename branch a filename-keyed charter (identity in the filename, no
  `charter-id`) early-returned the detector and the whole gate silently no-op'd on it — a silent-vacuity
  hole. The long-term mission `charter.md` matches neither (no `charter-id`, wrong filename shape) and is
  never a target.
- **Rule 19 (baseline-integrity) enforces the docs-impact SEAL contract statically.** The docs-impact
  baseline (`reference/docs-baseline.md`, `baseline-mechanism.md` §"Anti-laundering") parks inherited
  drift so a diff-scoped gate does not drown a brownfield adopter — and "new debt loud" rests on that
  baseline being **sealed and write-once**, never a laundry where a just-broken claim is re-labelled
  "inherited." When the ledger exists this rule requires a recorded **seal** (`baseline-sealed-at` in
  `.kit-manifest.json` **or** the ledger header) and that **no parked row's `inventory-date` post-dates
  the seal** (a post-seal row is a suspected launder — only the sealed one-shot inventory writes rows).
  An unsealed ledger, a seal without a parseable date, or a row with no parseable `inventory-date` are each
  a `FAIL`. It keys on the runtime **file** — **silent** when the ledger is absent (a cold-start /
  no-baseline repo, the rule-17 absent-artifact precedent) — and, like rule 17, is **not adopt-exempt**:
  it guards the accountability line, not a schema convenience, so it fires regardless of any manifest
  `action: adopt` row. The git-history half ("a row's claim was *edited* after the seal") needs a diff and
  is the `doc-refs` sweep's job; this rule covers the statically-checkable invariants. A ledger the parser
  cannot make sense of degrades to **one `WARN`** naming the file — never a traceback.
- **Adopt-exemption (retro-adopted corpus).** Docs recorded `action: adopt` in
  `.agent-docs/.kit-manifest.json` predate the kit and carry no kit front-matter, so the schema-class
  rules (1, 2, 3, 4, 5, 6, 10, 12) **plus rule 14 (checkpoint integrity)** are skipped for those paths;
  rule 13 (index completeness) still applies so they stay visible. Rule 14 is exempt because checkpoints
  are **write-once**: a checkpoint authored before the ten-point format cannot be retro-edited to pass, so
  an adopted row must exempt it — while a freshly-written checkpoint is never adopted and stays fully
  checked. A missing or malformed manifest yields no exemptions and never crashes the run.

## What gets linted — the template stance (documented choice)

The linter walks **every `*.md` under `--root`**. It draws one distinction:

- **Instantiated docs** get the full rule set.
- **Kit-shipped scaffolding gets a relaxed pass.** A doc is treated as scaffolding when its name ends
  `.template.md`, **or** it lives under a `templates/` dir, **or** it still carries
  `provenance: kit-template`. For scaffolding the *structural* rules still apply (front-matter present
  + parseable, required fields, allowed provenance, filename/category shape), but the rules that assume
  a fully instantiated tree are **skipped**: cross-reference resolution (rule 8), `now/` staleness
  (rule 12), and WU resolution (rule 15). Rationale: a seed legitimately holds `{{PLACEHOLDER}}` tokens
  and points at sibling names that only exist once installed — linting those as if instantiated would
  flag the kit against itself. The ADR/checkpoint body rules key off directory + filename shape
  (`decisions/[ADR-]NNNN-*.md`, `checkpoints/DATE-*.md`), so a template in `templates/` is never mistaken
  for the real artifact.

The linter reads its own two `.template.md` neighbours cleanly, including the leading `<!-- guidance -->`
comment block those templates open with and the trailing `# inline comments` on their front-matter
values.

## How it is wired

### Pre-commit (the enforcement point)

Add to the project's pre-commit hook so a schema-violating doc cannot be committed. The path is
relative to the installed `claude/hooks/` location.

```sh
# --- doc-schema lint (only when .agent-docs docs are staged) ---
if command -v python3 >/dev/null 2>&1; then
  if git diff --cached --name-only | grep -q '^\.agent-docs/.*\.md$'; then
    python3 .claude/hooks/lint-docs.py --root .agent-docs || {
      echo "doc-schema lint failed — fix the FAILs above, or see CONVENTIONS.md 'Lint rules'." >&2
      exit 1
    }
  fi
fi
```

`command -v python3` guards a machine without Python 3 — the check degrades to a no-op rather than
hard-failing the commit (the kit's portability contract).

### Optional: SessionStart (advisory freshness nudge)

Wire into a `SessionStart` hook to surface `now/` staleness as a non-blocking nudge at the top of a
session — pass today's date so the deterministic check has a reference point. A `SessionStart` hook speaks
the JSON hook protocol (`{"additionalContext": …}`), so the linter's **stdout must be folded into a JSON
string, not emitted raw** — raw multi-line output (with colons, quotes, and newlines) is not valid JSON and
would corrupt the hook message. `jq -Rs` reads all of stdin as one raw string and escapes it safely.
**Capture the output first** so a linter that cannot speak still yields a real advisory instead of a
silently blank one:

```sh
if command -v python3 >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  out=$(python3 .claude/hooks/lint-docs.py --root .agent-docs --now "$(date +%Y-%m-%d)" 2>/dev/null)
  [ -n "$out" ] || out="doc-linter errored — run .claude/hooks/lint-docs.py by hand"
  printf '%s' "$out" | jq -Rs '{additionalContext: .}'
fi
```

Staleness is WARN-only and a `FAIL`-carrying report still exits non-zero, but that exit is **contained
inside the `$(…)` capture**, so it never propagates and the hook never blocks a session — it just surfaces
what has drifted as session context. The capture is also what **hardens against a linter that cannot
speak**: the previous `… | jq … || true` form swallowed a crash or a `--root` / `--now` usage error into an
*empty* pipe, and `jq -Rs` on empty stdin emits `{"additionalContext":""}` — a silently blank nudge that
looks like "all clear". Here, if the run produces no stdout (a crash, or usage exit `2` — stderr is sent to
`/dev/null` so it can't masquerade as a report), the `[ -n "$out" ]` test substitutes the fallback line
`doc-linter errored — run .claude/hooks/lint-docs.py by hand`, and `jq -Rs` always escapes a **non-empty**
string, so the message stays JSON-safe. A missing `python3` **or** `jq` makes the guard false, so the hook
emits nothing and degrades to a no-op (the kit's portability contract).

## Self-test

Run it against the kit's own skeleton, and against a throwaway good/bad fixture:

```sh
# The Minimal skeleton — passes clean once its templates are schema-consistent.
python3 lint-docs.py --root ../../agent-docs

# A broken ADR (bad provenance, no Alternatives, dangling related:) fails with three grouped FAILs.
python3 lint-docs.py --root /path/to/fixture/bad   # exit 1
python3 lint-docs.py --root /path/to/fixture/good  # exit 0
```

Rule-specific red/green fixtures (each proves the check is non-vacuous — plant → FAIL → remove):

```sh
# Rule 13 (index completeness — entry-detector anchoring). A token counts as an index entry ONLY on an
#   ENTRY ROW: a `- ` list-marker row (optionally after an emoji marker, e.g. `- 🔍 `foo.md``) or a `|`
#   ledger-table row (`| `foo.md` | … |`) — never a bare backtick token in prose, an indented
#   `**Open when:**` continuation line, or inside an `<!-- … -->` HTML comment block (both are stripped /
#   skipped BEFORE counting). RED-a: a populated dir whose index.md carries a kit-shipped
#   `<!-- EXAMPLE … `architecture-overview.md` … -->` block → that commented row is counted as a PHANTOM
#   (in index, no such file) and --strict fails. RED-b: the same index names `notes.md` in a prose
#   sentence, or `orphan.md` in an `**Open when:**` continuation line → each is miscounted as a phantom.
#   GREEN: strip the comment span + anchor on the row shape → only the real `- `x.md`` / `| `x.md` |`
#   rows count → clean. NEGATIVE control (proves non-vacuity): a real doc on disk NOT named on any entry
#   row is still flagged UNINDEXED, and a real `- `gone.md`` entry row with no file on disk is still
#   flagged PHANTOM. (Same two-guard logic in the standalone lint-agent-docs-indexes.sh --strict lane.)

# Rule 18 (filename-keyed charter). RED: dispatch-charters/FR-0007-x.md with `risk-tier: full`,
#   `status: accepted`, and NO `charter-id`, NO `design-rev` → FAIL 18 (the detector no longer
#   early-returns on the absent charter-id). GREEN: add `design-rev: REV-001` (resolving), OR drop
#   `risk-tier` (brownfield silent pass), OR keep `status: drafting` (gate not yet biting) → clean.

# Rule 19 (baseline-integrity). RED: reference/docs-baseline.md whose manifest records
#   `baseline-sealed-at: 2026-07-01` but which carries a parked row dated `2026-07-12` → FAIL 19
#   (post-seal row = suspected launder). Also RED: the same ledger with NO recorded seal → FAIL 19
#   (unsealed). GREEN: seal present + every parked row dated on/before the seal → clean; and with the
#   ledger absent entirely the rule is silent (cold-start).
```
