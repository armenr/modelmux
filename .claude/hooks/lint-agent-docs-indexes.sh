#!/usr/bin/env bash
# lint-agent-docs-indexes.sh — index-completeness lint (CONVENTIONS "index completeness" rule).
#
# The FAST, index-only check used by the SessionStart router (warn mode) and the pre-commit
# gate (--strict). The full doc-schema linter (lint-docs.py) folds this same check in as one of
# its rules; this script is the cheap standalone surface so a session start does not pay for the
# whole schema pass.
#
# Check: for each managed dir (populated content dirs under .agent-docs/), compare the on-disk
# *.md basename set (excluding index.md) against `file.md` backtick tokens in that dir's index.md:
#   - missing index.md (populated managed dir without one)
#   - unindexed files (on disk, not referenced)
#   - phantom entries (referenced bare token, no such file in dir)
#
# Token contract (per the CONVENTIONS index template): in-dir files are referenced as `file.md`
# (bare backtick token) or as an in-dir markdown link `[label](file.md)` (ledger-table idiom);
# cross-dir references use relative paths (`../dir/file.md`) and are ignored here (targets
# containing '/' are skipped). Presence-only by design.
#
# Entry-detection anchoring (two guards against over-counting a filename that is merely NAMED, not indexed):
#   1. HTML comment blocks are stripped in a pre-pass — an index seed ships an `<!-- EXAMPLE ... -->` block
#      whose illustrative `<name>.md` rows name files that do not exist yet; counting them fabricated a
#      PHANTOM that blocked --strict on a fresh install. A commented-out row is not a live entry.
#   2. A token counts ONLY on an ENTRY ROW — a list-marker row (`- `file.md` …`, optionally after an emoji
#      marker) or a ledger-table row (`| `file.md` | …`). A bare backtick token in a prose paragraph or an
#      entry's indented continuation line (`  **Open when:** … `foo.md``) is NOT an entry. Without this a
#      filename mentioned in prose was miscounted as an index entry (a spurious phantom / unindexed split).
#
# Modes: default = warn (always exit 0; one line per drifting dir, silent when clean).
#        --strict = exit 1 if any drift (CI / gate use).
# Deps: bash 3.2+, find, sort, comm, grep, sed, awk. No jq, no GNU-isms (awk is POSIX; used for the
#       multi-line comment-span strip, which pure sed cannot do without deleting inline-commented entries).
set -u

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOCS="$REPO_ROOT/.agent-docs"
STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

# No .agent-docs/ yet (e.g. a fresh clone before install) → nothing to lint.
[ -d "$DOCS" ] || exit 0

# Managed dirs: structurally derived — top-level dirs with >=1 non-index .md,
# except now/ + templates/ (fleeting/scaffold, permanently out of scope);
# plus populated nested content dirs one level down.
managed_dirs() {
  for d in "$DOCS"/*/; do
    [ -d "$d" ] || continue
    base="$(basename "$d")"
    case "$base" in now | templates) continue ;; esac
    n=$(find "$d" -maxdepth 1 -name '*.md' ! -name 'index.md' | wc -l | tr -d ' ')
    [ "$n" -gt 0 ] && echo "$d"
    for sub in "$d"*/; do
      [ -d "$sub" ] || continue
      sn=$(find "$sub" -maxdepth 1 -name '*.md' ! -name 'index.md' | wc -l | tr -d ' ')
      [ "$sn" -gt 0 ] && echo "$sub"
    done
  done
}

# strip_html_comments FILE — blank out `<!-- ... -->` spans (possibly multi-line) while PRESERVING line
# structure, so a commented-out EXAMPLE row never counts AND an inline comment on a real entry line does not
# take the whole entry with it (a plain `sed '/<!--/,/-->/d'` range-delete would). POSIX awk; state carries
# across lines so a comment that opens on one line and closes on another is fully spanned.
strip_html_comments() {
  awk '
    { line = $0; out = ""
      while (1) {
        if (incomment) {
          p = index(line, "-->")
          if (p == 0) { line = ""; break }        # still inside the comment — blank the rest of the line
          line = substr(line, p + 3); incomment = 0
        }
        p = index(line, "<!--")
        if (p == 0) { out = out line; break }      # no opener left — keep the remaining text verbatim
        out = out substr(line, 1, p - 1)           # keep text before the opener
        line = substr(line, p + 4); incomment = 1
      }
      print out
    }' "$1"
}

DRIFT=0
for dir in $(managed_dirs); do
  rel="${dir#"$DOCS"/}"
  rel="${rel%/}"
  idx="$dir/index.md"
  if [ ! -f "$idx" ]; then
    echo "index drift: ${rel}/ — MISSING index.md ($(find "$dir" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ') docs)"
    DRIFT=1
    continue
  fi
  disk=$(find "$dir" -maxdepth 1 -name '*.md' ! -name 'index.md' -exec basename {} \; | sort -u)
  # Strip HTML comment spans, then keep ONLY entry rows (a `- ` list marker or a `|` ledger-table row);
  # from those, match bare backtick tokens `file.md` AND ledger-table markdown links [label](file.md).
  entry_rows=$(strip_html_comments "$idx" | grep -E '^[[:space:]]*(-[[:space:]]|\|)')
  indexed=$( { printf '%s\n' "$entry_rows" | grep -oE '`[^`/]*\.md`' | tr -d '`'; printf '%s\n' "$entry_rows" | grep -oE '\]\([^)/]*\.md\)' | sed -E 's/^\]\(//; s/\)$//'; } 2>/dev/null | grep -v '^index\.md$' | sort -u)
  unindexed=$(comm -23 <(echo "$disk") <(echo "$indexed") | grep -c . || true)
  phantom=$(comm -13 <(echo "$disk") <(echo "$indexed") | grep -c . || true)
  if [ "$unindexed" -gt 0 ] || [ "$phantom" -gt 0 ]; then
    u_list=$(comm -23 <(echo "$disk") <(echo "$indexed") | head -3 | tr '\n' ' ')
    p_list=$(comm -13 <(echo "$disk") <(echo "$indexed") | head -3 | tr '\n' ' ')
    msg="index drift: ${rel}/ —"
    [ "$unindexed" -gt 0 ] && msg="$msg ${unindexed} unindexed (${u_list% })"
    [ "$phantom" -gt 0 ] && msg="$msg ${phantom} phantom (${p_list% })"
    echo "$msg"
    DRIFT=1
  fi
done

[ "$STRICT" -eq 1 ] && exit "$DRIFT"
exit 0
