#!/usr/bin/env bash
# pretooluse-safety-gates.base.sh — UNIVERSAL PreToolUse Bash safety gate (base layer).
# provenance: kit-template · created: 2026-07-03 · last-modified: 2026-07-09
#
# Reads stdin JSON per the Claude Code hook spec:
#   { "tool_name": "Bash", "tool_input": { "command": "..." } }
# Emits a permissionDecision (ask|deny) on match, or a cwd-safety additionalContext
# on mutative git/fs ops. No match → allow (silent, no output).
#
# This is the STACK-AGNOSTIC base — universal foot-guns only. At install the concierge
# concatenates a per-stack gate fragment (e.g. package-publish, dependency re-lock,
# datastore-wipe) at the marked insertion point to produce the live
# `pretooluse-safety-gates.sh`. The base is also correct STANDALONE.
#
#   `ask`  = reversible-but-consequential  (rm -r, git reset --hard, push to protected)
#   `deny` = unambiguous foot-gun          (force-push to protected, checks-bypass flags)
#
# ── Regex discipline (the reusable crown jewel — DO NOT weaken) ───────────────────────
# 1. Anchor EVERY rule to COMMAND POSITION via CSEP: start-of-line (leading-whitespace
#    tolerant), OR after a shell separator ; && || |, OR inside $( ), optionally after
#    inline VAR=val env assignments. grep segments input on newlines, so per-line command-
#    position anchoring rules out HEREDOC bodies and commit-message text.
# 2. PORTABILITY: POSIX character classes ONLY. Use [[:space:]] not \s, [^[:space:]] not
#    \S, and an explicit ([^[:alnum:]_]|$) tail for a trailing word-boundary. \b \s \w are
#    GNU-grep extensions that silently FAIL on BSD/macOS grep; POSIX word boundaries
#    ([[:<:]] [[:>:]]) are BSD-only. Neither is portable, so boundaries are spelled out.
# 3. Chain greps when two tokens must co-occur in any order.
#
# ── CWD assumption (rule 5) ────────────────────────────────────────────────────────────
# Rule 5 reports this hook process's own pwd as the Bash tool's persisted shell cwd. That
# holds when the harness spawns hooks in the tool shell's working directory; if a harness
# version runs hooks from the project root instead, the injected cwd can be confidently
# wrong. Cheap self-check: when CLAUDE_PROJECT_DIR is set and pwd falls outside it, the
# label softens to "cwd (unverified)" — treat an unverified cwd as advisory, not ground
# truth. Also: the cd-target resolution below NEVER executes command substitution sliced
# from the agent's command — only tilde and simple-variable forms are expanded; anything
# containing backticks or $( ) is left unresolved and reported as a raw string.
set -euo pipefail

# jq is required to parse the hook payload. If absent, degrade to allow-through rather
# than failing on EVERY Bash call (never brick the session on a missing tool).
command -v jq >/dev/null 2>&1 || exit 0

CMD=$(jq -r '.tool_input.command // ""')

# Extra rm-safe paths a stack fragment may contribute (default: none). Portable default.
SAFE_PATHS_EXTRA="${SAFE_PATHS_EXTRA:-}"

# OUTPUT SCHEMA: the legacy top-level `decision` field supports only approve/block; `ask`
# is silently dropped there. Use hookSpecificOutput.permissionDecision.
ask() {
  jq -nc --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "ask",  permissionDecisionReason: $r}}'
  exit 0
}
block() {
  jq -nc --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

# Command-position anchor (+ optional inline env-var assignments). POSIX-portable.
CSEP='(^[[:space:]]*|[;&|][[:space:]]*|\$\([[:space:]]*)([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+ +)*'

# ─── STACK-FRAGMENT INSERTION POINT ───────────────────────────────────────────────────
# The concierge splices the per-stack gate fragment HERE (BEFORE the universal rules) so
# it can add stack rules and/or extend SAFE_PATHS_EXTRA. Leave untouched when the base
# runs standalone.
# ──────────────────────────────────────────────────────────────────────────────────────

# ─── Node / TypeScript stack gate fragment ────────────────────────────────────────────
# Spliced into pretooluse-safety-gates.base.sh at the marked STACK-FRAGMENT INSERTION POINT
# (BEFORE the universal rules). NOT a standalone script — it inherits CMD, CSEP, ask(),
# block(), and SAFE_PATHS_EXTRA from the base. Same discipline as the base: every rule is
# anchored to command position via ${CSEP}, and uses POSIX character classes only
# ([[:space:]], [^[:alnum:]_]) so it behaves identically under GNU and BSD grep. Two greps
# are chained with && when two tokens must co-occur in any order on the same line.
#
# Gated surface: the package-manager operations that reach OUTSIDE the project or drift the
# committed dependency graph — publish (registry, public), global install (shared toolchain),
# a node_modules wipe, a forced lockfile re-resolve. Plain local install / run / build / test
# are safe and stay ungated. Covers npm / pnpm / yarn / bun.

# Extend the recursive-rm safe-path set with regenerable framework build/cache output, so
# `rm -rf .next` / `.turbo` etc. do not prompt. node_modules is deliberately NOT here — its
# wipe stays gated (N3). Preserves any value an earlier fragment set.
SAFE_PATHS_EXTRA="${SAFE_PATHS_EXTRA:+${SAFE_PATHS_EXTRA}|}\.next|\.nuxt|\.svelte-kit|\.turbo|\.parcel-cache|\.astro|\.vite"

# N1. Publish to a package registry (ask) — a released version is public and hard to fully
#     retract (unpublish is time-boxed / blocked for established packages). Manager at command
#     position co-occurring with a standalone `publish` token.
echo "$CMD" | grep -qE "${CSEP}(npm|pnpm|yarn|bun)([^[:alnum:]_]|$)" &&
  echo "$CMD" | grep -qE "(^|[[:space:]])publish([[:space:]]|$)" &&
  ask "Safety gate (node-ts): publishing to ${PACKAGE_REGISTRY:-the package registry} is public and hard to fully retract. Confirm the package, version, and registry — and that a real release is intended — before publishing."

# N2. Global / system-wide install (ask) — a manager install verb (install|i|add) co-occurring
#     with a global marker (-g / --global / --location=global / yarn's `global` subcommand).
#     A plain local install (no global marker) is NOT gated.
echo "$CMD" | grep -qE "${CSEP}(npm|pnpm|yarn|bun)([^[:alnum:]_]|$)" &&
  echo "$CMD" | grep -qE "(^|[[:space:]])(install|i|add)([[:space:]]|$)" &&
  echo "$CMD" | grep -qE "(^|[[:space:]])(-g|--global|--location=global)([[:space:]]|=|$)|(^|[[:space:]])global([[:space:]]|$)" &&
  ask "Safety gate (node-ts): a global install mutates a shared toolchain outside the project. Prefer a project-local devDependency; confirm with the operator if a global install is really intended."

# N3. Recursive rm of node_modules (ask) — fires before the base generic-rm rule to give a
#     tailored message. Any recursive rm touching a node_modules dir forces a full reinstall
#     and can break a running dev server.
echo "$CMD" | grep -qE "${CSEP}rm +(-[A-Za-z]*[rR][A-Za-z]*|--recursive)([^[:alnum:]_]|$)" &&
  echo "$CMD" | grep -qE "(^|[^[:alnum:]_])node_modules([^[:alnum:]_]|$)" &&
  ask "Safety gate (node-ts): recursive rm of node_modules forces a full reinstall and can break a running dev server. Confirm with the operator (usually a clean 'npm ci' / 'pnpm install --frozen-lockfile' is what you want)."

# N4a. Forced dependency re-resolve (ask) — an install/update with --force / -f can re-resolve
#      and overwrite the committed lockfile, drifting the whole dependency graph.
echo "$CMD" | grep -qE "${CSEP}(npm|pnpm|yarn|bun)([^[:alnum:]_]|$)" &&
  echo "$CMD" | grep -qE "(^|[[:space:]])(install|i|add|update|up|upgrade)([[:space:]]|$)" &&
  echo "$CMD" | grep -qE "(^|[[:space:]])(--force|-f)([[:space:]]|$)" &&
  ask "Safety gate (node-ts): a forced install/update can re-resolve and overwrite the lockfile. Confirm — an unintended lockfile rewrite drifts every dependency version away from the committed lock."

# N4b. Deleting a lockfile (ask) — discards the exact resolved graph; the next install
#      re-resolves to possibly-different versions. A non-recursive rm the base rule won't catch.
echo "$CMD" | grep -qE "${CSEP}rm +" &&
  echo "$CMD" | grep -qE "(^|[^[:alnum:]_])(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb|bun\.lock)([^[:alnum:]_]|$)" &&
  ask "Safety gate (node-ts): deleting a lockfile discards the exact resolved dependency graph (the next install re-resolves to possibly-different versions). Confirm with the operator."
# ──────────────────────────────────────────────────────────────────────────────────────
# 1. Git push to a protected branch (block on --force same-line; else ask).
#    Word boundaries spelled out: (^|[^[:alnum:]_])X([^[:alnum:]_]|$).
PROTECTED='(main|master|main)'
PUSH_LINES=$(echo "$CMD" | grep -E "${CSEP}git +push([^[:alnum:]_]|$)" | grep -E "(^|[^[:alnum:]_])${PROTECTED}([^[:alnum:]_]|$)" || true)
if [[ -n $PUSH_LINES ]]; then
  if echo "$PUSH_LINES" | grep -qE -- '--force([^[:alnum:]_]|$)|(^|[[:space:]])-f([^[:alnum:]_]|$)'; then
    block "Safety gate: git push --force to a protected branch ${PROTECTED} is BLOCKED — force-push overwrites shared history. Use a feature branch + PR."
  fi
  ask "Safety gate: git push to a protected branch ${PROTECTED}. Confirm with the operator before pushing to shared history."
fi

# 2. Checks-bypass attempts (block). The bypass flag must co-occur with a real git write
#    verb on the SAME line, so a --no-verify mentioned inside a commit-message body (a
#    different line) is exempt.
if echo "$CMD" | grep -qE "${CSEP}git +(.*[^[:alnum:]_])?(commit|push|rebase|merge|cherry-pick|am|tag)(.*[[:space:]])(--no-verify|--no-gpg-sign)([^[:alnum:]_]|$)" ||
  echo "$CMD" | grep -qE "${CSEP}git +.*commit\.gpgsign=false"; then
  block "Safety gate: checks-bypass (--no-verify / --no-gpg-sign / commit.gpgsign=false) is BLOCKED. Investigate the failing pre-commit gate; do not route around it."
fi

# 3. git reset --hard (ask) — destroys uncommitted working-tree changes.
echo "$CMD" | grep -qE "${CSEP}git +reset +--hard([^[:alnum:]_]|$)" &&
  ask "Safety gate: 'git reset --hard' destroys uncommitted changes. Confirm cwd + target with the operator."

# 3b. Working-tree-revert cousins of reset --hard (ask) — each destroys uncommitted work
#     with zero recovery path (field incident: a verifier's `git checkout -- <file>` on an
#     UNCOMMITTED change-under-review reverted to HEAD and discarded the fix). checkout is
#     exempt ONLY for -b/-B (new-branch creation, always safe). The clean flag-cluster
#     regex matches f/F ANYWHERE in the cluster — `git clean -fd` must not slip because f
#     is not the last character (a first-ship bug in the field seed, caught only by testing
#     the gate: test your safety tools).
if echo "$CMD" | grep -qE "${CSEP}git +checkout([^[:alnum:]_]|$)" &&
  ! echo "$CMD" | grep -qE "${CSEP}git +checkout +-[bB]([^[:alnum:]_]|$)"; then
  ask "Safety gate: 'git checkout' (other than -b/-B) can irrecoverably revert uncommitted changes. Confirm the target with the operator — and to un-apply a change-under-review, reverse the edit IN PLACE and verify the blob hash; never discard the working tree."
fi
echo "$CMD" | grep -qE "${CSEP}git +restore([^[:alnum:]_]|$)" &&
  ask "Safety gate: 'git restore' reverts uncommitted changes irrecoverably. Confirm the target with the operator."
# Force may arrive as an adjacent cluster (-fd), a SEPARATED cluster (-d -f), or the long form
# (--force), anywhere within the clean invocation — but never across a command separator (;&|),
# so a force flag on a LATER command cannot false-fire this rule. The dash must follow
# whitespace (a real flag token), so a filename containing "-f" stays silent.
echo "$CMD" | grep -qE "${CSEP}git +clean( +[^;&|]*)? +(-[A-Za-z]*[fF][A-Za-z]*|--force)([^[:alnum:]_]|$)" &&
  ask "Safety gate: 'git clean' with a force flag (any position, -f/-fd/-d -f/--force) deletes untracked files irrecoverably. Confirm the target with the operator."
echo "$CMD" | grep -qE "${CSEP}git +stash +(drop|clear)([^[:alnum:]_]|$)" &&
  ask "Safety gate: 'git stash drop/clear' discards stashed work irrecoverably. Confirm with the operator."

# 4. Recursive rm outside safe paths (ask). Matches any short-flag cluster containing r/R
#    (-rf, -fr, -Rf, -rfv, -r) or --recursive. Safe = universal temp/cache/build dirs, plus
#    any stack-specific dirs the fragment added via SAFE_PATHS_EXTRA.
SAFE_PATHS="/tmp/|/private/tmp/|\\.cache|/dist/|/build/|/gen/|coverage${SAFE_PATHS_EXTRA:+|${SAFE_PATHS_EXTRA}}"
if echo "$CMD" | grep -qE "${CSEP}rm +(-[A-Za-z]*[rR][A-Za-z]*|--recursive)([^[:alnum:]_]|$)" &&
  ! echo "$CMD" | grep -qE "$SAFE_PATHS"; then
  ask "Safety gate: recursive rm outside safe paths (${SAFE_PATHS}). Confirm the target with the operator."
fi

# 5. CWD-awareness injection on mutative git / filesystem ops (context-inject, no block).
#    The harness preserves cwd between Bash calls; a prior `cd <subdir>` for a read-only op
#    can silently set the wrong context for a later mutative op (esp. in a multi-package
#    workspace: single-package). Emits cwd+branch+repo-root+tree-shape via
#    additionalContext BEFORE allowing. Ask-gated commands above have already exited.
MUTATIVE_PATTERN='git +(add|checkout|clean|commit|rm|mv|reset|merge|rebase|cherry-pick|stash|worktree|revert|restore|push)([^[:alnum:]_]|$)|rm +|mv +'
if echo "$CMD" | grep -qE "${CSEP}(${MUTATIVE_PATTERN})"; then
  set +e
  PWD_NOW=$(pwd 2>/dev/null || echo "<pwd-failed>")
  # Self-check the cwd assumption (see header): if CLAUDE_PROJECT_DIR is set and pwd is
  # outside it, the harness may have run this hook from an unexpected directory — soften.
  CWD_PREFIX="cwd"
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    case "$PWD_NOW/" in
      "${CLAUDE_PROJECT_DIR%/}/"*) ;;
      *) CWD_PREFIX="cwd (unverified)" ;;
    esac
  fi
  INTENDED_CWD=""
  CWD_NOTE=""
  if echo "$CMD" | grep -qE '^[[:space:]]*cd[[:space:]]+'; then
    RAW_TARGET=$(echo "$CMD" | sed -nE 's|^[[:space:]]*cd[[:space:]]+([^&|;]+).*|\1|p' | sed 's/[[:space:]]*$//' | head -1)
    # Strip one pair of matching surrounding quotes (a quoted cd target is common).
    case "$RAW_TARGET" in
      \"*\") RAW_TARGET="${RAW_TARGET#\"}"; RAW_TARGET="${RAW_TARGET%\"}" ;;
      \'*\') RAW_TARGET="${RAW_TARGET#\'}"; RAW_TARGET="${RAW_TARGET%\'}" ;;
    esac
    # SAFE expansion only — no eval, nothing sliced from the agent's command may ever
    # execute here. Handled: tilde, $VAR / ${VAR} (optional /suffix). Command substitution
    # (backticks / dollar-paren) is never resolved: report the raw string instead.
    case "$RAW_TARGET" in
      '') ;;
      *\`*|*\$\(*)
        CWD_NOTE=" | cd target contains command substitution — NOT resolved; raw: ${RAW_TARGET}"
        ;;
      '~'|'~/'*)
        INTENDED_CWD="${HOME}${RAW_TARGET#\~}"
        ;;
      *\$*)
        VAR_NAME=$(printf '%s' "$RAW_TARGET" | sed -nE 's|^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?(/.*)?$|\1|p')
        VAR_TAIL=$(printf '%s' "$RAW_TARGET" | sed -nE 's|^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?(/.*)?$|\2|p')
        if [ -n "$VAR_NAME" ] && [ -n "${!VAR_NAME:-}" ]; then
          INTENDED_CWD="${!VAR_NAME}${VAR_TAIL}"
        else
          CWD_NOTE=" | cd target uses a variable this hook cannot resolve; raw: ${RAW_TARGET}"
        fi
        ;;
      *)
        INTENDED_CWD="$RAW_TARGET"
        ;;
    esac
    if [ -n "$INTENDED_CWD" ] && [ "${INTENDED_CWD#/}" = "$INTENDED_CWD" ]; then
      INTENDED_CWD="$PWD_NOW/$INTENDED_CWD"
    fi
  fi
  if [ -n "$INTENDED_CWD" ] && [ -d "$INTENDED_CWD" ]; then
    EFFECTIVE_CWD="$INTENDED_CWD"
    CWD_LABEL="${CWD_PREFIX}=${INTENDED_CWD} (via cd-chain from shell-cwd=${PWD_NOW})"
  else
    EFFECTIVE_CWD="$PWD_NOW"
    CWD_LABEL="${CWD_PREFIX}=${PWD_NOW}"
  fi
  CWD_LABEL="${CWD_LABEL}${CWD_NOTE}"
  BRANCH=$(git -C "$EFFECTIVE_CWD" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "<not-a-git-repo>")
  REPO_ROOT=$(git -C "$EFFECTIVE_CWD" rev-parse --show-toplevel 2>/dev/null || echo "<not-a-git-repo>")
  STATUS_COUNT=$(git -C "$EFFECTIVE_CWD" status -s 2>/dev/null | wc -l | tr -d ' ' || echo "?")
  STATUS_TOP=$(git -C "$EFFECTIVE_CWD" status -s 2>/dev/null | head -3 | tr '\n' ';' | sed 's/;$//' || true)
  CONTEXT_MSG="[cwd-safety] ${CWD_LABEL} | branch=${BRANCH} | repo-root=${REPO_ROOT} | changes=${STATUS_COUNT} | top: ${STATUS_TOP}"
  jq -nc --arg ctx "$CONTEXT_MSG" '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $ctx}}'
  set -e
  exit 0
fi

# No match → allow (no output = no-action per hook spec).
exit 0
