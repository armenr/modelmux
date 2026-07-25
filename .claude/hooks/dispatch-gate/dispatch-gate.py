#!/usr/bin/env python3
# dispatch-gate.py — the deterministic dispatch-conformance PreToolUse gate (check engine).
# provenance: kit-template · created: 2026-07-13 · last-modified: 2026-07-13
#
# Enforces the FAIL-LOUD DISPATCH CONTRACT v1 over the two dispatch surfaces — the Agent tool (plain
# sub-agent dispatches) and the Workflow tool (dynamic workflows). It reads a PreToolUse stdin payload,
# runs a catalog of STRUCTURAL checks, and emits an allow / deny / surface decision as JSON on stdout.
#
# It rhymes with lint-docs.py deliberately (the kit's other portable check engine): a numbered check
# catalog, FAIL vs WARN severities, brownfield-inert activation (keys on a governance DECLARATION, never a
# filename), a known-positive self-test, and stock Python 3 / stdlib only — no jq, no JS parser, no PyYAML.
#
# What it enforces (STRUCTURE, never CONTENT — see the disclaimer in the README and the reference doc):
#   CA1  (Agent)     model pin present + non-empty — GRADED: WARN on an undeclared dispatch, FAIL on a
#                    declared one (never retro-blocks a brownfield repo; bites where the author opted in).
#   CW1  (Workflow)  the pasted fail-loud preamble is present, un-tampered (canonicalised body hash ==
#                    the header's declared hash), and current (== the gate's pinned hash for its version).
#   CW3  (Workflow)  a naked .filter(Boolean)-family compaction on a fan-out result (a silent-drop idiom) — WARN.
#   CB4  (both)      a governed fan-out's completeness/accounting lives in the leg's RETURN — the terminal
#                    return must be a sanctioned primitive call (fanout()/manifestDiff()) — Workflow FAIL,
#                    Agent WARN. NEVER a grep of the file body for accounting tokens (the preamble supplies
#                    them by construction) — only the CALL in return position is credited.
#   CB2  (both)      a declared build/migrate leg names the honesty fields in its return — WARN (a proxy;
#                    the gate checks the schema DECLARES them, never that they are TRUE).
#   CX1  (both)      DECLARED-DEGRADED / verdict conflict + malformed bypass — reads the leg's returned
#                    coverage/verdict ONLY (never the preamble body); a declared-degraded leg that also
#                    asserts COMPLETE/READY is the contradiction R3(b) forbids — FAIL, not bypassable.
#
# The escape hatch (contract v1 R3(b), hardened): a well-formed `fieldbook:degraded` annotation downgrades
# a SCOPED FAIL to allow-through + an audit line. Hardened so it is not a rubber stamp: no `scope: all`
# (enumerated check-ids only), a resolvable operator-artifact reference required, and every use is appended
# to `.agent-docs/.gate-audit.jsonl` for the cycle-start bypass-review sweep.
#
# Fail-open discipline (the completeness-gate inversion of "degrade silently"): an UNKNOWN tool_input shape,
# an unreadable scriptPath, a parse error, or any unexpected exception emits a LOUD "did-not-run / UNVERIFIED"
# surface and allows — never a silent pass, never a hard block on a shape the gate cannot read. Absence of a
# finding is never mistaken for a pass.
#
# The one normative statement of R1-R6 is agent-docs/reference/fail-loud-dispatch-contract.md — this gate
# CITES it and never restates it.
#
# CLI:
#   dispatch-gate.py --surface agent|workflow      # hook mode: read stdin payload, emit the decision JSON
#   dispatch-gate.py --hash-preamble PATH          # print the canonical body hash of a preamble file
#   dispatch-gate.py --make-preamble PATH          # recompute + rewrite the preamble header hash in place
#   dispatch-gate.py --self-check                  # verify the pinned hash matches the shipped preamble.js
#   dispatch-gate.py --surface S --emit-findings   # print findings as JSON (used by the self-test harness)

import argparse
import datetime
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REFERENCE_DOC = ".agent-docs/reference/fail-loud-dispatch-contract.md"

FAIL = "FAIL"
WARN = "WARN"

# ---------------------------------------------------------------------------------------------------
# Configurable protocol token (the kit-name marker). ONE place to rename the kit-name that appears as a
# FUNCTIONAL protocol token in three spots: the preamble header/END marker LABEL, the `<token>:dispatch` /
# `<token>:degraded` annotation markers an author types, and the `<TOKEN>_GATE_CWD` env var. A leak-gated
# public adopter who cannot carry the kit name byte-for-byte renames it here (or via the env override)
# instead of hand-forking the whole gate.
#
# Precedence (documented): the DISPATCH_GATE_TOKEN environment variable wins when set and non-empty;
# otherwise DEFAULT_PROTOCOL_TOKEN below. The DEFAULT is EXACTLY the shipped token, so every existing
# install is byte-for-byte unaffected and the numbered-check behaviour is identical.
#
# HASH-INVARIANCE (verified property): the token appears ONLY in the preamble's HEADER and END marker
# LINES. canonical_body_hash() hashes the body STRICTLY BETWEEN those two lines (see extract_preamble ->
# body = lines[header+1 : end]), so the header/END lines — and therefore the token — are EXCLUDED from the
# hashed body. Renaming the token cannot change the pinned canonical body hash; PINNED_PREAMBLES stays
# valid across a rename. (The preamble block is also located token-AGNOSTICALLY below, so --self-check /
# --make-preamble / --hash-preamble keep working on a preamble.js carrying any token label.)
DEFAULT_PROTOCOL_TOKEN = "fieldbook"
PROTOCOL_TOKEN = (os.environ.get("DISPATCH_GATE_TOKEN") or DEFAULT_PROTOCOL_TOKEN).strip() \
    or DEFAULT_PROTOCOL_TOKEN
_TOKEN_LOWER = PROTOCOL_TOKEN.lower()
_TOKEN_UPPER = PROTOCOL_TOKEN.upper()
GATE_CWD_ENV = _TOKEN_UPPER + "_GATE_CWD"            # e.g. FIELDBOOK_GATE_CWD (cwd fallback for the gate)
PREAMBLE_MARKER = _TOKEN_UPPER + " DISPATCH PREAMBLE"  # the label the header/END lines carry + make-preamble stamps
DISPATCH_ANNOTATION = _TOKEN_LOWER + ":dispatch"      # the Agent opt-in marker: <!-- <token>:dispatch ... -->
DEGRADED_ANNOTATION = _TOKEN_LOWER + ":degraded"      # the escape-hatch marker: <token>:degraded

# ---------------------------------------------------------------------------------------------------
# Preamble version/hash pin (currency table). Each entry is version -> canonical body hash. The shipped
# preamble.js header declares the SAME hash for its version; the gate cross-checks both directions:
#   * self-consistency — the header's declared hash == the recomputed canonical hash of its own body
#     (catches a hand-edit that forgot to regenerate the header).
#   * currency        — (version, recomputed hash) is in this table (catches a self-consistent but tampered
#     header, or an old/unknown version).
# Regenerate the header with make-preamble.sh after any preamble edit, and update this table to match; the
# self-test (--self-check) FAILS LOUD if the two drift, so the pin can never silently rot.
# ---------------------------------------------------------------------------------------------------
PINNED_PREAMBLES = {
    # 0.8.1: fanout() thunk-wraps internally (the pre-fix body's fan-out had never executed — promises
    # into a thunk-expecting parallel) + the interim-thunk loud guard. Old-hash copies now FAIL CW1 by
    # design: the mismatch nag IS the migration pressure toward the executing body.
    "1.0.0": "745a31d8d5a6141497308793fff23d81845c465963fe82d0095cd7f302c62866",
}
PREAMBLE_CURRENT_VERSION = "1.0.0"

# Marker lines. The header line (which carries the sha256) is NOT part of the hashed body — there is no
# self-reference. The body is everything strictly between the header line and the END line. The block is
# located TOKEN-AGNOSTICALLY (`\S+ DISPATCH PREAMBLE …`) so a rename of the protocol-token label never
# blinds detection — the fail-loud primitives are hash-verified regardless of the header's label, and the
# utility modes (--self-check / --make-preamble / --hash-preamble) keep working on any-token preamble.js.
# The token stays FUNCTIONAL where it must be strict: the `<token>:dispatch` / `<token>:degraded`
# annotation markers below (the opt-in switches) match the CONFIGURED token exactly.
PREAMBLE_HEADER_RE = re.compile(
    r"\S+ DISPATCH PREAMBLE\s+v(?P<ver>\d+\.\d+\.\d+)\s+contract:(?P<contract>\S+)\s+"
    r"sha256:(?P<sha>[0-9a-fA-F]{64})"
)
PREAMBLE_END_RE = re.compile(r"END \S+ DISPATCH PREAMBLE")


class Finding:
    __slots__ = ("check", "level", "surface", "locus", "msg")

    def __init__(self, check, level, surface, locus, msg):
        self.check = check
        self.level = level
        self.surface = surface
        self.locus = locus
        self.msg = msg


# ---------------------------------------------------------------------------------------------------
# Preamble extraction + canonical hashing (shared by CW1, --hash-preamble, --make-preamble, --self-check).
# ---------------------------------------------------------------------------------------------------

def canonical_body_hash(body_text):
    """Hash a CANONICALISED form of the preamble body so a semantically-identical reflow (line endings,
    indentation, trailing whitespace, blank-line churn from a copy-paste) still matches, while any token
    change is caught. Insignificant whitespace runs collapse to a single space; identifiers stay
    space-separated (never merged), so the canonical form tracks the token stream, not the layout."""
    canon = re.sub(r"\s+", " ", body_text).strip()
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def extract_preamble(text):
    """Return dict(version, contract, declared_sha, body, header_line_idx) for the preamble block, or None
    if no header marker is present. The body is the text strictly between the header and END marker lines."""
    lines = text.split("\n")
    header_idx = None
    header_m = None
    for i, ln in enumerate(lines):
        m = PREAMBLE_HEADER_RE.search(ln)
        if m:
            header_idx = i
            header_m = m
            break
    if header_idx is None:
        return None
    end_idx = None
    for j in range(header_idx + 1, len(lines)):
        if PREAMBLE_END_RE.search(lines[j]):
            end_idx = j
            break
    if end_idx is None:
        # A header with no END marker — a truncated/corrupt paste. Treat the body as empty so the hash
        # cannot accidentally match; CW1 then reports a mismatch (never a silent pass).
        body = ""
    else:
        body = "\n".join(lines[header_idx + 1:end_idx])
    return {
        "version": header_m.group("ver"),
        "contract": header_m.group("contract"),
        "declared_sha": header_m.group("sha").lower(),
        "body": body,
        "header_line_idx": header_idx,
    }


def strip_preamble_region(text):
    """Return the script text with the preamble block (header line through END line, inclusive) removed —
    the leg's OWN region. Every return-locus / idiom check runs over THIS, so the preamble's own
    `coverage: 'COMPLETE'` string literals and `{expected, received, missing}` shape are never credited or
    accused (the 05 verdict-locus fix: never grep the preamble body for a verdict word)."""
    lines = text.split("\n")
    pre = extract_preamble(text)
    if pre is None:
        return text
    header_idx = pre["header_line_idx"]
    end_idx = None
    for j in range(header_idx + 1, len(lines)):
        if PREAMBLE_END_RE.search(lines[j]):
            end_idx = j
            break
    if end_idx is None:
        return "\n".join(lines[:header_idx])
    return "\n".join(lines[:header_idx] + lines[end_idx + 1:])


def _scan(js, keep_strings):
    """Comment/string-strip pre-pass (the L1-M2 amendment): scan out `//` and `/* */` comments so a comment
    that merely MENTIONS a pattern (e.g. an explanatory `return manifestDiff(...)`) never satisfies or trips
    a structural check. With keep_strings=False, string-literal CONTENTS are also blanked so a string that
    contains a pattern cannot fool it either. Escapes and the three quote styles are respected; regex
    literals and template interpolation are out of scope (a documented, non-adversarial limitation)."""
    out = []
    i, n = 0, len(js)
    while i < n:
        c = js[i]
        nxt = js[i + 1] if i + 1 < n else ""
        if c == "/" and nxt == "/":
            j = js.find("\n", i)
            if j == -1:
                break
            i = j
            continue
        if c == "/" and nxt == "*":
            j = js.find("*/", i + 2)
            i = (j + 2) if j != -1 else n
            continue
        if c in ("\"", "'", "`"):
            quote = c
            out.append(c)
            i += 1
            buf = []
            closed = False
            while i < n:
                ch = js[i]
                if ch == "\\" and i + 1 < n:
                    buf.append(js[i:i + 2])
                    i += 2
                    continue
                if ch == quote:
                    closed = True
                    break
                buf.append(ch)
                i += 1
            if keep_strings:
                out.append("".join(buf))
            if closed:
                out.append(quote)
                i += 1
            continue
        out.append(c)
        i += 1
    return "".join(out)


def strip_comments(js):
    """Comments removed, string literals KEPT (so a real verdict string like 'COMPLETE' is still read)."""
    return _scan(js, keep_strings=True)


def strip_comments_and_strings(js):
    """Comments removed AND string contents blanked (so neither a comment nor a string can fool a
    structural idiom/return check)."""
    return _scan(js, keep_strings=False)


# ---------------------------------------------------------------------------------------------------
# Declaration parsing — the brownfield-inert opt-in switch (contract v1 / REQ-04). Presence of a `contract`
# pin turns the gate ON for a dispatch; absence keeps it SILENT (except CA1's graded undeclared-WARN).
# ---------------------------------------------------------------------------------------------------

CONTRACT_PIN_RE = re.compile(r"contract\s*[:=]\s*['\"]?v1\b")


def workflow_is_governed(leg_region):
    """A Workflow script opts in by declaring `contract: 'v1'` in its `const meta = {...}` (searched over
    the leg region — NOT the preamble header, which also says contract:v1)."""
    return bool(CONTRACT_PIN_RE.search(leg_region))


AGENT_DECL_RE = re.compile(r"<!--\s*" + re.escape(DISPATCH_ANNOTATION) + r"\b(?P<body>.*?)-->", re.DOTALL)


def parse_agent_declaration(prompt):
    """Parse the `<!-- <token>:dispatch ... -->` block out of an Agent prompt. Returns a dict of fields
    (lower-cased keys) or None when absent. The block IS the opt-in switch for the Agent surface."""
    if not isinstance(prompt, str):
        return None
    m = AGENT_DECL_RE.search(prompt)
    if not m:
        return None
    fields = {}
    for ln in m.group("body").split("\n"):
        km = re.match(r"\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$", ln)
        if km:
            fields[km.group(1).strip().lower()] = km.group(2).strip()
    return fields


def declared_archetype(text):
    m = re.search(r"archetype\s*[:=]\s*['\"]?([a-z]+)", text)
    return m.group(1) if m else None


# ---------------------------------------------------------------------------------------------------
# The escape hatch (contract v1 R3(b), hardened per the A6 amendment). A `fieldbook:degraded` annotation
# — parseable across comment styles (HTML / block / line comments) — downgrades a SCOPED FAIL to
# allow-through + audit. Hardening: no `scope: all` (enumerated check-ids only); a resolvable operator
# artifact reference required; every use is audited.
# ---------------------------------------------------------------------------------------------------

LEDGER_ID_RE = re.compile(r"^(FR|REV|OQ|INC|WU|LP)-\d+", re.IGNORECASE)


def parse_degraded_annotation(text):
    """Scan `text` for a `<token>:degraded` block and return its fields dict, or None. Comment-style
    agnostic: it finds the marker line, then reads following `key: value` lines, stripping `//`, `*`,
    `<!--`, `-->`, `#` comment furniture, until a line with no `key:` shape (or a fence close)."""
    lines = text.split("\n")
    start = None
    for i, ln in enumerate(lines):
        if DEGRADED_ANNOTATION in ln:
            start = i
            break
    if start is None:
        return None

    def declutter(s):
        s = s.strip()
        for pre in ("<!--", "-->", "//", "/*", "*/", "*", "#"):
            if s.startswith(pre):
                s = s[len(pre):].strip()
        for suf in ("-->", "*/"):
            if s.endswith(suf):
                s = s[: -len(suf)].strip()
        return s

    fields = {}
    for ln in lines[start + 1:]:
        raw = declutter(ln)
        if raw == "":
            # a blank/comment-only separator does not end the block; a real code line does
            if ln.strip() == "" or ln.strip().startswith(("//", "*", "<!--", "#")):
                continue
            break
        km = re.match(r"([A-Za-z0-9_-]+)\s*:\s*(.*)$", raw)
        if not km:
            break
        fields[km.group(1).strip().lower()] = km.group(2).strip()
    return fields if fields else None


def validate_degraded(ann):
    """Return (waived_checks_set, error_or_None). A well-formed annotation yields the set of check-ids it
    waives; a malformed one yields an error string (→ CX1 FAIL, and the underlying FAIL stands)."""
    checks_raw = ann.get("checks", ann.get("scope", "")).strip()
    if checks_raw == "" :
        return set(), "no `checks:` — a bypass must ENUMERATE the check-ids it waives"
    if checks_raw.lower() == "all":
        return set(), "`checks: all` is forbidden — enumerate the specific check-ids to waive (no master key)"
    waived = {c.strip().upper() for c in re.split(r"[,\s]+", checks_raw) if c.strip()}
    # CX1 (the conflict check itself) can never be waived — you cannot degrade your way past the
    # "you may not degrade AND claim complete" contradiction.
    if "CX1" in waived:
        return set(), "CX1 (the degrade/verdict conflict check) is not waivable"
    if not ann.get("reason", "").strip():
        return set(), "no `reason:` — a declared-degrade must state why the unit may be dropped"
    artifact = ann.get("artifact", ann.get("failure_manifest", "")).strip()
    if not artifact:
        return set(), "no `artifact:` — reference a resolvable operator artifact (charter id / manifest path)"
    if not degraded_artifact_resolves(artifact):
        return set(), ("artifact reference '%s' does not resolve — a path must exist on disk, or use a "
                       "ledger id (FR-/REV-/OQ-/INC-)" % artifact)
    return waived, None


def degraded_artifact_resolves(ref):
    """A degrade annotation's artifact must be verifiable: a ledger id (points at a ledger row — accepted,
    the gate cites, it does not scan) OR a path that exists on disk relative to cwd."""
    if LEDGER_ID_RE.match(ref):
        return True
    if "/" in ref or ref.endswith((".md", ".json", ".jsonl", ".txt")):
        base = os.environ.get(GATE_CWD_ENV) or os.getcwd()
        cand = ref if os.path.isabs(ref) else os.path.join(base, ref)
        return os.path.isfile(cand)
    return False


# ---------------------------------------------------------------------------------------------------
# Idiom / structural detectors (over the LEG region — never the preamble body).
# ---------------------------------------------------------------------------------------------------

FANOUT_RE = re.compile(r"\b(parallel|pipeline|fanout)\s*\(")
FILTER_BOOLEAN_RE = re.compile(r"\.filter\s*\(\s*Boolean\s*\)")
FILTER_TRUTHY_RE = re.compile(r"\.filter\s*\(\s*(\w+)\s*=>\s*!?!?\1\s*\)")
SANCTIONED_RETURN_RE = re.compile(
    r"return\s+(?:await\s+)?(?:fanout|manifestDiff)\s*\("           # return fanout(...) / manifestDiff(...)
    r"|return\s*\{[^}]*\.\.\.\s*\w*[Mm]anifest"                    # return { ...someManifest, ... }
    r"|return\s*\{[^}]*\bcoverage\s*:"                             # return { ..., coverage: report.coverage }
)
VERDICT_COMPLETE_RE = re.compile(r"(?:coverage|verdict)\s*:\s*['\"]?(COMPLETE|READY)\b", re.IGNORECASE)
DECLARE_DEGRADE_RE = re.compile(r"degrade\s*:\s*true")
HONESTY_FIELD_RE = re.compile(r"\bdiscoveries\b")


# ---------------------------------------------------------------------------------------------------
# Surface: Workflow
# ---------------------------------------------------------------------------------------------------

def check_workflow(script, findings):
    """Run the Workflow-surface catalog. Brownfield-inert: silent unless the leg declares contract: v1.

    Every structural detector runs over the LEG region (the preamble is stripped first) AND over a
    comment-stripped view, so the preamble's own verdict tokens and any explanatory comment are never
    credited or accused. Idiom/return checks additionally strip string CONTENTS; the verdict check keeps
    strings (a verdict literal like 'COMPLETE' must still be read)."""
    leg = strip_preamble_region(script)
    leg_nc = strip_comments(leg)                    # comments removed, strings kept
    leg_ncs = strip_comments_and_strings(leg)       # comments + string contents removed
    governed = workflow_is_governed(leg_nc)
    if not governed:
        return  # no governance declaration → the gate is silent (contract v1 / REQ-04)

    ann = parse_degraded_annotation(script)

    # CW1 — preamble present, un-tampered, current.
    pre = extract_preamble(script)
    if pre is None:
        findings.append(Finding(
            "CW1", FAIL, "workflow", "preamble",
            "governed workflow (contract: v1) is missing the %s block — the "
            "fail-loud primitives (assertComplete/manifestDiff/fanout) must be pasted in so a dropped unit "
            "cannot vanish. Paste the block from the kit (see make-preamble.sh); contract v1 R1."
            % PREAMBLE_MARKER))
    else:
        computed = canonical_body_hash(pre["body"])
        ver = pre["version"]
        if computed != pre["declared_sha"]:
            findings.append(Finding(
                "CW1", FAIL, "workflow", "preamble",
                "preamble body hash differs from the pinned header (v%s) — a formatter may have reflowed the "
                "block or a primitive was edited. Re-paste from the kit (make-preamble.sh) or confirm no "
                "logic change; contract v1 R1 depends on the primitives being the blessed ones." % ver))
        elif ver not in PINNED_PREAMBLES:
            findings.append(Finding(
                "CW1", WARN, "workflow", "preamble",
                "preamble v%s predates the kit's current v%s — re-paste the current block from the kit "
                "(an old-but-valid preamble is a nudge, not a tamper)." % (ver, PREAMBLE_CURRENT_VERSION)))
        elif PINNED_PREAMBLES[ver] != computed:
            findings.append(Finding(
                "CW1", FAIL, "workflow", "preamble",
                "preamble v%s is self-consistent but is NOT the kit's blessed v%s block (header hash was "
                "regenerated over an edited body) — re-paste from the kit." % (ver, ver)))

    # CW3 — naked filter(Boolean)-family compaction on a fan-out result (a silent-drop idiom). WARN: the
    # Workflow tool docs RECOMMEND filter(Boolean), so the finding must say it is countering vendor advice.
    if FANOUT_RE.search(leg_ncs) and (FILTER_BOOLEAN_RE.search(leg_ncs) or FILTER_TRUTHY_RE.search(leg_ncs)):
        findings.append(Finding(
            "CW3", WARN, "workflow", "fan-out",
            "a .filter(Boolean)-family compaction on a fan-out result silently drops failed/dropped units "
            "BEFORE they are counted (contract v1 R2). The Workflow tool docs recommend filter(Boolean) — "
            "this counters that advice on a dependent path. Route the fan-out through fanout() so a drop "
            "fails loud instead of vanishing."))

    # CB4 — a governed fan-out's accounting must live in the leg's RETURN (a sanctioned primitive call),
    # not lean on the run's status envelope. Confirms the CALL in return position — never a body grep.
    if FANOUT_RE.search(leg_ncs) and not SANCTIONED_RETURN_RE.search(leg_ncs):
        findings.append(Finding(
            "CB4", FAIL, "workflow", "return",
            "governed fan-out does not RETURN its own accounting — the terminal return must be a sanctioned "
            "primitive (return fanout(...) / return manifestDiff(...) / return { ...manifest }). A bare "
            "return leans on the run's status envelope, which lies both ways (contract v1 R4). Return the "
            "manifest so {expected, received, missing} travels with the result."))

    # CX1 — a declared-degraded leg may not also assert COMPLETE/READY in its OWN return region (the
    # preamble body is stripped, so its internal 'COMPLETE' literals are never read). Not bypassable.
    declared_degraded = bool(ann) or bool(DECLARE_DEGRADE_RE.search(leg_nc))
    if declared_degraded and VERDICT_COMPLETE_RE.search(leg_nc):
        findings.append(Finding(
            "CX1", FAIL, "workflow", "return",
            "DECLARED-DEGRADED conflict — the leg declares a degraded/partial run yet its return asserts a "
            "COMPLETE/READY verdict. Contract v1 R3(b): a degraded phase carries coverage INCOMPLETE and is "
            "NEVER READY/COMPLETE on partial input. Drop the COMPLETE assertion or drop the degrade."))

    # CB2 — a declared build/migrate leg should NAME the honesty fields in its return (a proxy for the
    # contract's return-honesty requirement; WARN — the gate checks the schema declares them, not their truth).
    arch = declared_archetype(leg_nc)
    if arch in ("build", "migrate") and not HONESTY_FIELD_RE.search(leg_nc):
        findings.append(Finding(
            "CB2", WARN, "workflow", "return",
            "declared %s leg does not name the honesty fields (discoveries[], falsifier-ran-RED proof, "
            "IMPL->WIRED reachability) in its return schema — contract v1 requires them so a partial return "
            "self-declares. (The gate checks the schema DECLARES them, never that they are true.)" % arch))


# ---------------------------------------------------------------------------------------------------
# Surface: Agent
# ---------------------------------------------------------------------------------------------------

def check_agent(tool_input, findings):
    """Run the Agent-surface catalog. CA1 is GRADED (WARN undeclared / FAIL declared) so it never
    retro-blocks a brownfield repo but bites where the author opted into the contract."""
    prompt = tool_input.get("prompt") if isinstance(tool_input, dict) else None
    model = tool_input.get("model") if isinstance(tool_input, dict) else None
    decl = parse_agent_declaration(prompt if isinstance(prompt, str) else "")
    declared = decl is not None

    # CA1 — model pin present + non-empty (grounded: `model` is a named Agent field).
    if not (isinstance(model, str) and model.strip()):
        if declared:
            findings.append(Finding(
                "CA1", FAIL, "agent", "tool_input.model",
                "declared dispatch has no explicit model pin — an unpinned dispatch silent-inherits the "
                "session model into fan-out (contract v1 R5). Set tool_input.model to an explicit tier."))
        else:
            findings.append(Finding(
                "CA1", WARN, "agent", "tool_input.model",
                "dispatch has no explicit model pin — pin the model tier so a fan-out never silent-inherits "
                "the session model (contract v1 R5). (WARN: this dispatch has not opted into the contract; "
                "add a <!-- %s --> block to make the pin a hard requirement.)" % DISPATCH_ANNOTATION))

    if not declared:
        return  # brownfield-inert: the rest of the Agent catalog is silent on an undeclared dispatch

    arch = decl.get("archetype")

    # CB2 (Agent, WARN — the Q-M3 class-flip: the schema is in prose, so this is a prompt-grep proxy).
    if arch in ("build", "migrate") and not HONESTY_FIELD_RE.search(prompt or ""):
        findings.append(Finding(
            "CB2", WARN, "agent", "tool_input.prompt",
            "declared %s dispatch does not name the honesty fields (discoveries[], falsifier proof, "
            "reachability) in its prompt/return schema — contract v1 requires them. (Prompt-grep proxy: "
            "checks the words are present, never that the answer is true.)" % arch))

    # CB4 (Agent, WARN — same class-flip): a fan-out-style dispatch should promise a self-accounting return.
    if arch in ("build", "migrate", "survey", "research") and \
            not re.search(r"\b(expected|received|missing|manifest|accounting)\b", prompt or "", re.IGNORECASE):
        findings.append(Finding(
            "CB4", WARN, "agent", "tool_input.prompt",
            "declared %s dispatch does not ask for a self-accounting return ({expected, received, missing}) "
            "— a governed dispatch owes its own accounting rather than leaning on the run envelope "
            "(contract v1 R4)." % arch))


# ---------------------------------------------------------------------------------------------------
# Escape-hatch application + decision emission
# ---------------------------------------------------------------------------------------------------

def apply_escape_hatch(findings, annotation, surface, payload):
    """Downgrade FAILs that a well-formed degraded annotation waives; a malformed annotation adds a CX1
    FAIL. Returns (kept_findings, audit_events)."""
    audit = []
    if annotation is None:
        return findings, audit
    waived, err = validate_degraded(annotation)
    if err is not None:
        findings.append(Finding(
            "CX1", FAIL, surface, "degraded-annotation",
            "malformed DECLARED-DEGRADED bypass: %s. An invalid bypass does not waive anything — the "
            "underlying finding stands (contract v1 R3(b); the escape hatch is not a rubber stamp)." % err))
        return findings, audit
    kept = []
    for f in findings:
        if f.level == FAIL and f.check in waived:
            audit.append({
                "check": f.check, "surface": surface, "reason": annotation.get("reason", ""),
                "artifact": annotation.get("artifact", annotation.get("failure_manifest", "")),
                "drop_count": annotation.get("drop_count", ""),
            })
            continue
        kept.append(f)
    return kept, audit


def write_audit(audit_events, payload):
    """Append one line per waived FAIL to .agent-docs/.gate-audit.jsonl (append-only; the cycle-start
    bypass-review sweep reads it). Best-effort: an audit-write failure never blocks a legit dispatch, but
    the caller surfaces whether the trail landed (an un-audited bypass is a contradiction in terms)."""
    if not audit_events:
        return True
    base = payload.get("cwd") or os.environ.get(GATE_CWD_ENV) or os.getcwd()
    audit_dir = os.path.join(base, ".agent-docs")
    if not os.path.isdir(audit_dir):
        return False
    path = os.path.join(audit_dir, ".gate-audit.jsonl")
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        with open(path, "a", encoding="utf-8") as fh:
            for ev in audit_events:
                row = dict(ev)
                row.update({"ts": ts, "decision": "bypassed",
                            "session_id": payload.get("session_id", ""),
                            "prompt_id": payload.get("prompt_id", "")})
                fh.write(json.dumps(row, sort_keys=True) + "\n")
        return True
    except OSError:
        return False


def emit_decision(findings, audit_events, payload, note=None):
    """Emit the PreToolUse decision JSON on stdout (exit 0 always — F6: never mix exit 2 with JSON). A FAIL
    → deny; else WARNs/notes → additionalContext; else allow (no output)."""
    fails = [f for f in findings if f.level == FAIL]
    warns = [f for f in findings if f.level == WARN]

    if fails:
        reason_lines = ["[dispatch-gate] BLOCKED — %d structural conformance FAIL(s):" % len(fails)]
        for f in fails:
            reason_lines.append("  - [%s/%s @ %s] %s" % (f.check, f.level, f.locus, f.msg))
        reason_lines.append("Contract: see %s (R1-R6). To ship degraded on purpose, add a well-formed "
                            "%s annotation (enumerated checks, reason, resolvable artifact)."
                            % (REFERENCE_DOC, DEGRADED_ANNOTATION))
        out = {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                      "permissionDecision": "deny",
                                      "permissionDecisionReason": "\n".join(reason_lines)}}
        print(json.dumps(out))
        return

    context_lines = []
    if warns:
        context_lines.append("[dispatch-gate] %d advisory finding(s) (allowed — WARN never blocks):"
                             % len(warns))
        for f in warns:
            context_lines.append("  - [%s/%s @ %s] %s" % (f.check, f.level, f.locus, f.msg))
    if audit_events:
        landed = write_audit(audit_events, payload)
        checks = ", ".join(sorted({e["check"] for e in audit_events}))
        if landed:
            context_lines.append("[dispatch-gate] DECLARED-DEGRADED bypass exercised for %s — audited to "
                                 ".agent-docs/.gate-audit.jsonl (review at cycle start)." % checks)
        else:
            context_lines.append("[dispatch-gate] DECLARED-DEGRADED bypass exercised for %s but the audit "
                                 "trail could NOT be written (no .agent-docs/) — record it by hand; an "
                                 "un-audited bypass is not sanctioned." % checks)
    if note:
        context_lines.append(note)

    if context_lines:
        out = {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                      "additionalContext": "\n".join(context_lines)}}
        print(json.dumps(out))
    # else: allow silently (no output = no action, per the hook spec).


def loud_surface(message):
    """A LOUD did-not-run / unverified surface (never a silent pass, never a hard block)."""
    out = {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                  "additionalContext": "[dispatch-gate] " + message}}
    print(json.dumps(out))


# ---------------------------------------------------------------------------------------------------
# Material extraction per surface
# ---------------------------------------------------------------------------------------------------

def read_workflow_script(tool_input, payload):
    """Return (script_text, note). Two-form contract (observed): tool_input.script = inline text;
    tool_input.scriptPath = a path the gate READS from disk. An unknown shape → (None, loud-note): FAIL
    OPEN with a warning, never a silent pass and never a hard block on a shape the gate cannot read."""
    if not isinstance(tool_input, dict):
        return None, ("Workflow tool_input is not an object — Surface-W checks did NOT run; this workflow "
                      "is UNVERIFIED (fail-open: the gate never silently passes an unknown shape).")
    if isinstance(tool_input.get("script"), str):
        return tool_input["script"], None
    sp = tool_input.get("scriptPath")
    if isinstance(sp, str) and sp:
        base = payload.get("cwd") or os.environ.get(GATE_CWD_ENV) or os.getcwd()
        path = sp if os.path.isabs(sp) else os.path.join(base, sp)
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                return fh.read(), None
        except OSError:
            return None, ("could not read scriptPath '%s' — Surface-W checks did NOT run; this workflow is "
                          "UNVERIFIED (allowed, not blocked — a resolution miss is not a foot-gun)." % sp)
    return None, ("Workflow tool_input has neither `script` nor `scriptPath` (shape may have changed "
                  "upstream) — Surface-W checks did NOT run; this workflow is UNVERIFIED. Re-verify the "
                  "gate against the installed harness version (fail-open, never a silent pass).")


# ---------------------------------------------------------------------------------------------------
# Hook driver
# ---------------------------------------------------------------------------------------------------

def run_hook(surface, emit_findings=False):
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except ValueError:
        if emit_findings:
            print("[]")
            return 0
        loud_surface("payload was not valid JSON — this dispatch is UNVERIFIED (fail-open: allowed, never "
                     "a silent pass).")
        return 0
    if not isinstance(payload, dict):
        payload = {}

    findings = []
    note = None
    annotation = None

    try:
        tool_input = payload.get("tool_input") if isinstance(payload.get("tool_input"), dict) else {}
        if surface == "agent":
            check_agent(tool_input, findings)
            annotation = parse_degraded_annotation(
                tool_input.get("prompt") if isinstance(tool_input.get("prompt"), str) else "")
        elif surface == "workflow":
            script, note = read_workflow_script(tool_input, payload)
            if script is not None:
                check_workflow(script, findings)
                annotation = parse_degraded_annotation(script)
        else:
            note = "unknown --surface '%s' — this dispatch is UNVERIFIED (fail-open)." % surface
    except Exception as exc:  # noqa: BLE001 — the rule-17/18 discipline: degrade to ONE loud surface,
        # never a traceback, never a silent pass.
        if emit_findings:
            print(json.dumps([{"check": "ENGINE", "level": WARN, "surface": surface,
                               "msg": "engine crash: %s" % exc}]))
            return 0
        loud_surface("gate engine hit an unexpected error (%s) — this dispatch is UNVERIFIED (fail-open: "
                     "allowed, never a silent pass, never a traceback)." % exc)
        return 0

    findings, audit_events = apply_escape_hatch(findings, annotation, surface, payload)

    if emit_findings:
        print(json.dumps([{"check": f.check, "level": f.level, "surface": f.surface} for f in findings]))
        return 0

    emit_decision(findings, audit_events, payload, note=note)
    return 0


# ---------------------------------------------------------------------------------------------------
# Utility modes (preamble hashing / pin self-check)
# ---------------------------------------------------------------------------------------------------

def mode_hash_preamble(path):
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        pre = extract_preamble(fh.read())
    if pre is None:
        sys.stderr.write("dispatch-gate: no %s header found in %s\n" % (PREAMBLE_MARKER, path))
        return 2
    print(canonical_body_hash(pre["body"]))
    return 0


def mode_make_preamble(path):
    """Recompute the canonical body hash AND stamp the CONFIGURED protocol-token label into the header +
    END marker lines, then rewrite the header sha256 in place. This is how preamble.js DERIVES FROM THE
    SAME SOURCE as the gate: a fork that renames the token (constant or DISPATCH_GATE_TOKEN) regenerates
    its preamble.js label from this one place rather than hand-editing it. Under the DEFAULT token the
    label re-stamp is a no-op, so the shipped preamble.js stays byte-identical. Detection is token-agnostic
    (extract_preamble), so this can re-label a preamble.js that currently carries any token."""
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    pre = extract_preamble(text)
    if pre is None:
        sys.stderr.write("dispatch-gate: no %s header found in %s\n" % (PREAMBLE_MARKER, path))
        return 2
    new_hash = canonical_body_hash(pre["body"])
    lines = text.split("\n")
    hidx = pre["header_line_idx"]
    # Stamp the configured token label (any current `<tok> DISPATCH PREAMBLE` -> the configured marker),
    # then refresh the sha256. Both are inside the header LINE (outside the hashed body), so the body hash
    # is unaffected by the label change.
    lines[hidx] = re.sub(r"\S+ DISPATCH PREAMBLE", PREAMBLE_MARKER, lines[hidx], count=1)
    lines[hidx] = re.sub(r"sha256:[0-9a-fA-F]{64}", "sha256:" + new_hash, lines[hidx])
    for j in range(hidx + 1, len(lines)):
        if PREAMBLE_END_RE.search(lines[j]):
            lines[j] = re.sub(r"END \S+ DISPATCH PREAMBLE", "END " + PREAMBLE_MARKER, lines[j], count=1)
            break
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print(new_hash)
    sys.stderr.write("dispatch-gate: rewrote %s header to '%s' v%s sha256:%s\n"
                     "  If the version changed, update PINNED_PREAMBLES in dispatch-gate.py to match.\n"
                     % (path, PREAMBLE_MARKER, pre["version"], new_hash))
    return 0


def mode_self_check():
    """Verify the gate's pinned hash matches the shipped preamble.js (CG2). FAILS LOUD on drift."""
    path = os.path.join(HERE, "preamble.js")
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            pre = extract_preamble(fh.read())
    except OSError as exc:
        sys.stderr.write("self-check FAIL: cannot read %s (%s)\n" % (path, exc))
        return 1
    if pre is None:
        sys.stderr.write("self-check FAIL: no preamble header in %s\n" % path)
        return 1
    computed = canonical_body_hash(pre["body"])
    problems = []
    if computed != pre["declared_sha"]:
        problems.append("preamble.js body hash %s != its own header sha256:%s (run make-preamble.sh)"
                        % (computed, pre["declared_sha"]))
    ver = pre["version"]
    if ver not in PINNED_PREAMBLES:
        problems.append("preamble.js version v%s is not in PINNED_PREAMBLES" % ver)
    elif PINNED_PREAMBLES[ver] != computed:
        problems.append("PINNED_PREAMBLES[%s]=%s != preamble.js body hash %s (update the pin table)"
                        % (ver, PINNED_PREAMBLES[ver], computed))
    if problems:
        for p in problems:
            sys.stderr.write("self-check FAIL: %s\n" % p)
        return 1
    print("self-check OK: preamble v%s sha256:%s pinned and self-consistent." % (ver, computed))
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description="Deterministic dispatch-conformance PreToolUse gate.")
    ap.add_argument("--surface", choices=("agent", "workflow"),
                    help="which dispatch surface this hook entry guards (hook mode).")
    ap.add_argument("--emit-findings", action="store_true",
                    help="print findings as JSON instead of the decision (self-test harness).")
    ap.add_argument("--hash-preamble", metavar="PATH", help="print the canonical body hash of a preamble.")
    ap.add_argument("--make-preamble", metavar="PATH", help="rewrite a preamble header hash in place.")
    ap.add_argument("--self-check", action="store_true",
                    help="verify the pinned hash matches the shipped preamble.js (CG2).")
    args = ap.parse_args(argv)

    if args.hash_preamble:
        return mode_hash_preamble(args.hash_preamble)
    if args.make_preamble:
        return mode_make_preamble(args.make_preamble)
    if args.self_check:
        return mode_self_check()
    if args.surface:
        return run_hook(args.surface, emit_findings=args.emit_findings)
    ap.error("one of --surface / --hash-preamble / --make-preamble / --self-check is required")


if __name__ == "__main__":
    sys.exit(main())
