---
name: kit-doctor
description: Re-runnable Fieldbook health check. Verifies the Claude Code version against the kit's assumptions, that the hooks fire and core.hooksPath is set, that every hook script has a tracked settings.json registration (and every registration a script), that jq/python3/stat are present, that the doc-schema + index lint are clean, and that the install manifest matches what's on disk (flagging drift/missing files). Reports findings and SUGGESTS fixes but mutates nothing without consent. Use when hooks seem inert, after a Claude Code update, after a fresh clone, or any time you want to confirm the install is still live and wired.
provenance: kit-template
created: 2026-07-03
last-modified: 2026-07-09
tags: [skill, lifecycle, kit, health-check, manifest]
---

# /kit-doctor — is this install still live and wired?

A read-only health sweep over a Fieldbook install. It answers one question — *"is everything the kit
promises actually active here, right now?"* — and it catches the silent-inertness failures that don't
throw errors: hooks not wired on a fresh clone, a missing `jq` that no-ops every gate, a Claude Code
version past what the kit was verified against, a manifest that no longer matches disk. It **reports and
suggests**; it changes nothing unless you say yes to a specific offered fix.

**Foreground in the main agent.** Safe to run anytime — it is read-only by default.

## When to invoke

- After a **fresh clone** (hooks are inert until wired — the #1 silent failure).
- After a **Claude Code update** (verify the harness still matches the kit's assumptions).
- When **hooks seem inert** — the safety gate didn't fire, SessionStart said nothing.
- Periodically, or before trusting the install after time away.

## When NOT to invoke

- To reconcile against a newer zip → `/kit-upgrade`. To remove → `concierge/uninstall.md`.
- Mid-destructive-operation — wait for a natural pause (though it's read-only, keep the tree quiet).

## Checks

Run each, collect a `PASS` / `WARN` / `FAIL` with a one-line remedy. Do NOT fix inline — gather all
findings, then offer fixes at the end (§Report).

### 1. Manifest present + parseable

```bash
pwd && git rev-parse --show-toplevel 2>/dev/null
test -f .agent-docs/.kit-manifest.json && \
  python3 -c 'import json;d=json.load(open(".agent-docs/.kit-manifest.json"));print("manifest OK: kit",d.get("kit-version"),"profile",d.get("profile"),"stack",d.get("stack"))' \
  || echo "FAIL manifest missing/unreadable — is Fieldbook installed here?"
```

No manifest ⇒ not a Fieldbook install (or it was uninstalled). Everything else keys off it.

### 2. Claude Code version vs the kit's assumptions

The kit is stamped "verified against Claude Code vX.Y" (in the manifest as `cc-version-assumed`, and in
`README.md`). Compare the running harness:

```bash
claude --version 2>/dev/null || echo "(couldn't read Claude Code version)"
```

- Running version ≥ the assumed version, same major → **PASS**.
- Running version well ahead / a new major → **WARN**: hook payload field names or skill front-matter
  keys can drift across major versions; suggest re-checking the hooks fire (§4) and, if anything is
  off, `/kit-upgrade` to a kit built against the newer harness.
- Can't read it → **WARN**, note it's informational only.

### 3. Toolchain present (the degrade-to-no-op tools)

```bash
for t in bash git jq python3 stat; do
  command -v "$t" >/dev/null 2>&1 && echo "PASS $t" || echo "WARN $t missing"; done
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 \
  || echo "WARN no sha256sum/shasum — manifest hash checks (§8) limited"
```

- `bash`/`git` missing → **FAIL** (the kit can't operate).
- `jq` missing → **WARN**: all four hooks no-op silently; enforcement is off until installed.
- `python3` missing → **WARN**: the doc-schema lint (§7) can't run.
- `stat` — only WARN if BOTH GNU (`stat -c %Y`) and BSD (`stat -f %m`) forms fail.

### 4. Hooks are wired AND fire

Confirm `settings.json` parses and wires the four events, then dry-fire the ones that are safe to
exercise:

```bash
python3 -c 'import json;json.load(open(".claude/settings.json"));print("settings.json: valid")' \
  || echo "FAIL settings.json invalid — Claude Code silently ignores it; hooks are all off"
for ev in SessionStart PreCompact SubagentStart PreToolUse; do
  grep -q "\"$ev\"" .claude/settings.json && echo "PASS wired: $ev" || echo "WARN not wired: $ev"; done

# PreToolUse safety gate (Standard+): must deny a force-push, stay silent on a read
if [ -f .claude/hooks/pretooluse-safety-gates.sh ]; then
  bash -n .claude/hooks/pretooluse-safety-gates.sh && echo "PASS gate syntax"
  printf '%s' '{"tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}' \
    | bash .claude/hooks/pretooluse-safety-gates.sh | grep -q '"deny"' \
    && echo "PASS gate denies force-push" || echo "WARN gate did not deny — check jq + assembly"
fi
```

A missing event on a Standard+ install ⇒ the merge dropped it; suggest re-running the merge step. A
gate that won't deny with `jq` present ⇒ the assembly is broken; suggest re-assembling (never
hand-editing) `pretooluse-safety-gates.sh`.

### 5. Hook scripts registered (script present ⇄ registration present)

§4 checks the events the kit expects; this check goes the other way — a script that sits under
`.claude/hooks/` with no registration in the **tracked** `.claude/settings.json` never fires, and
scripts-present-but-unregistered is the classic hand-seeded-repo failure: the scripts were copied over
but the registrations lived in someone's `settings.local.json` (gitignored — a clone never gets it) or
were never committed, so every gate is silently off while the tree *looks* fully installed. The
install-time smoke test only covers fresh concierge installs; this is the re-runnable check that
catches the hand-seeded case.

```bash
# Forward: every executable hook script must be reachable from a TRACKED caller.
# settings.local.json does NOT count — it is gitignored and a clone never gets it.
for f in .claude/hooks/*; do
  [ -f "$f" ] && [ -x "$f" ] || continue
  base=$(basename "$f")
  case "$base" in install-hooks.sh) continue;; esac   # operator-run bootstrap, not an event hook
  if grep -q "$base" .claude/settings.json 2>/dev/null; then echo "PASS registered: $base"
  elif grep -rl "$base" .githooks .claude/hooks --exclude="$base" 2>/dev/null | grep -q .; then
    echo "PASS invoked indirectly (helper): $base"
  else echo "FAIL script present, never fires: $base"; fi
done

# Inverse: a registration pointing at a script that isn't there (or isn't executable).
grep -o '\.claude/hooks/[^" ]*' .claude/settings.json 2>/dev/null | sort -u | while read -r p; do
  [ -f "$p" ] || { echo "FAIL registration points at missing script: $p"; continue; }
  [ -x "$p" ] || echo "WARN registered but not executable: $p — chmod +x"; done
```

- Script referenced nowhere tracked → **FAIL** "script present, never fires" — fix: register it in
  `.claude/settings.json` (re-run the merge step, or copy the wiring block from the kit's settings
  template) or remove the script; a dead script is drift bait either way.
- Registration pointing at a missing script → **FAIL**: the event fires into nothing — restore the
  script (from the kit source or `/kit-upgrade`) or drop the stale registration.
- Registered but not executable → **WARN**: `chmod +x` (offered in §Report).

### 6. `core.hooksPath` set (the fresh-clone-inert trap)

```bash
[ "$(git config --get core.hooksPath 2>/dev/null)" = ".githooks" ] \
  && echo "PASS core.hooksPath=.githooks" \
  || echo "FAIL core.hooksPath unset — git pre-commit gates are INERT on this clone"
```

This is the check that most often fails on a fresh clone: the tracked `.githooks/` do nothing until git
is pointed at them, and it's a per-clone LOCAL setting that no commit can carry. Fix (offered in
§Report): `bash .claude/hooks/install-hooks.sh`.

### 7. Doc-schema + index lint clean

```bash
if command -v python3 >/dev/null 2>&1 && [ -f .claude/hooks/lint-docs.py ]; then
  python3 .claude/hooks/lint-docs.py --root .agent-docs --now "$(date +%Y-%m-%d)"
else echo "WARN doc-schema linter unavailable (python3 or lint-docs.py missing)"; fi
```

Rule 13 (index completeness) is the hook-enforced one; any FAIL there means a dir's `index.md` drifted
from disk (add/retire a doc without updating its index). Staleness (rule 12) is WARN-only — a stale
`now/*` is a nudge, not a failure. Report the linter's own summary line verbatim.

### 8. Manifest matches disk

For each file the manifest records, confirm it still exists and (for `kit-owned`, unmerged files) note
whether its hash still matches — a mismatch isn't a fault, it means the colleague edited it (useful to
know before a `/kit-upgrade`):

```bash
sha() { command -v sha256sum >/dev/null 2>&1 && sha256sum "$1" | cut -d' ' -f1 || shasum -a 256 "$1" | cut -d' ' -f1; }
# For each manifest file: exists? kit-owned sha == recorded sha?  (report drift, don't "fix" it)
```

- A manifest file **missing on disk** → **WARN**: something deleted a kit file; offer to restore it
  from the kit source (if a newer/original kit is reachable) or note it for `/kit-upgrade`.
- A `kit-owned` file whose hash **differs** from the manifest → **INFO** "you've edited this — it's
  yours now; `/kit-upgrade` will leave it alone." Not a fault.
- Merged files (`CLAUDE.md`, `settings.json`) are expected to differ — check only that the kit's marker
  block / hook entries are still present, not the whole-file hash.

## Report

Show one compact table, most-severe first, each with its remedy:

```
/kit-doctor — <profile> · <stack> · kit <version>   (Claude Code <running> vs assumed <X.Y>)
  FAIL  core.hooksPath unset ........... fix: bash .claude/hooks/install-hooks.sh
  WARN  jq missing ..................... fix: install jq (hooks no-op without it)
  INFO  standing-rules-core.md edited .. yours now; /kit-upgrade will keep it
  PASS  settings.json valid + 4 hooks wired
  PASS  doc-schema lint clean
  ...
```

Then: **offer** the fixes for the FAILs/WARNs, each as a discrete yes/no — the only things that mutate
anything are `install-hooks.sh` (wire the gate) and, on consent, restoring a manifest file the colleague
agrees is missing. Everything else is a recommendation. **`/kit-doctor` never fixes silently and never
commits.** If the colleague wants the deeper install proof (gate dry-fires, `/orient` cold), point them
at `concierge/verify-install.md`.

## Anti-patterns

- Do NOT auto-fix. Report first; apply only the specific fixes the colleague says yes to.
- Do NOT treat a hash mismatch on a kit-owned file as corruption — it's the colleague's edit; flag,
  don't overwrite.
- Do NOT flag a stale `now/*` (rule 12) as a failure — it's a WARN nudge.
- Do NOT commit anything.

## Design rationale

Every check targets a *silent* failure — one that produces no error, just quiet inertness: an unwired
hook, a missing `jq`, a drifted index, a manifest out of sync with disk. Those are exactly the failures
the source system had on a fresh clone (hooks promised but inert until a manual step). `/kit-doctor` is
the re-runnable proof that the install is still doing what the rules claim it does; `verify-install.md`
is the deeper one-time smoke test at install, and `/kit-upgrade` acts on the drift this surfaces.
