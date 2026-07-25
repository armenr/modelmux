---
provenance: llm-reviewed
template-version: 1.0.0
created: 2026-07-25
last-modified: 2026-07-25
related: []
tags: [runtime, routing, environment, gotcha]
---

# modelmux the product is developed here but NOT running here — this repo's own agents are plain Claude

**Observed:** 2026-07-25, stated by the operator: *"We don't run modelmux here my guy."* Before that, an
entire multi-agent thread had been reasoning as though the proxy were live on this machine — including
this repo's own agent describing itself as offering "a non-Claude second opinion", and a peer repo
recording (and later retracting) that this tree "may be the first non-Claude brain" and that "wake
economics differ for a proxied session, every mention may land on a metered API".

Every one of those inferences was false. The proxy is a **product built in this repo**, not a running
component of this development environment. Sessions here are ordinary Claude Code sessions on
subscription auth.

**Root cause:** the repo is *about* heterogeneous routing, its README and `routes.toml` describe routing
behaviour in the present tense, and `.claude/agents/` contains four agents with live `<<route:>>` tags.
Everything reads like a running deployment. Nothing in the tree says "this is the artifact, not the
installation" — so the obvious inference from the artifacts is wrong.

**Workaround / fix:** treat routing behaviour in this repo as **specification, not observation**. To
learn what the proxy actually does, run it deliberately (see the field-test recipe in the handoff) and
read `decisions.jsonl`. Do not infer live routing from `routes.toml`.

**Avoid:**
- Do **not** claim, to peers or in docs, that subagents dispatched from this repo run on a non-Claude
  model. They do not, unless someone has explicitly started the proxy and pointed Claude Code at it.
- Do **not** reason about token cost, metering, or model identity for this repo's own sessions on the
  basis of the cascade in `routes.toml`.
- Do **not** treat the `<<route:>>` tags on `.claude/agents/*.md` as evidence of anything at runtime —
  they are inert unless the proxy is in the request path.
- When announcing this project's capability to anyone, **state deployment status**, not just what the
  tool does. Four independent readers manufactured operational consequences from a capability
  description that never said whether it was running; four of five of those inferences die immediately
  against an explicit "not deployed".

**See also:** the field-test recipe in `now/handoff.md` §Immediate next is the only sanctioned way to
observe real routing behaviour from this tree.
