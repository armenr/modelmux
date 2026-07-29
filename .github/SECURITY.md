# Security Policy

## Reporting a vulnerability

Please report security issues **privately**, not as public issues or PRs:

- Preferred: GitHub → **Security** tab → **Report a vulnerability** (private
  advisory).
- Or email: **armen@stelth.io**.

You'll get an acknowledgement as soon as possible, and we'll coordinate a fix
and disclosure timeline with you.

## Handling your API keys

modelmux is a **local reverse proxy**. It reads a key from the environment only
for an upstream that *declares* one (`auth = "bearer:SOME_KEY"`), and injects it
into that upstream's outbound requests. A few rules keep that safe:

- **A `passthrough` upstream never substitutes a key.** It forwards the caller's
  own credential or sends none at all. This matters for billing: an upstream that
  swapped a subscription token for a metered key would redirect spend silently,
  and a 200 answered to a credential-less request is the tell.

- **Never commit keys.** `.env`, `*.env`, and `openrouter-key.env` are
  gitignored. `.env.example` ships with placeholders only.
- **Keys live in the environment**, not in `routes.toml` or any tracked file.
- **The decision log (`decisions.jsonl`) never contains keys** — it logs
  routing metadata only. Still, redact before sharing it in an issue.
- **If a key leaks, rotate it immediately** at your provider
  (<https://openrouter.ai/keys>). Rotation is faster and safer than trying to
  scrub history.

## Scope

This is a developer tool that runs on your own machine and talks to upstreams
you configure. It is not a hardened multi-tenant service — do not expose the
proxy port to untrusted networks.
