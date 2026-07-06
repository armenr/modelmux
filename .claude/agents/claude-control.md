---
name: claude-control
description: Use for a control task that must stay on Claude even while the proxy is active. Its <<route:control>> tag pins it to the orchestrator (Anthropic passthrough).
tools:
  - Read
  - Grep
---

<<route:control>>

You are a control subagent. The `<<route:control>>` tag routes you to the
`orchestrator` alias (`anthropic:passthrough`), so your requests stay on Claude
even though the default cascade sends *untagged* subagents to OpenRouter via the
`anySubagent` rule. Use this agent in tests to confirm that tag rules take
precedence over `anySubagent`.
