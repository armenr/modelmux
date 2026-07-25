#!/usr/bin/env bash
# sessionstart-state-router.sh — SessionStart hook (state router).
# provenance: kit-template · created: 2026-07-03
#
# Reads handoff staleness and routes to one of three regimes so a cold session
# never acts on a stale plan:
#   fresh      (≤24h and git matches) → pointer to now/handoff.md (+ lessons MOC)
#   stale-warn (24h–7d OR git drift)  → run /orient FIRST to verify vs git
#   stale-block (>7d OR missing)      → run /handoff to regenerate before acting
#
# $1 is the SessionStart matcher (startup|resume|clear|compact). The index-drift
# lint runs ONLY on startup|clear — resume/compact fire frequently mid-work and the
# doc corpus rarely changes between them, so linting there is wasted noise.
#
# Portability: guards jq (degrade to no-op), GNU-then-BSD `stat` fallback, POSIX
# character classes only. Never hard-fails the session on a missing tool.
set -euo pipefail

# jq missing → degrade to a silent no-op rather than erroring on every session start.
command -v jq >/dev/null 2>&1 || exit 0

HANDOFF=".agent-docs/now/handoff.md"
MOC=".agent-docs/now/lessons/MOC.md"

if [[ ! -f $HANDOFF ]]; then
  jq -nc '{additionalContext: "No .agent-docs/now/handoff.md exists yet. Run /handoff to bootstrap session state, or /orient to survey existing state docs."}'
  exit 0
fi

NOW=$(date +%s)
# Stat: GNU (-c %Y) first, then BSD (-f %m). GNU-first because some environments
# preempt /usr/bin/stat with a GNU coreutils build on PATH. Falls back to $NOW
# (treat as fresh) if both fail, rather than crashing.
MT=$(stat -c %Y "$HANDOFF" 2>/dev/null || stat -f %m "$HANDOFF" 2>/dev/null || echo "$NOW")
AGE_DAYS=$(((NOW - MT) / 86400))

# Git-drift detection: compare the HEAD the handoff was captured at against current HEAD.
CURRENT_HEAD=$(git rev-parse --short HEAD 2>/dev/null || echo "")
HANDOFF_HEAD=$(grep -E '^(head|head-at-capture):' "$HANDOFF" 2>/dev/null | head -1 | awk '{print $2}' || echo "")
if [[ -z $HANDOFF_HEAD ]]; then
  HANDOFF_HEAD=$(awk '/Recent commits/,/^```$/' "$HANDOFF" | grep -oE '^[a-f0-9]{7,10}' | head -1 || echo "")
fi

GIT_DRIFTED="false"
[[ -n $HANDOFF_HEAD && -n $CURRENT_HEAD && $HANDOFF_HEAD != "$CURRENT_HEAD" ]] && GIT_DRIFTED="true"

# Optional pointer to the lessons MOC if present.
LESSONS_PTR=""
[[ -f $MOC ]] && LESSONS_PTR=" Read .agent-docs/now/lessons/MOC.md for the Tier-1 lessons-learned ledger surface."

# Index-drift pointer: run the index-completeness lint in warn mode, summarize drifting
# dirs. Startup|clear only. Skipped silently if the lint isn't installed (degrade to no-op).
INDEX_PTR=""
LINT=".claude/hooks/lint-agent-docs-indexes.sh"
if [[ "${1:-startup}" =~ ^(startup|clear)$ ]] && [[ -x $LINT ]]; then
  DRIFT_DIRS=$(bash "$LINT" 2>/dev/null | sed -E 's/^.*index drift: ([^ ]+).*/\1/' | tr '\n' ' ' | sed 's/ $//')
  [[ -n $DRIFT_DIRS ]] && INDEX_PTR=" [!] .agent-docs index drift in: ${DRIFT_DIRS} — fix at the next /flush or /handoff."
fi

if ((AGE_DAYS > 7)); then
  MSG="Handoff is >7d stale (age=${AGE_DAYS}d). MUST run /handoff to regenerate before acting on its 'Immediate next action'.${LESSONS_PTR}${INDEX_PTR}"
elif ((AGE_DAYS > 1)) || [[ $GIT_DRIFTED == "true" ]]; then
  MSG="Handoff may be stale (age=${AGE_DAYS}d, git-drifted=${GIT_DRIFTED}). Run /orient FIRST to verify against current git state before acting on 'Immediate next action'.${LESSONS_PTR}${INDEX_PTR}"
else
  MSG="Handoff is fresh (age=${AGE_DAYS}d). Read .agent-docs/now/handoff.md before proceeding.${LESSONS_PTR}${INDEX_PTR}"
fi

# Fresh-clone trap: every git pre-commit gate is INERT unless core.hooksPath points at
# the tracked hooks dir. On a fresh clone this is unset, so the gates the rules promise
# silently do nothing. Surface it loudly rather than assume.
[[ "$(git config --get core.hooksPath 2>/dev/null)" == ".githooks" ]] || MSG="${MSG} [!] core.hooksPath != .githooks — git pre-commit gates are INERT on this clone; run: git config core.hooksPath .githooks"

jq -nc --arg msg "$MSG" '{additionalContext: $msg}'
