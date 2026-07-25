#!/usr/bin/env bash
# doc-refs.sh — diff-keyed docs-impact sweep (the twin of the unit-keyed wu-refs.sh).
#
# wu-refs is UNIT-keyed — "what awaits this unit"; doc-refs is DIFF-keyed — "given the
# diff, which human-doc claims about the changed things may now be false." Both GATHER
# references pointing at a key and hand them to triage; the load-bearing difference is the
# KEY (a diff's referents vs a unit id) and the CORPUS (the human-doc corpus vs the
# obligation stores). Full contract: reference/doc-refs-contract.md.
#
# It GATHERS + PRE-TAGS the mechanical rows; you actively choose only  still-true | stale
# per row. It TRIAGES, never blocks (candidate rows present is exit 0, not a failure).
#
# Usage:
#   scripts/doc-refs.sh <diff-range>          # e.g. main..HEAD | HEAD~3..HEAD | <base>..<head>
#   scripts/doc-refs.sh --staged              # the staged set (the pre-commit ADVISORY lane)
#   scripts/doc-refs.sh --files <paths...>    # an explicit changed-file set
#   scripts/doc-refs.sh <range> --grammar paths,commands,sections,env,license
#   scripts/doc-refs.sh <range> --config <path>     # exclusions + grammar config (default: .docrefs.config)
#
# Exactly one of <diff-range> | --staged | --files selects the change set; none → usage error (exit 2).
#
# THE INHERITED SCAR (fail LOUD). wu-refs once shipped a reserved-shell-variable bug that made it
# silently report "no references" — the exact silent-under-report failure it exists to prevent —
# caught only by a known-positive test. doc-refs inherits that scar as two hard rules:
#   * FAIL LOUD — an internal error (broken grammar, git failure, unreadable config) prints a loud
#     stderr diagnostic and exits >=3; it MUST NOT emit a clean-looking "(no doc-claims found)" that
#     an operator reads as "no drift."
#   * KNOWN-POSITIVE TEST — the script ships a test that runs it against a fixture diff carrying a
#     KNOWN doc claim and asserts the claim is found, per grammar (maintainer/tests/test-doc-refs.sh).
# NOTE ON RESERVED VARS: never name a variable GROUPS, PIPESTATUS, FUNCNAME, BASH_*, RANDOM, SECONDS,
# LINENO, IFS-as-global, REPLY, OPTARG/OPTIND, PWD/OLDPWD, UID/EUID — every name below is a plain,
# non-special identifier, which is exactly the bug class that scarred the twin.

set -uo pipefail

# ── graceful degrade outside a git repo (a notice, never a false "no drift") ──
repo_top="$(git rev-parse --show-toplevel 2>/dev/null)" || true
if [ -z "$repo_top" ]; then
  echo "doc-refs: not inside a git repository — docs-impact sweep skipped (nothing to sweep, not 'no drift')." >&2
  exit 0
fi
cd "$repo_top" || { echo "doc-refs: cannot cd to repo root '$repo_top' — aborting LOUD (exit 3)." >&2; exit 3; }

# One stderr-capture file for the git calls, so a git failure surfaces LOUD instead of masquerading
# as an empty sweep. Cleaned on exit.
err_capture="$(mktemp 2>/dev/null || echo /tmp/doc-refs-err.$$)"
trap 'rm -f "$err_capture" 2>/dev/null || true' EXIT

fail_loud() {  # $1 = message ; exits >=3
  echo "doc-refs: INTERNAL FAILURE — $1" >&2
  echo "doc-refs: aborting LOUD (exit 3) — refusing to emit a clean 'no doc-claims' from a tool error." >&2
  exit 3
}

print_usage() {
  cat >&2 <<'USAGE'
usage: scripts/doc-refs.sh <diff-range>        e.g. main..HEAD | HEAD~3..HEAD | <base>..<head>
       scripts/doc-refs.sh --staged            the staged set (the pre-commit advisory lane)
       scripts/doc-refs.sh --files <paths...>  an explicit changed-file set
  options:
       --grammar <list>   comma-separated: paths,commands,sections,env,license (overrides config)
       --config <path>    exclusions + grammar config (default: .docrefs.config)
  exactly one of <diff-range> | --staged | --files is required.
USAGE
}

trim() { local s="${1:-}"; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; printf '%s' "$s"; }

# ── argument parse ──
mode=""
range_arg=""
files_list=()
config_path=".docrefs.config"
grammar_override=""
positional=()

while [ $# -gt 0 ]; do
  case "$1" in
    --staged) mode="staged"; shift ;;
    --files)
      mode="files"; shift
      while [ $# -gt 0 ] && [ "${1#--}" = "$1" ]; do files_list+=("$1"); shift; done ;;
    --grammar)
      shift; grammar_override="$(trim "${1:-}")"
      [ -n "$grammar_override" ] || { echo "doc-refs: --grammar needs a value" >&2; print_usage; exit 2; }
      shift ;;
    --config)
      shift; config_path="$(trim "${1:-}")"
      [ -n "$config_path" ] || { echo "doc-refs: --config needs a path" >&2; print_usage; exit 2; }
      shift ;;
    --help|-h) print_usage; exit 0 ;;
    --*) echo "doc-refs: unknown flag '$1'" >&2; print_usage; exit 2 ;;
    *) positional+=("$1"); shift ;;
  esac
done

if [ "$mode" = "staged" ] || [ "$mode" = "files" ]; then
  [ ${#positional[@]} -eq 0 ] || { echo "doc-refs: cannot combine a diff-range with --$mode" >&2; exit 2; }
  if [ "$mode" = "files" ] && [ ${#files_list[@]} -eq 0 ]; then
    echo "doc-refs: --files needs at least one path" >&2; exit 2
  fi
else
  [ ${#positional[@]} -eq 1 ] || { print_usage; exit 2; }
  range_arg="${positional[0]}"
  mode="range"
fi

# ── config (pure-bash, no jq — honors the pre-commit dispatcher's bash-3.2+ constraint) ──
cfg_excludes=()      # git-pathspec globs to drop from the corpus
cfg_retirement=()    # globs → the retirement lane (surfaced, never owed a fix)
cfg_vendored=()      # globs → unverifiable-locally (frozen/cross-repo referents)
cfg_grammars=""      # config-enabled grammar list
cfg_canary=""        # a known real claim the grammar set MUST find on every run

parse_config() {
  [ -f "$config_path" ] || return 0
  local raw key val
  while IFS= read -r raw || [ -n "$raw" ]; do
    case "$(trim "$raw")" in ''|'#'*) continue ;; esac
    key="$(trim "${raw%%:*}")"
    val="$(trim "${raw#*:}")"
    case "$key" in
      exclude)              cfg_excludes+=("$val") ;;
      retirement)           cfg_retirement+=("$val") ;;
      vendored|external)    cfg_vendored+=("$val") ;;
      grammar|grammars)     cfg_grammars="$val" ;;
      canary)               cfg_canary="$val" ;;
      generated|flag-only)  : ;;   # declared surfaces: parsed, honored as read-only (never auto-edited anyway)
      *)                    : ;;    # unknown directive → ignore, never crash
    esac
  done < "$config_path"
}
parse_config

# enabled grammar set: --grammar > config > all five
enabled_grammars="${grammar_override:-${cfg_grammars:-paths,commands,sections,env,license}}"
grammar_on() {  # $1 = grammar name
  case ",$enabled_grammars," in *",$1,"*) return 0 ;; *) return 1 ;; esac
}

# ── corpus pathspecs (the human-doc corpus; reading is not colonizing) ──
corpus_pathspecs=(
  '*.md' '*.markdown' '*.mdx' '*.rst' '*.txt' 'README*' 'LICENSE*' 'CHANGELOG*'
  ':!scripts/doc-refs.sh' ':!scripts/wu-refs.sh'
  ':!.docrefs.config' ':!.docrefs-baseline'
  ':!.agent-docs/reference/docs-baseline.md'
)
if [ ${#cfg_excludes[@]} -gt 0 ]; then
  for exg in "${cfg_excludes[@]}"; do corpus_pathspecs+=(":!$exg"); done
fi

# ── baseline ledger (fencing + graduation + the parked-backlog banner) ──
baseline_file=""
[ -f ".docrefs-baseline" ] && baseline_file=".docrefs-baseline"
[ -f ".agent-docs/reference/docs-baseline.md" ] && baseline_file=".agent-docs/reference/docs-baseline.md"

baseline_has() {  # $1 = referent
  [ -n "$baseline_file" ] || return 1
  grep -Fq -- "$1" "$baseline_file" 2>/dev/null
}
baseline_parked_count() {
  [ -n "$baseline_file" ] || { printf '0'; return; }
  # data rows = table rows minus the header + separator (two), floored at 0
  local n
  n="$(grep -cE '^[[:space:]]*\|' "$baseline_file" 2>/dev/null || echo 0)"
  n=$(( n > 2 ? n - 2 : 0 ))
  printf '%s' "$n"
}

matches_any() {  # $1 = path ; $2.. = globs
  local p="$1"; shift
  local g
  for g in "$@"; do
    # shellcheck disable=SC2254
    case "$p" in $g) return 0 ;; esac
  done
  return 1
}

# ── the changed set + the diff signal lines (fail LOUD on a git error) ──
diff_names() {
  case "$mode" in
    range)  git diff --name-only "$range_arg" 2>"$err_capture" ;;
    staged) git diff --cached --name-only 2>"$err_capture" ;;
    files)  printf '%s\n' "${files_list[@]}" ;;
  esac
}
diff_content() {
  case "$mode" in
    range)  git diff "$range_arg" 2>"$err_capture" ;;
    staged) git diff --cached 2>"$err_capture" ;;
    files)  git diff HEAD -- "${files_list[@]}" 2>"$err_capture" ;;
  esac
}

changed_files="$(diff_names)"; rc=$?
[ $rc -eq 0 ] || fail_loud "could not compute the changed-file set (mode=$mode): $(trim "$(cat "$err_capture" 2>/dev/null)")"

diff_body="$(diff_content)"; rc=$?
[ $rc -eq 0 ] || fail_loud "could not compute the diff content (mode=$mode): $(trim "$(cat "$err_capture" 2>/dev/null)")"

# the added/removed hunk lines only (drop the +++/--- file headers)
signal_lines="$(printf '%s\n' "$diff_body" | grep -E '^[+-]' | grep -Ev '^(\+\+\+|---)' || true)"

# ── corpus matcher (fail LOUD if git grep itself errors; rc 1 == no match is normal) ──
# Two match modes, because a DOC CLAIM cites its referent differently by class:
#   F   — a plain fixed-string hit. Right for distinctive tokens (a path, `--ttl`, `MYAPP_BASE_URL`,
#         `ADR-0007`, `§3.2`) that do not collide with incidental prose.
#   sym — a bare identifier (an exported symbol) matched ONLY inside a `code span`. The contract's
#         symbol matcher is a code-span citation ("the `Shorten` method"), NOT bare prose: a symbol
#         named `helper` must not match the word "helper" in a sentence, or the sweep manufactures the
#         false stales that make a corpus refuse the tool.
grep_corpus() {  # $1 = referent ; $2 = mode (F|sym, default F) → prints  path:line:content
  local ref="$1" mode="${2:-F}" out grc
  if [ "$mode" = "sym" ]; then
    out="$(git grep -n --untracked -E -e "\`[^\`]*\b${ref}\b[^\`]*\`" -- "${corpus_pathspecs[@]}" 2>"$err_capture")"; grc=$?
  else
    # -w (WORD-BOUNDARY anchoring): a fixed-string referent matches only as a WHOLE WORD, so a short/
    # generic token (`the`, `cat`) cannot flood by substring-matching inside larger words (`there`,
    # `category`). Paired with the ≥3-char minimum-length gate in process_grammar, this is the anti-flood
    # hardening: length kills single-char noise (`h`); -w kills substring noise. Distinctive tokens (a
    # path, `--ttl`, `MYAPP_BASE_URL`, `§3.2`) are unaffected — they are already whole-word bounded.
    out="$(git grep -n --untracked -F -w -e "$ref" -- "${corpus_pathspecs[@]}" 2>"$err_capture")"; grc=$?
  fi
  [ $grc -le 1 ] || fail_loud "git grep failed (rc=$grc) matching referent '$ref': $(trim "$(cat "$err_capture" 2>/dev/null)")"
  printf '%s' "$out"
}

ref_mode() {  # $1 = referent → F for a path/filename (has a / or a .ext), sym for a bare identifier
  case "$1" in
    */*|*.*) printf 'F' ;;
    *)       printf 'sym' ;;
  esac
}

# ── output accounting ──
rows_emitted=0
canary_note=""

emit_row() {  # $1 referent-desc  $2 claim  $3 proposed  $4 weight(optional)
  printf '  referent:  %s\n' "$1"
  printf '  claim:     %s\n' "$2"
  printf '  proposed:  %-38s confirm: ____\n' "$3"
  [ -n "${4:-}" ] && printf '  weight:    %s\n' "$4"
  printf '\n'
  rows_emitted=$(( rows_emitted + 1 ))
}

fmt_cite() {  # $1 = a  path:line:content  git-grep line → "path:line  \"snippet\""
  local line="$1" p rest ln content
  p="${line%%:*}"; rest="${line#*:}"; ln="${rest%%:*}"; content="${rest#*:}"
  content="$(trim "$content")"
  [ ${#content} -gt 72 ] && content="${content:0:72}…"
  printf '%s:%s  "%s"' "$p" "$ln" "$content"
}

# classify the fence/state for one corpus hit line, given the referent + the grammar's hit-state.
# order of precedence: retirement > baseline-graduation > provenance/record-fact > unverifiable > default.
classify_hit() {  # $1 = hit line (path:line:content) ; $2 = referent ; $3 = default hit-state → prints proposed
  local line="$1" ref="$2" default_state="$3" doc="${1%%:*}" content
  content="${line#*:}"; content="${content#*:}"
  if [ ${#cfg_retirement[@]} -gt 0 ] && matches_any "$doc" "${cfg_retirement[@]}"; then
    printf '[retirement] — dying doc, no fix owed'; return
  fi
  if baseline_has "$ref"; then
    printf '%s  [graduated from baseline → live]' "$default_state"; return
  fi
  case "$doc" in archive/*|*/archive/*) printf 'provenance/record-fact (frozen history)'; return ;; esac
  case "$content" in *'[historical as-of'*) printf 'provenance/record-fact (frozen history)'; return ;; esac
  if [ ${#cfg_vendored[@]} -gt 0 ] && matches_any "$doc" "${cfg_vendored[@]}"; then
    printf 'unverifiable-locally (frozen/cross-repo referent)'; return
  fi
  printf '%s' "$default_state"
}

# process a list of referents for one grammar.
#   $1 label · $2 coverage-expected(yes|no) · $3 default hit-state · $4 uncovered weight ·
#   $5 match-mode (plain|auto) · stdin = referents
process_grammar() {
  local label="$1" coverage="$2" hit_state="$3" unc_weight="$4" match_mode="${5:-plain}"
  # MINIMUM-LENGTH gate (≥3 chars): drop single-/two-char referents (`h`, `x`, `io`) at intake so they
  # can never flood the sweep. This is the extraction-side half of the anti-flood hardening; the
  # word-boundary (-w) matcher in grep_corpus is the matching-side half. A bare identifier that survives
  # the gate is still matched only inside a code span (sym mode), so a prose stop-word cannot flood either.
  local refs; refs="$(sort -u | grep -v '^$' | awk 'length($0) >= 3' || true)"
  if [ -z "$refs" ]; then
    printf '── %s ──\n  (no referents changed under this grammar)\n\n' "$label"
    return 0
  fi
  local header_done=0 open_header
  open_header() { [ "$header_done" -eq 1 ] || { printf '── %s ──\n' "$label"; header_done=1; }; }
  local mode_for  # per-referent match mode: 'auto' resolves each ref to F|sym; else the fixed mode
  mode_for() { if [ "$match_mode" = "auto" ]; then ref_mode "$1"; else printf 'F'; fi; }

  local ref hits any_hit_this_grammar=0
  # PASS 1 — uncovered (coverage-expected referents with zero doc hits): the mechanical inverse, ranked high.
  if [ "$coverage" = "yes" ]; then
    while IFS= read -r ref; do
      [ -n "$ref" ] || continue
      hits="$(grep_corpus "$ref" "$(mode_for "$ref")")"
      if [ -z "$hits" ]; then
        open_header
        emit_row "$ref  (changed; expects a doc claim)" "(no doc cites this — expected-but-absent)" "uncovered" "$unc_weight"
      fi
    done <<< "$refs"
  fi
  # PASS 2 — covered referents: one claim row per hit, for the agent to judge (or the pre-tag to confirm).
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    hits="$(grep_corpus "$ref" "$(mode_for "$ref")")"
    [ -n "$hits" ] || continue
    any_hit_this_grammar=1
    local hit proposed count=0
    while IFS= read -r hit; do
      [ -n "$hit" ] || continue
      count=$(( count + 1 ))
      if [ $count -gt 10 ]; then
        open_header
        printf '  … (further claims for "%s" truncated — grep the corpus by hand)\n\n' "$ref"
        break
      fi
      proposed="$(classify_hit "$hit" "$ref" "$hit_state")"
      open_header
      emit_row "$ref" "$(fmt_cite "$hit")" "$proposed" ""
    done <<< "$hits"
  done <<< "$refs"

  if [ "$header_done" -eq 0 ]; then
    printf '── %s ──\n  (no referents matched under: %s)\n\n' "$label" "$label"
  fi
}

# ── grammar EXTRACTORS (diff → the set of changed referents of each class) ──

extract_paths() {  # changed paths + their basenames
  printf '%s\n' "$changed_files" | while IFS= read -r f; do
    [ -n "$f" ] || continue
    printf '%s\n' "$f"
    printf '%s\n' "${f##*/}"
  done
}
extract_symbols() {  # exported/defined identifiers touched in the hunks
  printf '%s\n' "$signal_lines" \
    | grep -oE '(function|def|class|func|const|let|var|type|interface|struct|fn|public|private|export)[[:space:]]+[A-Za-z_][A-Za-z0-9_]*' \
    | awk '{print $NF}'
}
extract_commands() {  # long CLI flags + HTTP routes touched in the hunks
  printf '%s\n' "$signal_lines" | grep -oE -- '--[a-z][a-z0-9-]+'
  printf '%s\n' "$signal_lines" | grep -oE '(GET|POST|PUT|PATCH|DELETE)[[:space:]]+/[A-Za-z0-9_/-]+' \
    | awk '{print $2}'
}
extract_sections() {  # §-ids + amendment / decision / review / revisit / obligation ids
  printf '%s\n' "$signal_lines" | grep -oE '§[0-9]+(\.[0-9]+)*' || true
  printf '%s\n' "$signal_lines" \
    | grep -oE '\b(ADR-[0-9]{3,4}|AMENDMENT-[0-9]+|REV-[0-9]{3}(-F[0-9]+)?|RV-[0-9]+|FR-[0-9]{3,4}|OQ-[0-9]+)\b' || true
}
extract_env() {  # UPPER_SNAKE env-vars / feature flags (require an underscore → drops CONST noise)
  printf '%s\n' "$signal_lines" | grep -oE '\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b'
}

# ── license-join (a first-class check, diff-scoped: fires only when the diff touches a manifest
#    license field, the lockfile, or a component's packaging — small ≠ safe, ranked HIGH). ──
is_manifest() {
  case "${1##*/}" in
    package.json|Cargo.toml|pyproject.toml|go.mod|Gemfile|composer.json|setup.py|setup.cfg|pom.xml|build.gradle|Package.swift|*.gemspec|*.cabal) return 0 ;;
  esac
  return 1
}
is_lockfile() {
  case "${1##*/}" in
    package-lock.json|yarn.lock|pnpm-lock.yaml|Cargo.lock|poetry.lock|go.sum|Gemfile.lock|composer.lock|Pipfile.lock) return 0 ;;
  esac
  return 1
}
run_license_join() {
  local triggered=0 f
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if is_lockfile "$f"; then triggered=1; break; fi
    if is_manifest "$f" && printf '%s\n' "$signal_lines" | grep -qi 'license'; then triggered=1; break; fi
  done <<< "$changed_files"
  if [ "$triggered" -eq 0 ]; then
    printf '── license-join ──\n  (no manifest license field / lockfile / packaging in this diff)\n\n'
    return 0
  fi
  printf '── license-join ──\n'
  local table_hit
  table_hit="$(grep_corpus 'license')"
  if [ -n "$table_hit" ]; then
    emit_row "manifest license metadata changed" \
      "$(fmt_cite "$(printf '%s\n' "$table_hit" | head -n1)")" \
      "verify every encumbered dependency has a README/LICENSE table row" "high (legal surface)"
  else
    emit_row "manifest license metadata changed" \
      "(no README/LICENSE license table found — encumbered deps may be undocumented)" \
      "uncovered" "high (legal surface)"
  fi
}

# ── run the canary (a "(no doc-claims found)" worksheet is trustworthy only if a canary fired) ──
#
# A DEFAULT known-positive canary the SCRIPT ITSELF carries: the sentinel literal below lives in this file,
# so a fresh install with NO .docrefs.config still gets a fired canary by default — its clean sweep is
# evidence, not an unverified guess. ENTAILMENT: the default canary proves the grep INSTRUMENT fires (the
# matcher can read a file and return a known-present hit); it does NOT prove the sweep fires on the RIGHT
# proposition (that a real doc claim about the changed code would be found) — that stronger, corpus-scoped
# assurance is what a CONFIGURED `canary:` referent buys. The loud UNVERIFIED path now fires ONLY when the
# canary mechanism is turned OFF on purpose (`canary: off`), never merely because none was configured.
DEFAULT_CANARY_SENTINEL="doc-refs-default-canary-sentinel-do-not-remove"

run_canary() {
  # explicit opt-out — the ONLY remaining UNVERIFIED path (the operator disabled the instrument knowingly).
  case "$(printf '%s' "$cfg_canary" | tr '[:upper:]' '[:lower:]')" in
    off|none|disabled|false|no)
      echo "doc-refs: NOTE — canary mechanism disabled (canary: $cfg_canary); a '(no doc-claims)' this run is UNVERIFIED by choice." >&2
      canary_note="canary DISABLED (canary: $cfg_canary) — emptiness is UNVERIFIED (see baseline-mechanism.md §1)"
      return 0 ;;
  esac
  if [ -n "$cfg_canary" ]; then
    # CONFIGURED corpus-scoped canary — proposition-level: proves the sweep still finds a real doc claim.
    if [ -n "$(grep_corpus "$cfg_canary")" ]; then
      canary_note="canary fired ('$cfg_canary' still found) — emptiness is trustworthy"
    else
      echo "doc-refs: WARNING — the configured canary '$cfg_canary' did NOT fire this run." >&2
      echo "doc-refs: the grammar set may be mis-scoped or the corpus glob unreached — treat any '(no doc-claims)' as evidence about the QUERY, not the world." >&2
      canary_note="!! CANARY DID NOT FIRE — emptiness is UNTRUSTWORTHY (mis-scoped grammar / unreached corpus)"
    fi
    return 0
  fi
  # DEFAULT self-carried canary — instrument-level: grep the sentinel out of THIS script's own file.
  self_path="${BASH_SOURCE:-$0}"
  if [ -n "$self_path" ] && grep -Fq -- "$DEFAULT_CANARY_SENTINEL" "$self_path" 2>/dev/null; then
    canary_note="default canary fired (self-test sentinel found) — the grep instrument works; emptiness is trustworthy (instrument-level — set a corpus 'canary:' for proposition-level assurance)"
  else
    echo "doc-refs: WARNING — the DEFAULT self-test canary did NOT fire; the grep instrument itself may be broken (locale, a shadowed grep, an unreadable script)." >&2
    canary_note="!! DEFAULT CANARY DID NOT FIRE — the grep instrument is not firing; emptiness is UNTRUSTWORTHY"
  fi
}
run_canary

# ── the pre-commit ADVISORY lane is quiet-on-empty: a zero-referent staged sweep emits one terse line ──
have_any_referent=0
[ -n "$(trim "$changed_files")" ] && have_any_referent=1
[ -n "$(trim "$signal_lines")" ] && have_any_referent=1
if [ "$mode" = "staged" ] && [ "$have_any_referent" -eq 0 ]; then
  echo "doc-refs (--staged): no changed referents in the staged set — nothing to triage. [$canary_note]"
  exit 0
fi

# ── the worksheet ──
scope_desc="$range_arg"
[ "$mode" = "staged" ] && scope_desc="--staged (the staged set)"
[ "$mode" = "files" ] && scope_desc="--files (${#files_list[@]} path(s))"

printf '# docs-impact sweep — you actively choose only  still-true | stale  per row;\n'
printf '#   uncovered · provenance/record-fact · unverifiable-locally are PRE-TAGGED confirmations,\n'
printf '#   and [retirement] · [baseline] are fenced out of accountability entirely.\n'
printf '# canary: %s\n\n' "$canary_note"
printf '════════ referents changed in: %s ════════\n' "$scope_desc"

# grammars ordered high→low load-bearing; each self-skips its block when disabled.
# NB: process_grammar is fed by process SUBSTITUTION (`< <(...)`), NOT a pipe — a pipe would run the
# function in a subshell, and its rows_emitted increment would never reach the parent, printing a FALSE
# "(no doc-claims found)" under a worksheet that DID surface claims. That is precisely the silent-under-
# report class the fail-loud scar exists to prevent, so the counting must stay in the current shell.
grammar_on license  && run_license_join
grammar_on commands && process_grammar "commands/routes" "yes" "(agent — still-true|stale)" "high (public CLI/route)" "plain" < <(extract_commands)
grammar_on env      && process_grammar "env-vars/flags/wire-shapes" "yes" "(agent — still-true|stale)" "high (public config)" "plain" < <(extract_env)
grammar_on sections && process_grammar "§/amendment-ids" "no" "amendment-chain unresolved → agent resolves" "" "plain" < <(extract_sections)
grammar_on paths    && process_grammar "paths/symbols" "no" "(agent — still-true|stale)" "" "auto" < <(extract_paths; extract_symbols)

# ── the parked-baseline backlog banner (standalone visibility net — not a landfill) ──
parked="$(baseline_parked_count)"
if [ -n "$baseline_file" ]; then
  printf '── inherited-drift backlog ──\n  %s row(s) parked in %s (untouched by this diff; surfaced as a count, not a false positive).\n\n' \
    "$parked" "$baseline_file"
fi

# ── the honest empty result (guarded by the canary — never answer from absence) ──
if [ "$rows_emitted" -eq 0 ]; then
  printf '(no doc-claims found across the enabled grammars — %s)\n' "$canary_note"
fi

# exit 0: swept cleanly; candidate rows present is NOT a failure (the gate triages, never blocks).
exit 0
