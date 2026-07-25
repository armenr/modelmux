// ==== FIELDBOOK DISPATCH PREAMBLE v1.0.0 contract:v1 sha256:745a31d8d5a6141497308793fff23d81845c465963fe82d0095cd7f302c62866 ==== generated, DO NOT HAND-EDIT
//   Regenerate via make-preamble.sh after any edit; the dispatch-conformance gate hash-checks the body
//   between these markers (check CW1). The one normative statement of R1-R6 is
//   .agent-docs/reference/fail-loud-dispatch-contract.md — this block ENFORCES it, never restates it.
/* eslint-disable */
//
// A governed Workflow script cannot import (the runtime forbids it), so the fail-loud machinery travels
// INSIDE the script: paste this block verbatim near the top, then declare `const meta = {...}` after it.
// `parallel` / `agent` / `pipeline` below are the Workflow runtime's AMBIENT primitives (they exist where
// this is pasted); this block never defines or executes them — it only wraps them so a dropped unit fails
// loud instead of vanishing.

// assertComplete(results, expected, label) — the phase-boundary throw (contract v1 R1).
// Throws (the loud failure — a top-level throw fails the run) unless every input produced a
// non-null/undefined result. Assert this before ANY dependent phase.
function assertComplete(results, expected, label) {
  const exp = (typeof expected === 'number') ? expected : (expected && expected.length) || 0;
  // Explicit null/undefined test, NEVER truthiness — `r ? null : i` mis-reports index 0 and a legit-falsy
  // return ({}/[]/0/'') as a drop. A schema agent returns {}/[] for empty findings, never null; only a
  // dropped unit is null/undefined.
  const missing = results
    .map((r, i) => (r === null || r === undefined) ? i : null)
    .filter(i => i !== null);
  const received = exp - missing.length;
  if (missing.length) {
    throw new Error(
      'FAIL-LOUD ' + label + ': ' + received + '/' + exp + ' — missing [' + missing.join(',') + ']. ' +
      'HALT: read journal.jsonl + the failing legs firsthand, fix cause, resume the run (survivors banked, ' +
      'only gaps re-run). COMPLETED is not COMPLETE.'
    );
  }
  // Length guard: a set already compacted by .filter(Boolean) has NO null slots to find — its LENGTH is
  // the only surviving evidence of the drop. Without this, a silent-drop-then-assert passes (R2 backstop).
  if (results.length !== exp) {
    throw new Error(
      'FAIL-LOUD ' + label + ': length ' + results.length + ' != expected ' + exp + ' — the result set is ' +
      'not the input set; a drop was compacted away before the count. HALT.'
    );
  }
  return results;
}

// manifestDiff(expected, received, opts) — expected-items IN, per-item {id,status} OUT, diff-and-halt (or
// diff-and-degrade). The returned report IS the {expected, received, missing} self-accounting (contract v1
// R4/R1): a governed leg RETURNS this instead of trusting the run's status envelope (which lies both ways).
//   expected : [id, ...]  OR  [{id, ...}, ...]     — the work-items that SHOULD have run
//   received : [{id, status}, ...]                 — per-item result manifest ('ok' is the ONLY passing status)
//   opts.degrade=true  -> R3(b): return a FAILURE MANIFEST (never throw); downstream MUST carry INCOMPLETE
//   opts.degrade unset -> R3(a): HALT-AND-REPAIR (throw) — the default
function manifestDiff(expected, received, opts) {
  opts = opts || {};
  const label = opts.label || 'manifest';
  const expIds = expected.map(function (e) { return (e && typeof e === 'object') ? e.id : e; });
  const okIds = new Set();          // ids that reported status 'ok'
  const rec = new Map();            // id -> row (last wins) — for the failed/extra diagnostics only
  for (const r of (received || [])) {
    if (r === null || r === undefined || r.id === undefined) continue; // a null slot is a DROP, not a row
    rec.set(r.id, r);
    if (r.status === 'ok') okIds.add(r.id);
  }
  // received / missing / coverage are computed against the EXPECTED id set and the 'ok' status ONLY, so a
  // dropped row (status:'dropped') and a failed row (status:'error') BOTH count as missing. This keeps the
  // triple self-consistent with assertComplete on BOTH the halt and the degrade path: for every id in
  // expIds it is in exactly one of {received, missing}, so received === expected  <=>  missing.length === 0
  // <=>  coverage === 'COMPLETE'. Counting against expIds (not rec.size) also makes duplicate expected ids
  // safe. (This is the 05 correctness fix: the old shape read a false-COMPLETE triple on the degrade path.)
  const missing = expIds.filter(function (id) { return !okIds.has(id); });          // no 'ok' row at all
  const received_ct = expIds.filter(function (id) { return okIds.has(id); }).length; // count vs expected set
  const failed = expIds.filter(function (id) { return rec.has(id) && rec.get(id).status !== 'ok'; });
  const extra = Array.from(rec.keys()).filter(function (id) { return !expIds.includes(id); });
  const report = {
    expected: expIds.length,
    received: received_ct,
    missing: missing,
    failed: failed,
    extra: extra,
    // COMPLETE iff every expected id has an 'ok' row. An `extra` id is surfaced as an anomaly but does not,
    // by itself, make coverage INCOMPLETE — all expected work was still received.
    coverage: (missing.length === 0) ? 'COMPLETE' : 'INCOMPLETE',
  };
  if (report.coverage === 'COMPLETE') return report;
  if (opts.degrade) {
    // R3(b) DECLARED-DEGRADED: hand the FAILURE MANIFEST downstream; the dependent phase's verdict is
    // NEVER READY/COMPLETE on it.
    report.degraded = true;
    report.reason = opts.degradeReason ||
      'declared-degraded: dependent phase must carry coverage INCOMPLETE';
    return report;
  }
  // R3(a) HALT-AND-REPAIR (default).
  throw new Error(
    'FAIL-LOUD ' + label + ': coverage INCOMPLETE — received ' + report.received + '/' + report.expected +
    '; missing [' + missing.join(',') + '] failed [' + failed.join(',') + ']. HALT: read journal.jsonl, ' +
    'RECOVER stranded work (do NOT blind re-dispatch — the envelope lies both ways), resume only the gaps.'
  );
}

// vacuityGuard(set, verdictFn, label) — an empty or drop-riddled verifier set resolves UNVERIFIED, never
// PASS. [].every() is vacuously TRUE — a dead verifier silently confirms; contract v1 R2. A downstream
// READY/COMPLETE must gate on verdict === 'PASS'; UNVERIFIED is a HALT, not a soft pass.
function vacuityGuard(set, verdictFn, label) {
  label = label || 'verdict';
  if (!Array.isArray(set) || set.length === 0) {
    return {
      verdict: 'UNVERIFIED',
      reason: label + ': empty verifier set — [].every() is vacuously true; an absent verdict is ' +
        'UNVERIFIED, not PASS. Confirm the verifiers actually ran (0/N refuted is a smell).',
    };
  }
  const holes = set
    .map(function (x, i) { return (x === null || x === undefined) ? i : null; })
    .filter(function (i) { return i !== null; });
  if (holes.length) {
    return {
      verdict: 'UNVERIFIED',
      reason: label + ': ' + holes.length + ' dropped verifier(s) at [' + holes.join(',') + '] — a ' +
        'dead/dropped verifier silently confirms; resolve the drops before trusting the verdict.',
    };
  }
  const pass = set.every(verdictFn || Boolean);
  return {
    verdict: pass ? 'PASS' : 'FAIL',
    reason: label + ': ' + set.length + '/' + set.length + ' verifiers evaluated, ' +
      (pass ? 'all pass' : 'a failure present') + '.',
  };
}

// fanout(inputs, runFn, opts) — the ONLY fan-out an archetype's dependent join calls. It wraps the ambient
// parallel() and asserts completeness BY CONSTRUCTION (contract v1 R1): the author cannot forget to count,
// because counting is the wrapper's body. Returns { results, manifest } so the self-accounting (R4) is
// produced for free. opts.degrade=true routes the R3(b) declared-degraded path.
async function fanout(inputs, runFn, opts) {
  opts = opts || {};
  const label = opts.label || 'fanout';
  const idOf = opts.idOf || function (inp, i) { return i; };
  // parallel() demands an array of THUNKS — fanout wraps each item's call internally (0.8.1) so the
  // author passes the plain per-item call. Entailment: the wrap proves each item's work STARTS inside
  // parallel's slot management; the drop-accounting below is what proves it FINISHED.
  // The interim-detection flag is raised IN-thunk but thrown from fanout's OWN frame after parallel
  // returns: an in-thunk throw is null-in-placed by the runtime's catch (it reads as a mere drop, and
  // the degrade path would not throw at all) — the guidance must outrank both accounting paths.
  var interimDetected = false;
  const results = await parallel(inputs.map(function (inp, i) {
    return function () {
      const r = runFn(inp, i);
      if (typeof r === 'function') {
        // A function-typed return = a pre-0.8.1 interim call site still thunk-wrapping by hand.
        // Without this guard, parallel would resolve the inner FUNCTION OBJECT as the "result" —
        // no agent runs, the workflow COMPLETES, and the failure is QUIET.
        interimDetected = true;
        throw new Error('interim thunk shape');
      }
      return r;
    };
  })); // null-in-place on drop
  if (interimDetected) {
    throw new Error('FAIL-LOUD ' + label + ': runFn returned a FUNCTION — pre-0.8.1 interim ' +
      'thunk-wrapping detected at this call site; pass the plain call (fanout thunk-wraps ' +
      'internally since 0.8.1).');
  }
  if (opts.degrade) {
    // R3(b): build the per-item manifest, diff-degrade, hand it downstream (coverage INCOMPLETE on any drop).
    const received = results.map(function (r, i) {
      return { id: idOf(inputs[i], i), status: (r === null || r === undefined) ? 'dropped' : 'ok' };
    });
    const manifest = manifestDiff(inputs.map(idOf), received,
      { degrade: true, label: label, degradeReason: opts.degradeReason });
    return { results: results, manifest: manifest }; // downstream MUST honor manifest.coverage
  }
  // R3(a) default: throw on any drop, THEN return with a COMPLETE manifest.
  assertComplete(results, inputs.length, label);
  return {
    results: results,
    manifest: {
      expected: inputs.length, received: inputs.length,
      missing: [], failed: [], extra: [], coverage: 'COMPLETE',
    },
  };
}

// preflight(agentTypes, args) — R5 launch pre-flight, throwing at line 1 (where a launch-time death is
// cheapest to read): a newly copied agentType must be a real registered NAME (not empty/non-string — the
// registry-race null source), and args must be REAL JSON values, never JSON-string-encoded (a double-
// encoded arg kills the script at line 1).
function preflight(agentTypes, args) {
  const types = Array.isArray(agentTypes) ? agentTypes : [agentTypes];
  const badType = types.find(function (t) { return typeof t !== 'string' || t.trim() === ''; });
  if (badType !== undefined) {
    throw new Error('FAIL-LOUD preflight: agentType ' + JSON.stringify(badType) + ' is empty/non-string — ' +
      'a newly copied agentType must be a registered name string (the registry-race null source).');
  }
  const bag = (args && typeof args === 'object') ? args : {};
  for (const k of Object.keys(bag)) {
    const v = bag[k];
    if (typeof v === 'string') {
      const s = v.trim();
      if (s.startsWith('{') || s.startsWith('[')) {
        let looksJson = false;
        try { JSON.parse(s); looksJson = true; } catch (e) { looksJson = false; }
        if (looksJson) {
          throw new Error('FAIL-LOUD preflight: arg ' + JSON.stringify(k) + ' looks JSON-string-encoded (' +
            s.slice(0, 40) + '...) — pass real JSON values, not a stringified object.');
        }
      }
    }
  }
  return true;
}

// resumeGaps(report) — the targeted-resume helper: from a manifestDiff/fanout report, return ONLY the ids
// still owed (the missing set), so a resume re-runs the gaps and banks survivors rather than blind
// re-dispatching the whole set (the envelope may hide stranded-successful work). The orchestrator feeds
// these ids to the Workflow tool's resume; this primitive makes the gap set exact.
function resumeGaps(report) {
  if (!report || !Array.isArray(report.missing)) {
    throw new Error('FAIL-LOUD resumeGaps: expected a manifestDiff report with a `missing` array — ' +
      'do not resume from a status envelope; resume from the per-item accounting.');
  }
  return report.missing.slice();
}
// ==== END FIELDBOOK DISPATCH PREAMBLE ====
