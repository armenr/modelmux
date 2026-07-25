#!/usr/bin/env bash
# install-hooks.sh — wire Fieldbook's tracked git hooks into THIS repo.
#
# The concierge runs this once during install; a collaborator re-runs it once
# per fresh clone. It is the step that turns the tracked (but inert) hooks under
# .githooks/ into ACTIVE commit gates.
#
#   Default (recommended):  git config core.hooksPath .githooks
#     Points git at the tracked hooks dir. This is per-clone LOCAL config (NOT
#     committed), so every collaborator runs this once. A fresh clone runs NO
#     hooks until then — that is git's design.
#
#   Alternative (--copy):   copy .githooks/* into .git/hooks/
#     For setups that already use core.hooksPath for something else, or tooling
#     that reads only .git/hooks/.
#
# Idempotent (safe to re-run). Reversible (prints the exact undo command).
# Portable: no jq, no GNU-only flags; degrades cleanly on unusual layouts.
#
# Usage:
#   bash .claude/hooks/install-hooks.sh            # core.hooksPath mode (default)
#   bash .claude/hooks/install-hooks.sh --copy     # copy into .git/hooks/ instead
#   bash .claude/hooks/install-hooks.sh --help

set -u

HOOKS_DIR=".githooks"
MODE="hookspath"   # hookspath | copy

usage() {
  cat <<'EOF'
install-hooks.sh — activate Fieldbook's tracked git hooks in this repo.

  (no args)     set core.hooksPath=.githooks   (recommended; per-clone local)
  --copy        copy .githooks/* into .git/hooks/ instead
  --hookspath   force core.hooksPath mode (the default)
  --help        show this help

Both modes are idempotent and reversible; the undo command is printed on exit.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --copy)      MODE="copy" ;;
    --hookspath) MODE="hookspath" ;;
    -h|--help)   usage; exit 0 ;;
    *) echo "install-hooks: unknown argument '$arg' (try --help)" >&2; exit 2 ;;
  esac
done

# ── must be inside a git work tree ─────────────────────────────────────────
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "install-hooks: not inside a git repository — run this from your repo root." >&2
  exit 1
fi
repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root" || { echo "install-hooks: could not cd to repo root '$repo_root'." >&2; exit 1; }

# ── the tracked hooks must be present ──────────────────────────────────────
if [ ! -d "$HOOKS_DIR" ]; then
  {
    echo "install-hooks: $HOOKS_DIR/ not found under $repo_root."
    echo "  (expected the kit's tracked hooks at ./$HOOKS_DIR/ — install the kit files first.)"
  } >&2
  exit 1
fi

# ── make every tracked hook executable (portable chmod) ────────────────────
found_hook=0
for h in "$HOOKS_DIR"/*; do
  [ -f "$h" ] || continue
  chmod +x "$h" 2>/dev/null || true
  found_hook=1
done
if [ "$found_hook" -eq 0 ]; then
  echo "install-hooks: note — no hook files found in $HOOKS_DIR/ yet (activating anyway)."
fi

git_dir="$(git rev-parse --git-dir)"      # .git (or an absolute path for worktrees)
stale="$git_dir/hooks/pre-commit"

# ── activate ───────────────────────────────────────────────────────────────
if [ "$MODE" = "hookspath" ]; then
  git config core.hooksPath "$HOOKS_DIR"
  echo "install-hooks: OK core.hooksPath = $HOOKS_DIR  (this repo, local config)"

  # A stale .git/hooks/pre-commit is now INERT (core.hooksPath shadows it), but
  # rename it so a future `git config --unset core.hooksPath` can't silently
  # reactivate an old, divergent gate.
  if [ -f "$stale" ]; then
    backup="$stale.stale-disabled-$(date +%Y%m%d%H%M%S)"
    mv "$stale" "$backup"
    echo "install-hooks: renamed stale $stale"
    echo "               -> $backup  (was shadowed; moved so it can't resurface)"
  fi

  echo
  echo "  To undo:  git config --unset core.hooksPath"
else
  dest="$git_dir/hooks"
  mkdir -p "$dest"

  # back up an existing pre-commit that isn't ours, then copy every hook in.
  if [ -f "$dest/pre-commit" ]; then
    backup="$dest/pre-commit.pre-fieldbook-$(date +%Y%m%d%H%M%S)"
    cp "$dest/pre-commit" "$backup"
    echo "install-hooks: backed up existing $dest/pre-commit"
    echo "               -> $backup"
  fi
  for h in "$HOOKS_DIR"/*; do
    [ -f "$h" ] || continue
    cp "$h" "$dest/" && chmod +x "$dest/$(basename "$h")" 2>/dev/null || true
  done
  echo "install-hooks: OK copied $HOOKS_DIR/* -> $dest/  (this repo)"
  echo
  echo "  To undo:  rm -f $dest/pre-commit    # then restore any *.pre-fieldbook-* backup"
fi

# ── post-install self-check ────────────────────────────────────────────────
echo
echo "install-hooks: verifying..."
if [ "$MODE" = "hookspath" ]; then
  cur="$(git config --get core.hooksPath || true)"
  if [ "$cur" = "$HOOKS_DIR" ]; then
    echo "install-hooks: OK verified core.hooksPath=$cur"
  else
    echo "install-hooks: x core.hooksPath is '$cur' (expected '$HOOKS_DIR')" >&2
    exit 1
  fi
else
  if [ -x "$git_dir/hooks/pre-commit" ]; then
    echo "install-hooks: OK verified $git_dir/hooks/pre-commit is executable"
  else
    echo "install-hooks: x $git_dir/hooks/pre-commit missing or not executable" >&2
    exit 1
  fi
fi
echo "install-hooks: done — hooks are active for commits in this repo."
