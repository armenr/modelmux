---
name: claude-control
description: Use for a control task that must stay on Claude. Confirms that untagged subagents are NOT routed to OpenRouter.
tools:
  - Read
  - Grep
---

You are a control subagent with NO route tag. Your requests should remain on
Claude (the proxy sends untagged subagents per the cascade; with no matching tag
rule, a plain subagent only diverts if an anySubagent rule exists). Use this agent
in tests to confirm selectivity behaves as configured.
