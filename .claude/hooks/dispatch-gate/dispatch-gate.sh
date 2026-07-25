#!/usr/bin/env bash
# dispatch-gate.sh — PreToolUse entry shim for the dispatch-conformance gate (portability guard).
# provenance: kit-template · created: 2026-07-13 · last-modified: 2026-07-13
#
# This is the hook COMMAND wired into settings.json. It carries no parsing logic — it only guards
# portability, then execs the Python check engine (dispatch-gate.py), passing the stdin payload through.
#
# Usage (the two entry surfaces are DISTINCT command strings so the concierge merge dedup — which keys on
# the exact command string, matcher-blind — never collapses the two matcher blocks into one):
#   .../dispatch-gate.sh agent       # wired behind matcher "Agent"
#   .../dispatch-gate.sh workflow    # wired behind matcher "Workflow"
#
# python3 absent → emit a LOUD did-not-run surface and ALLOW (exit 0). A completeness gate that silently
# no-ops on a missing interpreter reproduces the wu-refs scar (a safety tool that returns "all clear"
# because it did not run). It does NOT hard-block — bricking every dispatch on a missing interpreter breaks
# the portability contract — but absence-of-finding is never mistaken for a pass.
set -euo pipefail

SURFACE="${1:-unknown}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"[dispatch-gate] dispatch-conformance gate DID NOT RUN — python3 absent. This dispatch is UNVERIFIED (allowed, not blocked; absence-of-finding is not a pass)."}}'
  exit 0
fi

exec python3 "$DIR/dispatch-gate.py" --surface "$SURFACE"
