// GREEN (bypass) — a governed leg that WOULD FAIL CB4 (bare return) but carries a well-formed, hardened
// DECLARED-DEGRADED annotation: enumerated check-ids (not `all`), a non-empty reason, and a resolvable
// operator-artifact reference (a ledger id). The gate downgrades the scoped CB4 FAIL to allow-through and
// appends an audit line. Expect: no findings (the FAIL is waived); the dispatch is ALLOWED.
// fieldbook:degraded
//   checks: CB4
//   reason: accounting for this survey lives in the linked failure manifest, not the inline return
//   artifact: FR-0007
//   coverage: INCOMPLETE
//   drop_count: 0
const meta = {
  archetype: 'survey',
  contract: 'v1',
  preamble: 'v1.0.0',
};

async function run(targets) {
  const inputs = await enumerate(targets);
  const { results } = await fanout(inputs, (t) => probe(t), { label: 'probe', idOf: (t) => t.id });
  return { done: true };
}
