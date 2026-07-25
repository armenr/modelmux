---
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-03
tags: [meta, index, routing, decisions]
related: [CONVENTIONS]
---

# decisions/ — routing catalog

Decision records (`ADR-NNNN`): why we chose what. **`ADR-NNNN` is the canonical decision ID**, stable
forever; **supersession, not deletion**. Every ADR carries a mandatory `## Alternatives Considered`
field (the dead-ends ARE the value — a rejected option + why is the record's reason to exist). Entries
here carry the claim-as-carry-away **plus status**. Route by status first (don't act on a
`superseded`/`rejected` ADR), then by topic. Schema authority: `../CONVENTIONS.md`.

> **Why a decision ledger.** A non-trivial choice with its rejected alternatives written down *before*
> acting is the antidote to re-litigating settled questions and to reverse-engineering rationale after
> the fact. An ADR whose `## Alternatives Considered` was filled in afterwards is lint-incomplete.

## Entry purpose + naming

- **Purpose:** one settled decision, with the alternatives weighed and why they lost.
- **Filename:** `decisions/NNNN-<kebab-slug>.md` (zero-padded, monotonic; IDs never reused).
- **Write-discipline:** APPEND-ONLY for new ADRs; an existing ADR changes `status:` in place, never
  moves. Supersession via frontmatter (`superseded-by:` + `status: superseded`), not deletion.

## Entry SCHEMA (front-matter + body)

- Front-matter: `provenance` × `status` (`proposed` → `accepted` / `rejected` / `superseded`) ×
  `tags` × `related`. An `accepted` ADR may **not** be `provenance: llm-draft`/`llm-autonomous` — a
  human signs off before accept.
- Body: Context · Decision · **Alternatives Considered** (non-empty, authored before the work) ·
  Consequences · (optional) the work-unit (`WU-NNNN`) or open question (`OQ-NNN`) it resolves.

## Decisions (route by status, then topic)

- ⭐ `0001-untagged-third-party-agents-get-an-insert-verb-not-a-loosened-guard.md` —
  **Open when:** you are changing how `<<route:>>` tags are written, wondering why `tag` and `use` are
  separate commands, or asking why an installed third-party agent routed somewhere unexpected.
  **Carry-away:** agents installed from outside ship untagged and fall through to the `anySubagent`
  catch-all silently, so a `tag` verb was added to insert a FIRST tag — `use`'s throw is a deliberate
  false-success guard and was left intact; the two verbs refuse each other's input. Rejected: loosening
  `use` to insert, and a `--create` flag on `use` (both fail the can-it-report-an-unintended-success
  axis). *(status: accepted.)*
- ⭐ `0002-codex-is-a-user-run-shim-not-a-built-in-upstream.md` —
  **Open when:** adding a subscription-backed upstream, or asking why GPT/Codex has no built-in when
  Z.ai and Kimi do. **Carry-away:** every built-in upstream speaks Anthropic Messages, but Codex
  subscription auth targets an undocumented ChatGPT backend on OpenAI's Responses schema, so it needs a
  translator rather than a base URL — and a built-in would assert a stability and a terms position we
  can't stand behind. Supported instead as a documented `[upstreams]` entry pointing at a user-run shim.
  Rejected: building the translator in-tree, and shipping a built-in aimed at a community shim.
  *(status: accepted.)*

## Maintenance

APPEND-ONLY for new ADRs; existing ADRs change `status:` in place, never move (supersession via
`superseded-by:`). Adding/retiring an ADR updates this index in the SAME change. `status: accepted`
⇒ may not be `llm-draft`/`llm-autonomous`.
