---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-25
last-modified: 2026-07-25
related: []
tags: [doc-lint, tooling, verification, gotcha, false-confidence]
---

# "doc-lint clean — N files checked" is a PARTIAL claim: 17 of our 37 docs have four rules switched off

**Observed:** 2026-07-25, prompted by a `fieldbook` finding and then measured here directly.
`lint-docs.py:595` runs `if templated: return` **above** rules 8, 15, 21 and 12. `is_template()` fires
on `*.template.md`, on anything under `templates/`, **and on any doc whose front-matter `provenance:` is
`kit-template`** — regardless of path. So a doc that is permanent normative content, not scaffolding,
silently skips four rules because of one front-matter value.

On this tree:

```bash
grep -rl '^provenance: kit-template' .agent-docs --include='*.md' \
  | grep -v '\.template\.md$' | grep -v '/templates/'
```

returns **17 of 37 files** — every `index.md`, plus `CONVENTIONS.md`, `charter.md`, `glossary.md`,
`log.md`, `now/lessons/MOC.md`, and four `reference/` contracts. So `lint-docs: clean — 37 file(s)
checked` actually means *"clean on 37 files for some rules, and on 20 files for rules 8/15/21/12."*

**Root cause:** the relaxed pass was designed for scaffolding with unfilled placeholders, and is being
applied to permanent content because **one front-matter value marks both**. Confirmed kit-side by
fieldbook: the kit's own payload ships broken refs that nobody had ever seen because the exemption hid
them.

> **CORRECTION 2026-07-25 (same day, hours after filing) — the claim below this line was wrong, and it
> was the load-bearing one.** This memory originally said `kit-template` is "the **correct** provenance
> for a verbatim-copied kit file and will never be bumped", so the suppression is permanent everywhere.
> fieldbook then re-measured and **corrected their own taxonomy: 17 of their 24 exempt docs are not
> verbatim at all.** Two classes, not one:
>
> - **SEED-THEN-LIVE** — ships as content, then **the adopter writes it**. On this tree, **10 files**:
>   all seven `index.md`, plus `log.md` and `glossary.md`. The label is wrong the moment the first edit
>   lands, and nobody bumps it because the file never looked "instantiated". **I wrote to three of them
>   (`decisions/index.md`, `memories/index.md`, `log.md`) in commit `8a6a3f1` today** — so my own
>   authored content is sitting under a label that disables four rules.
> - **static-normative** — genuinely verbatim, legitimately `kit-template`. On this tree, **7 files**:
>   `CONVENTIONS.md`, `charter.md`, `now/lessons/MOC.md`, and four `reference/` contracts.
>
> **The pair is self-defeating:** rule 13 *mandates* that adopters add rows to `index.md`, and the seed
> label on those same files switches rules 8/15/21/12 off on exactly what the adopter was told to write.
>
> **Two caveats on my own split, both mine to own.** (1) The buckets are **not cleanly separable by
> filename** — I sorted `now/lessons/MOC.md` into static-normative because it isn't named `index.md`,
> but the MOC takes an adopter row per accepted lesson, so it is seed-then-live too. That is my earlier
> "any fix list keyed to filenames will be wrong somewhere" biting my own classification. (2) On **this**
> tree the seed-then-live bucket contributed **zero** of the 2 findings — both came from
> static-normative. Elsewhere the opposite held: another tree's `log.md` produced the only true rule-21
> positive in the entire investigation (a real orphaned `DEFER` forward-pointer). So the *cost* of the
> seed label is tree-dependent even though the *mislabel* is universal.

**What it actually costs us — measured, and smaller than it sounds.** Armed-vs-control (scratch copy,
all 17 flipped to `llm-reviewed`, diff taken so both-arm noise drops out): **2 real findings.**

1. `CONVENTIONS.md:6` → `CONVENTIONS-full-addendum` — a **Full-profile** doc; this is a Standard
   install, so it dangles by construction. fieldbook's RULING 2: a `related:` field may name only
   artifacts present at **every profile the doc ships to**; this one comes out of `related:` and the
   prose pointers at `:17`/`:407` stay and gain "(Full profile only)". **Kit-owned — do not patch.**
2. `reference/fail-loud-dispatch-contract.md:6` → `standing-rules-core` — a real shipped file that
   installs to `.claude/rules/`, i.e. **outside the `.agent-docs/` lint root**, so it resolves in
   nobody's tree. **Kit-owned — do not patch.**

Separately, 22 **prose** citations of `framework-rationale/NNNN` across `reference/baseline-mechanism.md`
(15), `reference/doc-refs-contract.md` (6) and `now/obligations.md` (1) point at a directory that is
kit-origin-only and **never installed at any profile**. No linter has jurisdiction over those; a human
following them hits nothing. Also kit-owned.

**Workaround / fix:**
- Treat a clean doc-lint as **"clean on the rules that ran"**. When the claim matters, run the
  armed-vs-control diff on a scratch copy rather than trusting the headline.
- **Do not patch the kit-owned files** to clear these — fieldbook owns them and the fix arrives on
  upgrade. Adopters patching kit files desync the manifest `sha256` rows.
- **Do not "helpfully" bump the 10 seed-then-live files to `llm-reviewed` either**, tempting as the
  correction now looks. It was measured to add **zero** findings here, so the upside is nil; and the
  manifest `sha256` rows exist precisely to detect a shipped doc diverging from its source, so a
  unilateral frontmatter edit risks tripping the upgrade path for no gain. Wait for the kit fix.
- When the fix ships, re-run armed lint here and report **annotations walked** (rule-21 denominator)
  alongside files scanned — a corpus this size probably has a thin denominator, and a "clean" with zero
  opportunities is vacuous.

**Avoid:**
- Do **not** cite "doc-lint clean — N files" as evidence that references, work-unit fields or deferral
  annotations are sound across the corpus. It is evidence for ~54% of it.
- Do **not** size this by grepping for the hit count. Measured across two trees, hit count is **not**
  debt: 17 hits → 2 findings here, versus aegis's 4 hits → 6 findings. The relationship inverts.
- Do **not** repeat the sampling error that nearly went out from here: the first control flipped **one**
  of the 17 (`log.md`), found zero, and almost got reported as "latent on this tree". `log.md`'s
  references are all live registered ids, making it the file in the set *least* able to produce a
  finding. **A negative control on a subset is only evidence if you can say why the subset is
  representative** — "it was the first one I tried" is not that.

**See also:** `now/open-questions.md` (the tripwire for fieldbook's rule-21 + rule-3 fix landing);
`memories/installed-safety-gate-does-not-protect-this-repo.md` — the same shape, a kit-owned instrument
that silently under-protects this tree.
