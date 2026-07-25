---
provenance: kit-template
created: 2026-07-03
paths: [".env", ".env.*", "**/*.env", "**/config/**", "**/secrets/**", "docker/**", "docker-compose*.yml"]
---

# Sensitive-data / secrets rules

Short on purpose. If this system ever stores or processes regulated or user data, treat all stored content
as potentially sensitive. This is non-negotiable.

- **Never commit secrets, credentials, or regulated / user data to git.** That includes `.agent-docs/`,
  code, configs, test fixtures, and committed example data. Local env / config is gitignored; only
  placeholder templates are committed. Reference secret-store keys / paths, never literal values — in code,
  docs, logs, or `.agent-docs/`.
- **No real user content in test fixtures or examples.** Use synthetic or clearly-fabricated data. A
  realistic-looking record in a committed fixture is a leak.
- **Derived artifacts can leak their source.** Embeddings, caches, indexes, and traces are derived from
  content and can reconstruct it — treat them as sensitive too; never paste their contents into a tracked
  doc, a log line, or a checkpoint. Reference the path; don't paste the data.
- **Logging redacts content.** Don't log record bodies, embeddings, or secret values at any level; spans
  and logs carry IDs / metadata, not payload. Verbose logs are a dev convenience only.
- **Sending content to an external vendor is a data-handling decision.** Routing user content to any
  external API (embedding, inference, analytics) takes it off-box — record that as an ADR, and regulated
  data must not reach a vendor without the appropriate agreement. Prefer a local/in-process path for
  sensitive deployments.
- **Sweep the conversation at handoff.** Anything sensitive that transited the session — a pasted key, a
  real record, a credential in a command — must not land in `now/*`, `log.md`, a checkpoint, or a commit.
  Scrub it out of the durable artifacts before you `/handoff`.

## Related

- `standing-rules-core.md` (§commits, external deps & data safety) · `CONVENTIONS.md` (the schema contract)
