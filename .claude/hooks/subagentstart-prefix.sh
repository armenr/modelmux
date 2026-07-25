#!/usr/bin/env bash
# subagentstart-prefix.sh — SubagentStart hook.
# provenance: kit-template · created: 2026-07-03
#
# Injects a multi-agent prompt-prefix so a dispatched subagent knows it is a subagent
# (parent sees only its final structured output; no narration to the user) and that the
# standing operational rules apply. For built-in Explore/Plan subagents — which do NOT
# inherit CLAUDE.md — it additionally cats the standing-rules CORE (the always-on ~1.5k
# tokens, NOT a full rules file) so those agents still carry the disciplines.
#
# Portability: jq-guarded (missing jq → no-op, never blocks a subagent spawn).
set -euo pipefail

# jq missing → degrade to no-op rather than failing every subagent spawn.
command -v jq >/dev/null 2>&1 || exit 0

# The SubagentType field name varies across hook-input shapes; try the known ones.
SUBAGENT_TYPE=$(jq -r '.subagent_type // .agent_type // .tool_input.subagent_type // "unknown"')

PREFIX='# System context — multi-agent
You are a subagent in the modelmux multi-agent system (standard multi-agent prompt-prefix pattern). The parent agent receives only your final structured output; do NOT narrate the handoff to the user. Reply with a concise structured summary when your task completes. Standing operational rules from `.claude/rules/standing-rules-core.md` apply.'

# Conditional standing-rules-CORE inject for built-ins that skip CLAUDE.md (Explore, Plan).
# Point at the CORE file, never a full-size rules dump.
CORE=".claude/rules/standing-rules-core.md"
if [[ $SUBAGENT_TYPE =~ ^(Explore|Plan)$ ]] && [[ -f $CORE ]]; then
  PREFIX="$PREFIX

# Standing rules — core (full text, because Explore/Plan skip CLAUDE.md inheritance)
$(cat "$CORE")"
fi

jq -nc --arg ctx "$PREFIX" '{additionalContext: $ctx}'
