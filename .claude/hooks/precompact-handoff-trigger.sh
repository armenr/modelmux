#!/usr/bin/env bash
# precompact-handoff-trigger.sh — PreCompact hook.
# provenance: kit-template · created: 2026-07-03
#
# Injects a systemMessage prompting an agentic /handoff before context is compacted,
# so investigation dead-ends and in-flight state get written to disk (not summarized away).
# Deliberately does NOT use `decision: block` — that is a foot-gun that can wedge compaction.
#
# Portability: jq-guarded (missing jq → silent no-op; never brick the session).
command -v jq >/dev/null 2>&1 || exit 0
jq -nc '{systemMessage: "Compaction is about to occur. Run /handoff to capture session state to .agent-docs/now/handoff.md before context is summarized. Reply NO_REPLY when done."}'
