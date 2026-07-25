#!/usr/bin/env python3
# self-test.py — the known-positive self-test for the dispatch-conformance gate (C4 / test-your-safety-tool).
# provenance: kit-template · created: 2026-07-13 · last-modified: 2026-07-13
#
# Runs every fixture through the REAL check engine and asserts the EXACT finding set:
#   * a RED fixture must produce its expected finding(s) — if a red passes clean, the gate is blind → FAIL LOUD.
#   * a GREEN fixture must produce NO findings — if a green trips a check, the gate over-blocks → FAIL LOUD.
#   * the KNOWN-POSITIVE canary must fire — "0 findings on the canary" is a broken refuter, never a clean
#     pass (the exact inversion of the wu-refs scar: a safety tool that could no longer fail was believed).
#   * the preamble pin must match the shipped preamble.js (--self-check), and the tamper fixture's mutation
#     must actually change the body (a red that cannot be red is itself a bug).
# Plus a few END-TO-END assertions in the gate's normal decision mode (deny vs allow vs audited-bypass).
#
# Stock Python 3, stdlib only. Exit 0 = all pass; exit 1 = FAIL LOUD.

import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GATE = os.path.join(HERE, "dispatch-gate.py")
PREAMBLE = os.path.join(HERE, "preamble.js")
FX = os.path.join(HERE, "fixtures")

# The one-line mutation the tampered-preamble fixture applies: reintroduce the exact index-0/falsy bug the
# explicit null/undefined test exists to prevent. If this substring is ever absent from preamble.js, the
# tamper is vacuous — the self-test asserts the replacement actually happened.
TAMPER_FROM = "(r === null || r === undefined) ? i : null"
TAMPER_TO = "r ? null : i"

# Active protocol token — MIRRORS dispatch-gate.py's precedence exactly (env override wins, else the shipped
# default). The fixtures + preamble.js are authored with the DEFAULT token; when the gate runs under a token
# override (DISPATCH_GATE_TOKEN set), retoken() rewrites the default-token markers in each composed input to
# the active token so the fixtures exercise the gate faithfully. A no-op when the active token IS the default
# — so the default self-test run is byte-for-byte the previous behaviour.
DEFAULT_PROTOCOL_TOKEN = "fieldbook"
PROTOCOL_TOKEN = (os.environ.get("DISPATCH_GATE_TOKEN") or DEFAULT_PROTOCOL_TOKEN).strip() \
    or DEFAULT_PROTOCOL_TOKEN


def retoken(text):
    """Rewrite the shipped default-token markers (preamble header/END label + `<token>:dispatch` /
    `<token>:degraded` annotations) to the ACTIVE protocol token. No-op under the default token."""
    if PROTOCOL_TOKEN == DEFAULT_PROTOCOL_TOKEN:
        return text
    lo, up = PROTOCOL_TOKEN.lower(), PROTOCOL_TOKEN.upper()
    dlo, dup = DEFAULT_PROTOCOL_TOKEN.lower(), DEFAULT_PROTOCOL_TOKEN.upper()
    return (text
            .replace(dup + " DISPATCH PREAMBLE", up + " DISPATCH PREAMBLE")
            .replace(dlo + ":dispatch", lo + ":dispatch")
            .replace(dlo + ":degraded", lo + ":degraded"))


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def compose_workflow(leg_path, preamble_mode):
    """Build a full Workflow script: the pasted preamble (per mode) followed by the fixture's leg. The
    composed script is re-tokenised to the active protocol token (a no-op under the default token)."""
    leg = read(leg_path)
    if preamble_mode == "none":
        return retoken(leg)
    pre = read(PREAMBLE)
    if preamble_mode == "tampered":
        if TAMPER_FROM not in pre:
            fail("tamper fixture is VACUOUS — '%s' not found in preamble.js (a red that cannot be red)"
                 % TAMPER_FROM)
        pre = pre.replace(TAMPER_FROM, TAMPER_TO, 1)
    return retoken(pre + "\n" + leg)


def run_gate(surface, payload, emit_findings=True, cwd=None):
    args = ["python3", GATE, "--surface", surface]
    if emit_findings:
        args.append("--emit-findings")
    proc = subprocess.run(args, input=json.dumps(payload), capture_output=True, text=True, cwd=cwd)
    if proc.returncode != 0:
        fail("gate exited %d (surface=%s)\nstderr: %s" % (proc.returncode, surface, proc.stderr))
    return proc.stdout


def findings_set(surface, payload, cwd=None):
    out = run_gate(surface, payload, emit_findings=True, cwd=cwd)
    try:
        rows = json.loads(out)
    except ValueError:
        fail("gate --emit-findings did not print JSON: %r" % out)
    return {(r["check"], r["level"]) for r in rows}


ERRORS = []


def fail(msg):
    ERRORS.append(msg)


# ---------------------------------------------------------------------------------------------------
# Fixture registry — each row: name · surface · fixture file · (workflow) preamble mode · expected set.
# ---------------------------------------------------------------------------------------------------
WORKFLOW_FIXTURES = [
    # name, leg file, preamble mode, expected {(check, level)}, is_canary
    ("clean-floor",           "clean-floor.js",           "valid",    set(),                        False),
    ("declared-degraded-ok",  "declared-degraded-ok.js",  "valid",    set(),                        False),
    ("escape-hatch-ok",       "escape-hatch-ok.js",       "valid",    set(),                        False),
    ("filter-boolean",        "filter-boolean.js",        "valid",    {("CW3", "WARN")},            False),
    ("missing-preamble",      "missing-preamble.js",      "none",     {("CW1", "FAIL")},            False),
    ("tampered-preamble",     "tampered-preamble.js",     "tampered", {("CW1", "FAIL")},            False),
    ("degraded-but-complete", "degraded-but-complete.js", "valid",    {("CX1", "FAIL")},            False),
    ("bare-return",           "bare-return.js",           "valid",    {("CB4", "FAIL")},            True),
    ("escape-hatch-malformed","escape-hatch-malformed.js","valid",    {("CB4", "FAIL"), ("CX1", "FAIL")}, False),
]

AGENT_FIXTURES = [
    # name, payload file, expected {(check, level)}, is_canary
    ("agent-pinned",             "agent-pinned.json",             set(),               False),
    ("agent-declared-no-model",  "agent-declared-no-model.json",  {("CA1", "FAIL")},   True),
    ("agent-undeclared-no-model","agent-undeclared-no-model.json",{("CA1", "WARN")},   False),
]


def main():
    canary_fired = {"bare-return": False, "agent-declared-no-model": False}

    # --- pin / self-check first (CG2) ---
    proc = subprocess.run(["python3", GATE, "--self-check"], capture_output=True, text=True)
    if proc.returncode != 0:
        fail("preamble pin self-check FAILED:\n" + proc.stderr)

    # --- workflow fixtures ---
    for name, leg, mode, expected, is_canary in WORKFLOW_FIXTURES:
        script = compose_workflow(os.path.join(FX, "workflow", leg), mode)
        payload = {"tool_name": "Workflow", "tool_input": {"script": script}}
        got = findings_set("workflow", payload)
        if got != expected:
            fail("WORKFLOW %s: expected %s, got %s" % (name, sorted(expected), sorted(got)))
        if is_canary:
            canary_fired[name] = bool(got)

    # --- agent fixtures ---
    for name, pfile, expected, is_canary in AGENT_FIXTURES:
        # retoken the raw JSON (the `<!-- <token>:dispatch ... -->` marker lives inside a string value) so
        # the declaration parses under an active token override; a no-op under the default token.
        payload = json.loads(retoken(read(os.path.join(FX, "agent", pfile))))
        got = findings_set("agent", payload)
        if got != expected:
            fail("AGENT %s: expected %s, got %s" % (name, sorted(expected), sorted(got)))
        if is_canary:
            canary_fired[name] = bool(got)

    # --- the canary MUST have fired (0 findings on a planted positive = a broken refuter) ---
    for cname, fired in canary_fired.items():
        if not fired:
            fail("KNOWN-POSITIVE CANARY '%s' did NOT fire — the refuter is broken; '0 findings' here is a "
                 "smell, not a clean pass (the wu-refs scar inverted)." % cname)

    # --- runtime smoke (0.8.1): EXECUTE the preamble primitives, don't just hash them. The hash check
    # proves integrity; behavior needs a run — field-proven when fanout() shipped with a call shape that
    # had never executed once, hash-green throughout. Observation-integrity: a skipped smoke is reported
    # LOUD as unverified, never as a silent pass (node absent must not read as smoke-clean).
    smoke = os.path.join(HERE, "smoke-runtime.cjs")
    node = shutil.which("node")
    if node is None:
        print("self-test: WARNING — node not on PATH: runtime smoke SKIPPED, preamble behavior UNVERIFIED "
              "this run (hash integrity only). Install node to close the gap.")
    else:
        sproc = subprocess.run([node, smoke], capture_output=True, text=True)
        if sproc.returncode != 0:
            fail("RUNTIME SMOKE failed — the preamble primitives do not execute under the runtime "
                 "contract:\n" + sproc.stdout + sproc.stderr)
        else:
            # Print the ran-and-passed line: a silent success is indistinguishable from a never-ran
            # (observation-integrity — the smoke must be visible as having FIRED this run).
            print("self-test: runtime smoke OK — preamble primitives executed under the runtime contract.")

    # --- end-to-end normal-mode assertions (real block / allow / audited-bypass paths) ---
    # 1. a FAIL fixture DENIES.
    script = compose_workflow(os.path.join(FX, "workflow", "missing-preamble.js"), "none")
    out = run_gate("workflow", {"tool_name": "Workflow", "tool_input": {"script": script}}, emit_findings=False)
    if '"permissionDecision": "deny"' not in out and '"permissionDecision":"deny"' not in out:
        fail("end-to-end: missing-preamble did not emit a deny decision:\n%s" % out)

    # 2. a clean fixture ALLOWS (no output at all).
    script = compose_workflow(os.path.join(FX, "workflow", "clean-floor.js"), "valid")
    out = run_gate("workflow", {"tool_name": "Workflow", "tool_input": {"script": script}}, emit_findings=False)
    if out.strip() != "":
        fail("end-to-end: clean-floor should allow silently but emitted:\n%s" % out)

    # 3. a well-formed bypass ALLOWS and WRITES an audit line (cwd carries a .agent-docs/).
    with tempfile.TemporaryDirectory() as td:
        os.makedirs(os.path.join(td, ".agent-docs"))
        script = compose_workflow(os.path.join(FX, "workflow", "escape-hatch-ok.js"), "valid")
        payload = {"tool_name": "Workflow", "tool_input": {"script": script}, "cwd": td,
                   "session_id": "st", "prompt_id": "p1"}
        out = run_gate("workflow", payload, emit_findings=False)
        if "deny" in out:
            fail("end-to-end: escape-hatch-ok was DENIED but a well-formed bypass must allow:\n%s" % out)
        audit = os.path.join(td, ".agent-docs", ".gate-audit.jsonl")
        if not os.path.isfile(audit) or "CB4" not in read(audit):
            fail("end-to-end: escape-hatch-ok did not write the CB4 bypass audit line to %s" % audit)

    # --- report ---
    total = len(WORKFLOW_FIXTURES) + len(AGENT_FIXTURES)
    if ERRORS:
        print("dispatch-gate self-test: FAIL LOUD — %d problem(s):" % len(ERRORS))
        for e in ERRORS:
            print("  - " + e)
        return 1
    print("dispatch-gate self-test: OK — %d fixtures, both canaries fired, pin consistent, "
          "block/allow/audited-bypass verified." % total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
