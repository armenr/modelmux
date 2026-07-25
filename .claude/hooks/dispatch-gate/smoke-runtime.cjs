#!/usr/bin/env node
// smoke-runtime.cjs — (.cjs: CommonJS in EVERY context — a bare .js is parsed as ESM under a type:module repo root and require() dies at line 1, so the smoke silently never runs exactly where adopters converge; field-found day one)
// EXECUTE the preamble primitives against a runtime-contract mirror.
// provenance: kit-template · created: 2026-07-19
//
// The hash check (CW1) proves the preamble's INTEGRITY; it says nothing about BEHAVIOR —
// field-proven when fanout() shipped with a promises-into-parallel call that had never
// executed once (a launch-time TypeError on every real run), hash-green the whole time.
// This smoke runs the primitives under a mirror of the Workflow runtime's contract:
//   parallel(thunks) THROWS unless every element is a FUNCTION; it invokes each thunk,
//   awaits the result, and resolves rejections to null-in-place (never rejects itself).
// Entailment: this proves the shipped call SHAPES execute under the runtime contract —
// it does NOT prove the live runtime's semantics beyond that contract, nor agent behavior.
//
// Usage: node smoke-runtime.cjs [path-to-preamble.js]   (exit 0 = all cases pass)
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, 'preamble.js');
const src = fs.readFileSync(file, 'utf8');

// --- runtime-contract mirror ---
function parallel(thunks) {
  if (!Array.isArray(thunks) || !thunks.every(function (t) { return typeof t === 'function'; })) {
    throw new TypeError('parallel() expects an array of functions');
  }
  return Promise.all(thunks.map(function (t) {
    return Promise.resolve().then(t).catch(function () { return null; });
  }));
}
const ctx = { parallel: parallel, log: function () {}, console: console, Promise: Promise, Error: Error, TypeError: TypeError, JSON: JSON, Array: Array };
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: file });

const fanout = ctx.fanout;
if (typeof fanout !== 'function') { console.error('SMOKE FAIL: fanout not defined by preamble'); process.exit(1); }

let failures = 0;
function verdict(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
  if (!ok) failures++;
}

(async function () {
  // Case 1: plain per-item call COMPLETES with a COMPLETE manifest (the shape that never ran pre-0.8.1).
  try {
    const out = await fanout([1, 2, 3], function (n) { return Promise.resolve(n * 10); }, { label: 'c1' });
    verdict('plain-call completes', Array.isArray(out.results) && out.results.join(',') === '10,20,30' && out.manifest.coverage === 'COMPLETE',
      JSON.stringify(out.results));
  } catch (e) { verdict('plain-call completes', false, e.message); }

  // Case 2: pre-0.8.1 interim (runFn returns a thunk) must THROW the guidance error — never
  // complete with function objects as results (the fail-quiet inversion).
  try {
    await fanout([1], function (n) { return function () { return Promise.resolve(n); }; }, { label: 'c2' });
    verdict('interim-thunk throws loud', false, 'completed instead of throwing');
  } catch (e) {
    verdict('interim-thunk throws loud', /pre-0\.8\.1 interim/.test(e.message), e.message.slice(0, 80));
  }

  // Case 3: degrade path — a rejecting item lands null-in-place, coverage INCOMPLETE, run continues.
  try {
    const out = await fanout([1, 2], function (n) {
      return n === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(n);
    }, { label: 'c3', degrade: true, degradeReason: 'smoke' });
    const dropped = out.manifest.missing && out.manifest.missing.length === 1;
    verdict('degrade accounts the drop', out.manifest.coverage === 'INCOMPLETE' && dropped, JSON.stringify(out.manifest));
  } catch (e) { verdict('degrade accounts the drop', false, e.message); }

  // Case 4: default (non-degrade) path THROWS on a drop (R3a) — assertComplete fires.
  try {
    await fanout([1, 2], function (n) { return n === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(n); }, { label: 'c4' });
    verdict('R3a throws on drop', false, 'completed despite a drop');
  } catch (e) { verdict('R3a throws on drop', true); }

  console.log(failures === 0 ? 'SMOKE OK — 4 cases, preamble primitives EXECUTE under the runtime contract' : ('SMOKE FAIL — ' + failures + ' case(s)'));
  process.exit(failures === 0 ? 0 : 1);
})();
